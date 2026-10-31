from models import Span, SpanLookupResult, LookupResult, FormDict, GenderFormVariants
from prompt import INNOVATIVE_SYMBOLS_EXAMPLES 
import json
from pathlib import Path
import logging
from spacy import tokens, language
logger = logging.getLogger(__name__)

# -- reading of the .json lookup table for morphosyntactic rewrites -------
dictionary_path = Path(__file__).resolve().parent / "dictionary.json"

with dictionary_path.open(encoding="utf-8") as f:
    LOOKUP_TABLE: dict = json.load(f)

GENDERED_POS_MAPPING = {
    "noun": "noun", 
    "adj": "adj", 
    "verb": "verb", 
    "aux": "verb", 
    "det": "det", 
    "adp": "det", 
    "pron": "pron"
}

IGNORED_POS = {"punct", "space", "sym"}
# UNFLECTABLE_POS = {"adv", "cconj", "sconj", "intj", "adp", "punct", "sym"}

STRATEGIES_MAPPING = {
    "CV": ["feminine"],
    "IO": ["neutral"],
    "IV": ["feminine", "neutral"]
}

def _best(variants: list[FormDict]) -> str | None:
    return max(variants, key=lambda v: v.weight).form if variants else None

def lookup(word: str, pos: str, genders: list[str]) -> GenderFormVariants | None:
    """Return the best requested gendered forms for a word."""
    if not word or not genders:
        return None

    entry = LOOKUP_TABLE.get(word.lower())
    if entry is None:
        logger.warning(f"Word {word} not found in the dictionary!")
        return None
    
    # Map spacy POS with the dictionary POS
    mapped_pos = GENDERED_POS_MAPPING.get(pos.lower())
    if not mapped_pos:
        logger.warning(f"Pos {pos} not found in gendered pos!")
        return None

    gender_forms = entry.get(mapped_pos)
    if not gender_forms:
        logger.warning(f"Pos {pos} not found for word {word}!")
        return None

    form_variants: dict[str, list[FormDict]] = {}
    for gender in genders:
        if gender not in {"feminine", "neutral"}:
            logger.warning(f"Unsupported gender {gender} requested for {word}")
            return None

        variants = gender_forms.get(gender)
        if not variants:
            logger.warning(f"No {gender} forms found for {word}")
            return None

        form_variants[gender] = [
            FormDict.model_validate(variant) for variant in variants
        ]

    selected_forms: dict[str, str] = {}
    for gender, variants in form_variants.items():
        form = _best(variants)
        if form is None:
            logger.warning(f"No valid {gender} forms found for {word}")
            return None
        selected_forms[gender] = (
            form.capitalize() if word[0].isupper() else form
        )

    return GenderFormVariants(
        feminine=selected_forms.get("feminine"),
        neutral=selected_forms.get("neutral"),
    )

def combine_forms(nlp, masc, fem, preference, sing=True):
    conjunction = "o" if sing else "e"

    masc_text = "".join(t.text + t.whitespace_ for t in masc).rstrip()
    fem_text = "".join(fem).rstrip()
    trailing_space = masc[-1].whitespace_ if masc else ""
    if preference == "feminine":
        # Remove capitalisation to masc form
        masc_lower = masc_text[:1].lower() + masc_text[1:]
        sent = f"{fem_text} {conjunction} {masc_lower}"
    else:
        # Remove capitalisation to fem form
        fem_lower = fem_text[:1].lower() + fem_text[1:]
        sent = f"{masc_text} {conjunction} {fem_lower}"
    sent += trailing_space
    return list(nlp(sent))

def handle_cv_long(nlp: language.Language, nlp_span: tokens.Span, forms: SpanLookupResult, gender_precedence: str) -> str:
    output = []
    curr_masc = []
    curr_fem = []
    for token_m in nlp_span:
        word = token_m.text
        morph = token_m.morph.to_dict()
        feminine = forms.results[word].form.feminine
        # Preserve the original token's whitespace in the feminine version.
        token_f = feminine + (token_m.whitespace_ if not feminine.endswith("'") else "")
        if feminine != word:
            curr_masc.append(token_m)
            curr_fem.append(token_f)
        else:
            if curr_masc and curr_fem:
                sing = any(
                    token.morph.get("Number") == ["Sing"]
                    for token in curr_masc
                )
                output.extend(combine_forms(nlp, curr_masc, curr_fem, gender_precedence, sing))
                curr_masc = []
                curr_fem = []
            output.append(token_m)
    # Flush any remaining changed tokens after the loop.
    if curr_masc and curr_fem:
        sing = any(
            token.morph.get("Number") == ["Sing"]
            for token in curr_masc
        )
        output.extend(
            combine_forms(
                nlp,
                curr_masc,
                curr_fem,
                gender_precedence,
                sing
            )
        )
    return "".join(t.text + t.whitespace_ for t in output).strip()

