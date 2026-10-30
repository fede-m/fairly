"""Find dictionary entries with an empty feminine list and propose the missing form.

Two steps:

    python annotate_empty_feminine.py annotate
        -> writes empty_feminine_review.csv, one row per (word, pos) with "feminine": []

    python annotate_empty_feminine.py apply empty_feminine_review.csv
        -> copies the checked `final_feminine` column into dictionary.annotated.json
           (use --in-place to overwrite dictionary.json instead)

Proposals come only from the dictionary itself, in this order of trust:
  1. sibling   - the singular/plural of the same noun has a feminine (signore -> signora => signori -> signore)
  2. other_pos - the same word has a feminine under another POS (francesi adj -> francesi)
  3. rule      - suffix rules (-tori -> -trici, -ieri -> -iere, -nti epicene, ...)
When at least two sources agree the confidence is "high", one dictionary source gives "medium",
suffix rules alone give "low". Rows tagged not_person / already_feminine get no proposal.
"""
import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DICTIONARY_PATH = HERE.parent / "dictionary.json"
REVIEW_PATH = HERE / "empty_feminine_review.csv"
ANNOTATED_PATH = HERE.parent / "dictionary.annotated.json"

COLUMNS = ["word", "pos", "neutral", "number", "category", "confidence",
           "proposed_feminine", "final_feminine", "evidence", "note"]

# Hand-checked non-person nouns found among the empty entries (objects, drugs, anatomy, animals, ...).
# Extend it when new entries show up.
NOT_PERSON = {
    "2", "6", "abitabile", "acaricida", "antivirali", "avvolgibili", "betabloccanti", "biocida",
    "bidenti", "calmanti", "cardiostimolanti", "casuali", "causali", "celestiali", "cellulari",
    "circuitali", "clitoridi", "condivisioni", "congeniali", "contingenti", "convenevoli",
    "cosmetiche", "decimali", "dendriti", "detergenti", "duali", "editoriali", "epiteliali",
    "espedienti", "eventuali", "fendenti", "fertilizzanti", "ficcanti", "fosforescenti", "frontali",
    "germinali", "gibboni", "inerti", "infestanti", "interdisciplinari", "isosceli", "lattescenti",
    "limiti", "linfonodali", "lucioperche", "macaoni", "mastiti", "medicinali", "mestoloni", "molli",
    "mordenti", "oncogeni", "orripilanti", "pendenti", "percorribili", "percussori", "personali",
    "pieghevoli", "polari", "poligonali", "ponteficali", "quadrangolari", "quadrupedi", "riunioni",
    "scorrevoli", "solventi", "spettacolari", "stabili", "stomachevoli", "succursali", "susseguenti",
    "tetrapodi", "tiranti", "trascendentali", "universali", "visceri", "viole", "volanti",
}

# Endings whose masculine and feminine forms coincide (la/le rappresentante/i, la francese, ...).
EPICENE_SUFFIXES = (
    "ista", "nte", "nti", "ese", "esi", "ense", "ensi", "ale", "ali", "ile", "ili", "are", "ari",
    "evole", "evoli", "ace", "aci", "cida", "enne", "enni", "oide", "oidi", "ede", "edi", "ire", "iri",
    "arca", "iatra", "ita", "ota", "ata", "ingue", "ingui", "estre", "estri",
)

# (masculine suffix, feminine suffix), tried in order: the first match wins.
# -tore/-tori only after a vowel or t (lavoratore, lettore), not mentore/pastore/questore.
SUFFIX_RULES = [
    (r"(?<=[aeiut])tore", "trice"), (r"(?<=[aeiut])tori", "trici"),
    ("sore", "sora"), ("sori", "sore"),
    ("iere", "iera"), ("ieri", "iere"),
    ("one", "ona"), ("oni", "one"),
    ("ore", "ora"), ("ori", "ore"),
    ("co", "ca"), ("chi", "che"), ("go", "ga"), ("ghi", "ghe"),
    ("o", "a"), ("i", "e"),
]

ALREADY_FEMININE_SUFFIXES = ("trice", "trici", "essa", "esse")


def forms(entry: dict, gender: str) -> list[str]:
    return [f["form"] for f in entry.get(gender) or []]


def is_plural(word: str) -> bool:
    return word.endswith("i")


