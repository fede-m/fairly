from transformers import AutoTokenizer, AutoModelForTokenClassification
import asyncio
import torch
import httpx
import nltk
import os
from dotenv import load_dotenv
import logging
from models import Span, LLMOutput
from config import GENERATION_MODEL
from prompt import PROMPT, STRATEGIES, INNOVATIVE_SYMBOLS_EXAMPLES
from openai import AsyncOpenAI, APITimeoutError
import uuid
import instructor
import time
logger = logging.getLogger(__name__)

# Max concurrent LLM calls: extra requests wait in line instead of overloading the provider
LLM_SEMAPHORE = asyncio.Semaphore(4)
# Seconds the model stays warm after a successful answer (5 minutes, count 4 minutes to catch it before it is unloaded from GPU)
WARM_TTL_S = 240
# time.monotonic() of the last successful LLM answer (0.0 = never)
_last_llm_ok = 0.0
# Handle to the running warmup task, if any
_warmup_task: asyncio.Task | None = None

def make_clients() -> tuple[AsyncOpenAI, AsyncOpenAI]:
    base_url = os.getenv("HPC4AI_URL", "")
    api_key = os.getenv("OPENWEB_API", "")

    # Generation client: fail fast so the user does not need to wait for long
    generation_client = AsyncOpenAI(
        base_url = base_url,
        api_key = api_key,
        timeout= httpx.Timeout(10.0, connect=5.0),
        max_retries=1,
    )
    generation_client = instructor.patch(
        generation_client, 
        mode = instructor.Mode.JSON
    )

    # Warm-up client: wakes the model on HPC4AI and waits for it to load
    warmup_client =  AsyncOpenAI(
        base_url = base_url,
        api_key = api_key,
        timeout= 300.0,
        max_retries=0,
    )
    return generation_client, warmup_client

async def _warmup(warmup_client: AsyncOpenAI) -> None:
    global _last_llm_ok
    start = time.monotonic()
    try:
        await warmup_client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        _last_llm_ok = time.monotonic()
        logger.info("LLM warmup succeeded after %.1fs", _last_llm_ok - start)
    except Exception as e:
        logger.warning("LLM warmup failed after %.1fs: %s", time.monotonic() - start, e)

def maybe_warmup(warmup_client: AsyncOpenAI) -> bool:
    global _warmup_task
    if time.monotonic() - _last_llm_ok < WARM_TTL_S:
        return False
    if _warmup_task is not None and not _warmup_task.done():
        return False
    _warmup_task = asyncio.create_task(_warmup(warmup_client))
    return True

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

def detection(text: str, sent_tokenizer, tokenizer, detection_model) -> list[Span]:
    try:
        # Sentence Tokenize text
        sentences_spans = list(sent_tokenizer.span_tokenize(text))
        sentences = [text[start: end] for (start, end) in sentences_spans]

        spans = []

        for span_sent, sent in zip(sentences_spans,sentences):
            # Tokenize and get input for model
            inputs = tokenizer(sent, return_tensors="pt", return_offsets_mapping= True, truncation = True, is_split_into_words = False)
            
            # Contain tuples (start_char, end_char for each token in the original sentence)
            offsets = inputs.pop("offset_mapping")[:,1:-1,:]

            # Disable gradient descent calculation
            with torch.no_grad():
                outputs = detection_model(**inputs)
            
            # Convert logits to predicted labels
            predictions = torch.argmax(outputs.logits, dim=-1)

            # Map IDs to class labels
            predicted_labels = [detection_model.config.id2label[i.item()] for i in predictions[0][1:-1]]

            # Keep track on whether a span is being constructed. This prevents having spans which do not start with a B-UNFAIR but just have I-UNFAIR
            building_span = False
            for i,label in enumerate(predicted_labels):
                start = span_sent[0] + offsets[0][i][0]
                end = span_sent[0] + offsets[0][i][1]
                if label == "B-UNFAIR" and building_span and text[spans[-1].end_char:start].strip() == "":
                    # The model often tags each word of a phrase as B-UNFAIR: extend the adjacent span instead of splitting it
                    curr_span = spans[-1]
                    curr_span.end_char = int(end)
                    curr_span.tokens.append(text[start:end])

                elif label == "B-UNFAIR":
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
                        logger.warning(f"Span does not start with B-UNFAIR: {text[start:end]}")
                        new_span = generate_new_span(text, start, end)
                        spans.append(new_span)
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

class LLMWarmingUp(Exception):
    """Dedicated exception for when the model does not answer on time due to a cold-starting problem."""

async def generation(text: str, spans:list[Span], strategy: str, client: AsyncOpenAI) -> list[Span]:
    global _last_llm_ok
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
            async with LLM_SEMAPHORE:
                # Start the clock after acquiring the permit: we want the call latency, not the queue wait
                start = time.monotonic()
                response = await client.chat.completions.create(
                    model = GENERATION_MODEL,
                    messages=[
                        {"role":"user", "content": prompt}
                    ],
                    response_model = LLMOutput,
                )
            _last_llm_ok = time.monotonic()
            logger.info("LLM generation took %.2fs", _last_llm_ok - start)

            id2span = {span.span_id: span for span in spans}
            reformulated_spans = []
            for r in response.result:
                if r.span_id in id2span:
                    span = id2span[r.span_id]
                    span.reformulation = r.reformulation
                    reformulated_spans.append(span)

            return reformulated_spans
        except APITimeoutError as e:
            logger.warning("LLM timed out, the model is probably cold and need to be loaded on the provider side: %s", e)
            raise LLMWarmingUp() from e
        except Exception as e:
            logger.exception(f"Generation failed with error: {e}")
            raise Exception(f"LLM provider unavailable or timeout: {str(e)}")
    else:
        return spans