def handle_cv_bars(nlp_span: tokens.Span, forms: SpanLookupResult, gender_precedence: str):
    output = []
    for token_m in nlp_span:
        word = token_m.text
        fem = forms.results[word].form.feminine
        if fem != word:
            token = f"{fem}/{word}" if gender_precedence == "feminine" else f"{word}/{fem}"
            token += token_m.whitespace_
            output.append(token)
        else:
            token = word + token_m.whitespace_
            output.append(token)
    
    return "".join(t for t in output).strip() 

def handle_io(nlp_span: tokens.Span, forms: SpanLookupResult, rew_type: int) -> str:
    if 0 <= rew_type < len(INNOVATIVE_SYMBOLS_EXAMPLES):
        symbol = INNOVATIVE_SYMBOLS_EXAMPLES[rew_type]
    else:
        symbol = INNOVATIVE_SYMBOLS_EXAMPLES[0]
    output = []
    for token_m in nlp_span:
        word = token_m.text
        neut = forms.results[word].form.neutral
        if neut != word:
            whitespace = " " if neut.endswith(("<ENDS>", "<ENDP>")) else token_m.whitespace_
            token = neut + whitespace
            output.append(token)
        else:
            token = word + token_m.whitespace_
            output.append(token)
    
    return "".join(t for t in output).strip().replace("<ENDS>", symbol).replace("<ends>", symbol).replace("<ENDP>", symbol).replace("<endp>", symbol)
                    

def handle_iv(nlp_span: tokens.Span, forms: SpanLookupResult, symbol: str, gender_precedence: str):
    output = []
    for token_m in nlp_span:
        word = token_m.text
        fem = forms.results[word].form.feminine
        neut = forms.results[word].form.neutral
        token = ""
        # Handle feminine
        if word != fem:
            token += f"{fem}/{word}" if gender_precedence == "feminine" else f"{word}/{fem}"
        else:
            token += word

        # Handle neutral
        if word != neut:
            token += f"/{neut}"

        token += token_m.whitespace_
        output.append(token)
    return "".join(t for t in output).strip().replace("<ENDS>", symbol).replace("<ends>", symbol).replace("<ENDP>", symbol).replace("<endp>", symbol)


def rewrite(nlp: language.Language, nlp_span: tokens.Span, forms: SpanLookupResult, strategy: str, rew_type: str, gender_precedence: str | None):
    # Randomly sample whether to put feminine or masculine first
    if strategy == "CV":
        if rew_type == "0":
            return handle_cv_long(nlp, nlp_span, forms, gender_precedence)
        if rew_type == "1":
            return handle_cv_bars(nlp_span, forms, gender_precedence)
        
    if strategy == "IO":
        return handle_io(nlp_span, forms, int(rew_type))
    if strategy == "IV":
        return handle_iv(nlp_span, forms, "*", gender_precedence)

def lookup_span_forms(nlp_span: tokens.Span, strategy: str) -> SpanLookupResult | None:
    results = {}
    genders = STRATEGIES_MAPPING[strategy]
    for token in nlp_span:
        word = token.text
        pos = token.pos_.lower()
        form = GenderFormVariants(
            feminine=word if "feminine" in genders else None,
            neutral=word if "neutral" in genders else None
        )

        if pos in GENDERED_POS_MAPPING:
            morph = token.morph.to_dict()
            is_non_participial_verb = (
                pos in ["verb", "aux"]
                and str(morph.get("VerbForm", "")).lower()
                != "part"
            )
            is_not_masculine = (
                pos == "noun"
                and str(morph.get("Gender", "")).lower()
                != "masc"
            )

            if not is_non_participial_verb and not is_not_masculine:
                form = lookup(word, pos, genders)
                if form is None:
                    return None

        results[word] = LookupResult(
            pos=pos,
            form=form,
            changed= any(
                candidate is not None and candidate != word
                for candidate in (form.feminine, form.neutral)
            )
        )
    return SpanLookupResult(
        results=results
    )


def dictionary_based_rewrite(nlp: language.Language, text: str, span: Span, strategy: str, gender_preference: str | None) -> Span | None:
    doc = nlp(text)
    if len(strategy.split("-")) > 1:
        strategy, rew_type = strategy.split("-")
    # Double check (should not be the case)
    if strategy == "CO":
        return None

    # Step 1: execute lookup
    # Result: every word/token in the span text will be mapped to the corresponding feminine/neutral form
    nlp_span = doc.char_span(span.start_char, span.end_char, alignment_mode="expand")
    if nlp_span is None or len(nlp_span) == 0:
        return None
    span_forms = lookup_span_forms(nlp_span, strategy)
    logger.info(span_forms)
    if span_forms is None:
        return None
    # Step 2: apply rewriting
    rewriting = rewrite(nlp, nlp_span, span_forms, strategy, rew_type, gender_preference)
    span.reformulation = rewriting
    return span
