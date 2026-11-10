"""Run the backend detection on the sentences in SENTENCES and print the detected spans.

    cd backend
    uv run python test/test_detection.py               # model from config.DETECTION_MODEL (hub)
    uv run python test/test_detection.py ../model      # or a local model folder
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # backend/

import nltk
from dotenv import load_dotenv
from transformers import AutoModelForTokenClassification, AutoTokenizer

from config import DETECTION_MODEL
from llm import detection, load_char_table

SENTENCES = [
    "Gli studenti devono iscriversi entro lunedì.",
    "Il direttore ha firmato il documento dell'università.",
    "Caro collega, i professori e lə ricercatorə sono invitati alla riunione.",
    "Le persone iscritte riceveranno una mail.",
    "Le persone iscritte riceveranno una mail." + ("a "*1000) + " Gli studenti devono iscriversi entro lunedì." + ("a "*1000) + "Caro collega, i professori e lə ricercatorə sono invitati alla riunione." ,
]


def main():
    load_dotenv()
    token = os.getenv("HUGGINGFACE_TOKEN")
    model_id = sys.argv[1] if len(sys.argv) > 1 else DETECTION_MODEL

    sent_tokenizer = nltk.tokenize.punkt.PunktSentenceTokenizer()
    tokenizer = AutoTokenizer.from_pretrained(model_id, token=token)
    model = AutoModelForTokenClassification.from_pretrained(model_id, token=token).eval()
    char_table = load_char_table(model_id, token=token)

    for text in SENTENCES:
        spans = detection(text, sent_tokenizer, tokenizer, model, char_table)
        print(text)
        for span in spans:
            print(f"  [{span.start_char}:{span.end_char}] {span.original_text!r}")
        if not spans:
            print("  (no spans)")
        print()


if __name__ == "__main__":
    main()