def sibling_keys(word: str) -> list[str]:
    """Plausible keys for the singular (if word is plural) or the plural (if singular) of word."""
    if is_plural(word):
        if word.endswith(("chi", "ghi")):
            return [word[:-2] + "o", word[:-2] + "a"]  # girovaghi -> girovago, gerarchi -> gerarca
        return [word[:-1] + "o", word[:-1] + "e", word[:-1] + "a"]
    if word.endswith(("ca", "co")):
        return [word[:-1] + "hi", word[:-1] + "i"]
    if word.endswith(("ga", "go")):
        return [word[:-1] + "hi", word[:-1] + "i"]
    return [word[:-1] + "i"]


def number_shift(fem: str, to_plural: bool) -> str | None:
    """Turn a sibling's feminine into the number of the word we are annotating."""
    if to_plural:
        for sg, pl in (("ca", "che"), ("ga", "ghe"), ("ice", "ici"), ("a", "e"), ("e", "i")):
            if fem.endswith(sg):
                return fem[: -len(sg)] + pl
    else:
        for pl, sg in (("che", "ca"), ("ghe", "ga"), ("ici", "ice"), ("e", "a"), ("i", "e")):
            if fem.endswith(pl):
                return fem[: -len(pl)] + sg
    return None


def from_sibling(word: str, sib: str, sib_fems: list[str]) -> list[str]:
    """Feminine candidates for `word` derived from the feminine list of its sibling `sib`."""
    sib_is_plural = is_plural(sib)
    # drop forms with the wrong number or no vowel ending (e.g. pendolare -> "pendolari", "congenial")
    fems = [f for f in sib_fems
            if f and f[-1] in "aeio" and (sib_is_plural or not f.endswith("i"))
            and (not sib_is_plural or not f.endswith("a"))]
    if not fems:
        return []
    different = [f for f in fems if f != sib]
    if not different:
        return [word]  # the sibling is epicene, so the word is too
    out = []
    for f in different:
        shifted = number_shift(f, to_plural=is_plural(word))
        if shifted and shifted not in out:
            out.append(shifted)
    return out


def from_rules(word: str) -> tuple[str, str] | None:
    head, sep, tail = word.partition(" ")  # "vigili del fuoco": inflect the head only
    if head.startswith("capo") and len(head) > 6:
        return word, "capo- compound is invariable"
    if head.endswith(EPICENE_SUFFIXES):
        return word, "epicene suffix"
    for masc, fem in SUFFIX_RULES:
        match = re.search(masc + "$", head)
        if match:
            label = masc.split(")")[-1]
            return head[: match.start()] + fem + sep + tail, f"-{label} -> -{fem}"
    return None


