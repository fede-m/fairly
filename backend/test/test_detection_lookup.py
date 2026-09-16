import spacy
import os, sys
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(parent_dir)
# suppress presidio logging
import logging
logging.getLogger("presidio-analyzer").disabled = True
logging.getLogger("presidio").disabled = True
logging.getLogger("presidio-anonymizer").disabled = True
from main import lookup_span
from llm import detection
from models import (
    LookupFlag
)

nlp = spacy.load("it_core_news_lg")

def load_emails(filepath: str) -> list[str]:
    """Load emails from file, split by blank lines."""
    with open(filepath) as f:
        content = f.read()
    emails = [e.strip() for e in content.split("\n\n") if e.strip()]
    return emails


def test_detection_and_lookup():
    emails = load_emails("test/emails_test.txt")
    
    for i, email_text in enumerate(emails, 1):
        print(f"\n{'='*60}")
        print(f"Email {i}:")
        print(f"{'='*60}")
        print(email_text)
        print()
        
        # Detection
        detected_spans = detection(email_text)
        print(f"Detected {len(detected_spans)} spans:")
        for span in detected_spans:
            print(f"  [{span.start_char}:{span.end_char}] {email_text[span.start_char:span.end_char]!r}")
            
        doc = nlp(email_text)
        for span in detected_spans:
            lookup_data = lookup_span(doc, span.start_char, span.end_char)
            span_text = doc.text[span.start_char:span.end_char] 
            
            print(f"  Lookup [{span.start_char}:{span.end_char}] -> '{span_text}'")
            
            if lookup_data.is_empty:
                print("    Result: EMPTY")
                continue

            # Evaluate the global flag status for the span.
            # It activates if ANY token triggered NON_INFLECTABLE_POS or INFLECTABLE_MISS.
            status = "ATTIVA" if lookup_data.has_flag else "NO"
            
            print(f"    Prompt Flag: {status}")
            
            for word, res in lookup_data.results.items():
                print(f"    - Word: '{word}' | Lemma: '{res.lemma}' | POS: {res.pos} | Status: {res.flag.name}")
                
                if res.flag == LookupFlag.OK:
                    fem = [f"{v.form}({v.weight})" for v in res.variants.feminine]
                    neu = [f"{v.form}({v.weight})" for v in res.variants.neutral]
                    
                    if fem:
                        print(f"      Feminine: {', '.join(fem)}")
                    if neu:
                        print(f"      Neutral:  {', '.join(neu)}")
                    if not fem and not neu:
                        print("      Variants: None")


if __name__ == "__main__":
    test_detection_and_lookup()