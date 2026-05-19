from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_analyzer import Pattern, PatternRecognizer

# checks for all entities
ENTITIES = None


def make_placeholder(
    entity_type: str, original: str, mapping: dict, counters: dict
) -> str:
    counters[entity_type] = counters.get(entity_type, 0) + 1
    placeholder = f"[{entity_type}_{counters[entity_type]}]"
    mapping[placeholder] = original
    return placeholder


def anonymize(text: str) -> tuple[str, dict]:
    """Returns anonymized text and a mapping {placeholder: original}."""
    results = analyzer.analyze(text=text, language="it", entities=ENTITIES)

    results = remove_overlaps(results)

    mapping = {}  # placeholder -> original
    counters = {}  # entity_type -> count

    active_entities = (
        ENTITIES if ENTITIES is not None else list({r.entity_type for r in results})
    )

    operators = {
        entity: OperatorConfig(
            "custom",
            {"lambda": lambda t, e=entity: make_placeholder(e, t, mapping, counters)},
        )
        for entity in active_entities
    }

    anon_result = anonymizer.anonymize(
        text=text, analyzer_results=results, operators=operators
    )
    return anon_result.text, mapping


def remove_overlaps(results):
    """Quando vengono identificati due diversi identificativi sovrapposti,
    mantenerne solo uno, il più probabile"""
    results = sorted(results, key=lambda r: r.score, reverse=True)
    kept = []
    for r in results:
        if not any(r.start < k.end and r.end > k.start for k in kept):
            kept.append(r)
    return sorted(kept, key=lambda r: r.start)


def deanonymize(text: str, mapping: dict, spans: list = None) -> tuple[str, list]:
    """Deanonymize text and adjust span indices accordingly.

    Args:
        text: The anonymized text
        mapping: Dict mapping placeholders to original values
        spans: Optional list of Span objects with start_char and end_char indices

    Returns:
        A tuple of (deanonymized_text, adjusted_spans)
    """
    # Sort placeholders by position in text (reverse) to avoid index shifting issues
    # Find all placeholder positions
    positions = []
    for placeholder in mapping.keys():
        start = 0
        while True:
            pos = text.find(placeholder, start)
            if pos == -1:
                break
            positions.append((pos, placeholder))
            start = pos + 1

    # Sort by position in reverse order so we replace from end to start
    positions.sort(reverse=True)

    # Track character shift for each position
    char_shift = 0
    shifts = {}  # Maps original placeholder positions to character shifts

    for pos, placeholder in positions:
        original = mapping[placeholder]
        shift = len(original) - len(placeholder)
        shifts[pos] = shift
        char_shift += shift

    # Apply replacements (from end to start to preserve indices)
    for pos, placeholder in positions:
        original = mapping[placeholder]
        text = text[:pos] + original + text[pos + len(placeholder) :]

    # Adjust span indices if provided
    adjusted_spans = []
    if spans:
        for span in spans:
            adjusted_span = (
                span.copy(deep=True) if hasattr(span, "copy") else span.__dict__.copy()
            )

            # Calculate cumulative shift up to start_char
            cumulative_shift = 0
            for shift_pos in sorted(shifts.keys()):
                if shift_pos < span.start_char:
                    cumulative_shift += shifts[shift_pos]
                else:
                    break

            # Apply shift to both start and end
            adjusted_span.start_char = span.start_char + cumulative_shift
            adjusted_span.end_char = span.end_char + cumulative_shift

            adjusted_spans.append(adjusted_span)

    return text, adjusted_spans


# Global instances - initialized by setup_presidio()
analyzer = None
anonymizer = None


def setup_presidio():
    """
    Must be called before using anonymize() or process_text().
    """
    global analyzer, anonymizer

    provider = NlpEngineProvider(
        nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "it", "model_name": "it_core_news_lg"}],
        }
    )

    analyzer = AnalyzerEngine(
        nlp_engine=provider.create_engine(), supported_languages=["it"]
    )

    add_custom_recognizers(analyzer)
    anonymizer = AnonymizerEngine()

    print("Presidio Analyzer initialized with Italian language support.")


def add_custom_recognizers(analyzer: AnalyzerEngine):
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="CREDIT_CARD",
            supported_language="it",
            patterns=[
                Pattern(
                    name="credit_card_it",
                    regex=r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b",
                    score=0.5,
                )
            ],
        )
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="IBAN_CODE",
            supported_language="it",
            patterns=[
                Pattern(
                    name="iban_it",
                    # IT + 2 check digits + 1 CIN letter + 22 digits (ABI+CAB+account), allowing separators anywhere.
                    regex=r"(?i)\b[A-Z]{2}[ \t-]*\d{2}[ \t-]*[A-Z](?:[ \t-]*\d){21,22}\b(?=\r?\n|$)",
                    score=0.85,
                )
            ],
        )
    )


def process_text(text: str) -> tuple[str, dict]:
    anon, mapping = anonymize(text)
    return anon, mapping


if __name__ == "__main__":
    setup_presidio()

    email = """Gentile Marco Rossi,
    la contatto da parte del Professor Giuseppe Verdi dell'Università di Torino.
    Può scriverci a segreteria@unito.it oppure chiamare il +39 011 123456.
    Cordiali saluti"""

    anon, mapping = anonymize(email)
    print("=== ANONYMIZED ===")
    print(anon)
    print("\n=== MAPPING ===")
    print(mapping)

    # Qui avverrebbero le ulteriori lavorazioni nel backend
    processed = anon

    restored = deanonymize(processed, mapping)
    print("\n=== RESTORED ===")
    print(restored)