def annotate(dictionary: dict) -> list[dict]:
    # feminine form -> keys that list it, to recognise keys that are themselves feminine forms
    feminine_of = defaultdict(set)
    for key, by_pos in dictionary.items():
        for entry in by_pos.values():
            for f in forms(entry, "feminine"):
                if f != key:
                    feminine_of[f].add(key)

    rows = []
    for word, by_pos in dictionary.items():
        for pos, entry in by_pos.items():
            if forms(entry, "feminine"):
                continue
            neutral = forms(entry, "neutral")
            row = {
                "word": word,
                "pos": pos,
                "neutral": "|".join(neutral),
                "number": "pl" if is_plural(word) else "sg",
                "proposed_feminine": "",
                "evidence": "",
                "note": "",
            }
            rows.append(row)

            if word in NOT_PERSON or word.isdigit() or re.search(r"[sz]ion[ei]$", word):
                row.update(category="not_person", confidence="")
                continue
            # epicene plurals (pendolari, nullatenenti) also show up as "feminine of" their singular
            listed_as_feminine = word in feminine_of and not word.endswith(EPICENE_SUFFIXES)
            if word.endswith(ALREADY_FEMININE_SUFFIXES) or listed_as_feminine:
                row.update(category="already_feminine", confidence="")
                if word in feminine_of:
                    row["evidence"] = "feminine of: " + ", ".join(sorted(feminine_of[word]))
                continue

            # (source, candidate) pairs, best source first
            candidates: list[tuple[str, str]] = []
            evidence = []
            sibling_by_pos = defaultdict(list)
            for sib in sibling_keys(word):
                for sib_pos, sib_entry in dictionary.get(sib, {}).items():
                    sib_fems = forms(sib_entry, "feminine")
                    derived = from_sibling(word, sib, sib_fems)
                    if derived:
                        sibling_by_pos[sib_pos].extend((sib, d) for d in derived)
                        evidence.append(f"sibling {sib} ({sib_pos}): {'/'.join(sib_fems)}")
            for sib_pos in ("noun", "adj", "verb"):
                candidates += [("sibling", d) for _, d in sibling_by_pos.get(sib_pos, [])]
            for other_pos, other_entry in by_pos.items():
                if other_pos != pos:
                    for f in forms(other_entry, "feminine"):
                        candidates.append(("other_pos", f))
                        evidence.append(f"other_pos {other_pos}: {f}")
            rule = from_rules(word)
            if rule:
                candidates.append(("rule", rule[0]))
                evidence.append(f"rule ({rule[1]}): {rule[0]}")

            row["evidence"] = "; ".join(evidence)
            if not candidates:
                row.update(category="unknown", confidence="")
                continue

            proposed = candidates[0][1]
            sources = {src for src, cand in candidates if cand == proposed}
            # a disagreeing suffix rule stays in the evidence column; only dictionary forms count as alternatives
            has_dictionary_evidence = any(src != "rule" for src, _ in candidates)
            alternatives = sorted({cand for src, cand in candidates
                                   if cand != proposed and (src != "rule" or not has_dictionary_evidence)})
            if len(sources) >= 2:
                confidence = "high"
            elif sources & {"sibling", "other_pos"}:
                confidence = "medium"
            else:
                confidence = "low"
            if alternatives and confidence == "high":
                confidence = "medium"
            row.update(
                category="epicene" if proposed == word else "has_feminine",
                confidence=confidence,
                proposed_feminine=proposed,
                final_feminine=proposed,
                note=("alternatives: " + ", ".join(alternatives)) if alternatives else "",
            )
    return rows


def write_review(rows: list[dict], path: Path) -> None:
    order = {"has_feminine": 0, "epicene": 1, "unknown": 2, "already_feminine": 3, "not_person": 4}
    conf = {"low": 0, "medium": 1, "high": 2, "": 3}
    rows = sorted(rows, key=lambda r: (order[r["category"]], conf[r["confidence"]], r["word"]))
    # utf-8-sig so that Excel shows accented letters correctly
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({c: row.get(c, "") for c in COLUMNS})


def apply_review(dictionary: dict, review_path: Path) -> int:
    """Fill empty feminine lists from `final_feminine` (several forms separated by '|')."""
    applied = 0
    with open(review_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            final = [x.strip() for x in row["final_feminine"].split("|") if x.strip()]
            entry = dictionary.get(row["word"], {}).get(row["pos"])
            if not final or entry is None or entry.get("feminine"):
                continue  # nothing to apply, or the entry was filled in the meantime
            entry["feminine"] = [{"form": form, "weight": 1} for form in final]
            applied += 1
    return applied


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dictionary", type=Path, default=DICTIONARY_PATH)
    sub = parser.add_subparsers(dest="command", required=True)
    p_annotate = sub.add_parser("annotate", help="write the review CSV")
    p_annotate.add_argument("--out", type=Path, default=REVIEW_PATH)
    p_apply = sub.add_parser("apply", help="write the reviewed forms into the dictionary")
    p_apply.add_argument("review", type=Path)
    p_apply.add_argument("--out", type=Path, default=ANNOTATED_PATH)
    p_apply.add_argument("--in-place", action="store_true", help="overwrite --dictionary")
    args = parser.parse_args()

    with open(args.dictionary, encoding="utf-8") as f:
        dictionary = json.load(f)

    if args.command == "annotate":
        rows = annotate(dictionary)
        write_review(rows, args.out)
        counts = defaultdict(int)
        for r in rows:
            counts[(r["category"], r["confidence"])] += 1
        print(f"{len(rows)} entries with an empty feminine list -> {args.out}")
        for (cat, conf), n in sorted(counts.items()):
            print(f"  {cat:17s} {conf or '-':7s} {n}")
    else:
        applied = apply_review(dictionary, args.review)
        out = args.dictionary if args.in_place else args.out
        with open(out, "w", encoding="utf-8") as f:
            json.dump(dictionary, f, ensure_ascii=False, indent=4)
        print(f"filled {applied} entries -> {out}")


if __name__ == "__main__":
    main()
