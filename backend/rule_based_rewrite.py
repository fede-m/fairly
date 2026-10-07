from models import SpanLookupResults, LookupResult, LookupFlag, FormVariant, MorphoVariants
import re

def _best(variants: list[FormVariant]) -> str | None:
    return max(variants, key=lambda v: v.weight).form if variants else None


def _word_forms(word: str, lookup: SpanLookupResults, symbol: str) -> tuple[str, str, str]:
    """(masculine, feminine, neutral) for one word. Unknown/non-inflectable words stay unchanged."""
    r = lookup.results.get(word)
    if r is None or r.flag != LookupFlag.OK:
        return word, word, word
    fem = _best(r.variants.feminine) or word
    neu = (_best(r.variants.neutral) or word).replace("<NEOM>", symbol)
    return word, fem, neu


_PUNCT_RE = re.compile(r"^(\W*)(.*?)(\W*)$", re.S)

def rule_based_rewrite(span_text, lookup, strat_type, ref_option, symbol="*"):
    if strat_type == "CO" or lookup.is_empty:
        return None

    lead, core, trail = _PUNCT_RE.match(span_text).groups()
    forms = [_word_forms(w, lookup, symbol) for w in core.split()]
    masc = " ".join(f[0] for f in forms)
    fem = " ".join(f[1] for f in forms)
    neu = " ".join(f[2] for f in forms)

    if strat_type == "CV":
        out = f"{masc} e {fem}" if ref_option == 0 else \
              " ".join("/".join(dict.fromkeys(f[:2])) for f in forms)
    elif strat_type == "IO":
        out = neu
    elif strat_type == "IV":
        out = f"{masc}, {fem} e {neu}" if ref_option == 0 else \
              " ".join("/".join(dict.fromkeys(f)) for f in forms)
    else:
        return None

    return f"{lead}{out}{trail}"