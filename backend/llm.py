import json
import re
from pathlib import Path
import torch
from dotenv import load_dotenv
from huggingface_hub import hf_hub_download
import logging
from models import Span, LLMOutput
from config import GENERATION_MODEL, DETECTION_CHAR_MAP
from openai import AsyncOpenAI
from prompt import PROMPT, STRATEGIES, INNOVATIVE_SYMBOLS_EXAMPLES
import uuid
logger = logging.getLogger(__name__)

# Words as the detection model saw them in training: "dell'università" -> "dell", "'", "università"
WORD_RE = re.compile(r"\w+|[^\w\s]+")

def load_char_table(model_id: str, token: str = None) -> dict:
    """Translation table from the "char_map" in the model's detection_config.json (local folder or hub repo),
    falling back to DETECTION_CHAR_MAP if it can't be read"""
    char_map = None
    try:
        path = Path(model_id) / "detection_config.json"
        if not path.exists():
            path = hf_hub_download(model_id, "detection_config.json", token=token)
        char_map = json.loads(Path(path).read_text(encoding="utf-8")).get("char_map")
    except Exception as e:
        logger.warning(f"Could not read detection_config.json of {model_id}: {e}")
    if not char_map:
        logger.warning("Using the default DETECTION_CHAR_MAP from config.py")
        char_map = DETECTION_CHAR_MAP
    return str.maketrans(char_map)

def word_windows(words: list[str], tokenizer, budget: int) -> list[tuple[int, int]]:
    """Consecutive (start, end) word ranges whose subwords fit in budget (greedy)"""
    sizes = [len(tokenizer.tokenize(w)) or 1 for w in words]
    windows, start = [], 0
    while start < len(sizes):
        end, total = start + 1, sizes[start]
        while end < len(sizes) and total + sizes[end] <= budget:
            total += sizes[end]
            end += 1
        windows.append((start, end))
        start = end
    return windows

def generate_new_span(text:str,start:int, end:int) -> Span:
    span = Span(
        span_id = str(uuid.uuid4()),
        start_char = int(start),
        end_char = int(end),
        tokens = [],
        original_text = "",
        reformulation = ""
    )
    span.tokens.append(text[start:end])
    return span

def detection(text: str, sent_tokenizer, tokenizer, detection_model, char_table: dict) -> list[Span]:
    try:
        # Sentence Tokenize text
        sentences_spans = list(sent_tokenizer.span_tokenize(text))

        # Max subwords per model input (special tokens excluded)
        max_length = min(tokenizer.model_max_length, detection_model.config.max_position_embeddings)
        budget = max_length - tokenizer.num_special_tokens_to_add(pair=False)

        spans = []

        for sent_start, sent_end in sentences_spans:
            # Split the sentence into words (with their char offsets in text)
            words = list(WORD_RE.finditer(text, sent_start, sent_end))
            if not words:
                continue
            # Same char map used in training (e.g. "ə" -> "*")
            words_text = [w.group().translate(char_table) for w in words]

            # One label per word ("O" or "UNFAIR"). Long sentences are cut into windows of whole words
            labels = ["O"] * len(words)
            for win_start, win_end in word_windows(words_text, tokenizer, budget):
                inputs = tokenizer(words_text[win_start:win_end], return_tensors="pt",
                                   truncation=True, max_length=max_length, is_split_into_words=True)

                # Disable gradient descent calculation
                with torch.no_grad():
                    outputs = detection_model(**inputs)

                # Convert logits to predicted labels
                predictions = torch.argmax(outputs.logits, dim=-1)[0]

                # The label of a word is read on its first subword
                previous = None
                for position, w in enumerate(inputs.word_ids(0)):
                    if w is not None and w != previous:
                        labels[win_start + w] = detection_model.config.id2label[predictions[position].item()]
                    previous = w

            # A span is a run of consecutive words labelled UNFAIR
            building_span = False
            for word, label in zip(words, labels):
                if label != "O":
                    if building_span:
                        # Extend the current span
                        curr_span = spans[-1]
                        curr_span.end_char = word.end()
                        curr_span.tokens.append(word.group())
                    else:
                        # Create new span
                        spans.append(generate_new_span(text, word.start(), word.end()))
                        building_span = True
                else:
                    building_span = False
         # update the original text field
        for span in spans:
            span.original_text = text[span.start_char:span.end_char]
        return spans
    except Exception as e:
         logger.exception(f"Detection failed with error: {e}")
         raise Exception(f"Text analysis failed: {str(e)}")

async def generation(text: str, spans:list[Span], strategy: str, client: AsyncOpenAI) -> list[Span]:
    if not spans:
        return []
    # Get the span id and the text. Span indices refer to the original text, not to the
    # anonymized text passed here, so use the span's stored original text instead of slicing
    spans_text = [{span.span_id: span.original_text} for span in spans]
    prompt = ""
    strat_type, ref_option = strategy.split("-")
    ref_option = int(ref_option)
    # TODO: Adjust to have one prompt for CO and one to check mistakes for CV, IV, and IO
    if strat_type in ["IO"]:
        if 0 <= ref_option < len(INNOVATIVE_SYMBOLS_EXAMPLES):
            symbol = INNOVATIVE_SYMBOLS_EXAMPLES[ref_option]
            strategy_example = STRATEGIES[strat_type].format(symbol= symbol)
            prompt = PROMPT.format(text = text, spans=spans_text, reformulation_strategy= strategy_example)
    else:
        prompt = PROMPT.format(text=text, spans=spans_text, reformulation_strategy= STRATEGIES[strat_type][ref_option])
    
    if prompt != "":
        try:
            response = await client.chat.completions.create(
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
            logger.exception(f"Generation failed with error: {e}")
            raise Exception(f"LLM provider unavailable or timeout: {str(e)}")
    else:
        return spans