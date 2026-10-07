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
_TOKEN_RE = re.compile(r"\w+|\W+")

def rule_based_rewrite(span_text, lookup, strat_type, ref_option, symbol="*"):
    if lookup.is_empty:
        return span_text
    if strat_type == "CO":
        return None

    lead, core, trail = _PUNCT_RE.match(span_text).groups()

    # (masc, fem, neu) per token; separators are identical in all three forms
    forms = [
        _word_forms(t, lookup, symbol) if t[0].isalnum() or t[0] == "_" else (t, t, t)
        for t in _TOKEN_RE.findall(core)
    ]
    masc = "".join(f[0] for f in forms)
    fem = "".join(f[1] for f in forms)
    neu = "".join(f[2] for f in forms)

    if strat_type == "CV":
        out = f"{masc} e {fem}" if ref_option == 0 else \
              "".join("/".join(dict.fromkeys(f[:2])) for f in forms)
    elif strat_type == "IO":
        out = neu
    elif strat_type == "IV":
        out = f"{masc}, {fem} e {neu}" if ref_option == 0 else \
              "".join("/".join(dict.fromkeys(f)) for f in forms)
    else:
        return None

    return f"{lead}{out}{trail}"