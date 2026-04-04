from transformers import AutoTokenizer, AutoModelForTokenClassification
from pydantic import parse_obj_as
import torch
import nltk
import os
import json
from dotenv import load_dotenv
from models import Span, LLMOutput
from config import DETECTION_MODEL, TOKENIZER_MODEL, GENERATION_MODEL
from prompt import PROMPT, STRATEGIES, INNOVATIVE_SYMBOLS_EXAMPLES
from groq import Groq
import instructor
import requests
from openai import OpenAI

load_dotenv()

HUGGINFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")

# Load models for detection
sentence_tokenizer = nltk.tokenize.punkt.PunktSentenceTokenizer()
tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_MODEL, token = HUGGINFACE_TOKEN)
model = AutoModelForTokenClassification.from_pretrained(DETECTION_MODEL, token = HUGGINFACE_TOKEN)

# Set up API for generation models
# client = Groq(api_key= os.getenv("GROQ_API_KEY"))

# # Enable instructor for Groq client
# client = instructor.from_provider(GENERATION_MODEL)

client = OpenAI(
    base_url = os.getenv("HPC4AI_URL", ""),
    api_key = os.getenv("OPENWEB_API", "")
)

client = instructor.patch(client, mode = instructor.Mode.JSON)


def generate_new_span(text:str,start:int, end:int):
    span = Span(
        span_id = "",
        start_char = int(start),
        end_char = int(end),
        tokens = [],
        reformulation = ""
    )
    span.tokens.append(text[start:end])
    return span

def detection(text: str) -> list[Span]:

    # Sentence Tokenize text
    sentences_spans = list(sentence_tokenizer.span_tokenize(text))
    sentences = [text[start: end] for (start, end) in sentences_spans]

    spans = []

    for span_sent, sent in zip(sentences_spans,sentences):
        # Tokenize and get input for model
        inputs = tokenizer(sent, return_tensors="pt", return_offsets_mapping= True, truncation = True, is_split_into_words = False)
        
        # Contain tuples (start_char, end_char for each token in the original sentence)
        offsets = inputs.pop("offset_mapping")[:,1:-1,:]

        # Disable gradient descent calculation
        with torch.no_grad():
            outputs = model(**inputs)
        
        # Convert logits to predicted labels
        predictions = torch.argmax(outputs.logits, dim=-1)

        # Map IDs to class labels
        predicted_labels = [model.config.id2label[i.item()] for i in predictions[0][1:-1]]

        # Keep track on whether a span is being constructed. This prevents having spans which do not start with a B-UNFAIR but just have I-UNFAIR
        building_span = False
        for i,label in enumerate(predicted_labels):
            start = span_sent[0] + offsets[0][i][0]
            end = span_sent[0] + offsets[0][i][1]
            if label == "B-UNFAIR":
                # Create new span
                new_span = generate_new_span(text, start, end)
                spans.append(new_span)
                building_span = True

            elif label == "I-UNFAIR":
                if building_span:
                    # Grab the last span to update it
                    curr_span = spans[-1]
                    # Update end char position
                    curr_span.end_char = int(end)
                    # Add current tokens
                    curr_span.tokens.append(text[start:end])
                else:
                    print(f"Span does not start with B-UNFAIR: {text[start:end]}")
                    new_span = generate_new_span(text, start, end)
                    spans.append(new_span)
                    building_span = True
            else:
                building_span = False 

    # Add unique id to each span   
    for span in spans:
        span.span_id = f"{span.start_char}_{span.end_char}"
    return spans

def generation(text: str, spans:list[Span], strategy: str):
    if not spans:
        return []
    # Get the span id and the text
    spans_text = [{span.span_id: text[span.start_char:span.end_char]} for span in spans]
    prompt = ""
    strat_type, ref_option = strategy.split("-")
    ref_option = int(ref_option)
    if strat_type in ["IO"]:
        if 0 <= ref_option < len(INNOVATIVE_SYMBOLS_EXAMPLES):
            symbol = INNOVATIVE_SYMBOLS_EXAMPLES[ref_option][0]
            example = INNOVATIVE_SYMBOLS_EXAMPLES[ref_option][1]
            strategy_example = STRATEGIES[strat_type].format(symbol= symbol, example=example)
            prompt = PROMPT.format(text = text, spans=spans_text, reformulation_strategy= strategy_example)
    else:
        prompt = PROMPT.format(text=text, spans=spans_text, reformulation_strategy= STRATEGIES[strat_type][ref_option])
    
    if prompt != "":
        try:
            response = client.chat.completions.create(
                model = GENERATION_MODEL,
                messages=[
                    {"role":"user", "content": prompt}
                ],
                response_model = LLMOutput,
            )

            id2span = {span.span_id: span for span in spans}
            reformulated_spans = []
            for r in response.result:
                if r.span_id in id2span:
                    span = id2span[r.span_id]
                    span.reformulation = r.reformulation
                    reformulated_spans.append(span)

            return reformulated_spans
        except Exception as e:
            print(f"The following exception occurred: {e}")
            return spans
    else:
        return spans