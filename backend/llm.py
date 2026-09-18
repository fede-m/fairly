from transformers import AutoTokenizer, AutoModelForTokenClassification
import torch
import nltk
import os
from dotenv import load_dotenv
import logging
from models import Span, LLMOutput, MultipleSpanLookupResults, SpanDict
from config import DETECTION_MODEL, TOKENIZER_MODEL, GENERATION_MODEL
from prompt import PROMPT, PROMPT_UNCERTAIN, STRATEGIES, INNOVATIVE_SYMBOLS_EXAMPLES
import instructor
from openai import AsyncOpenAI
import uuid
logger = logging.getLogger(__name__)
load_dotenv()

HUGGINFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")

# Load models for detection
sentence_tokenizer = nltk.tokenize.punkt.PunktSentenceTokenizer()
model = AutoModelForTokenClassification.from_pretrained(DETECTION_MODEL, token = HUGGINFACE_TOKEN)
tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_MODEL, token = HUGGINFACE_TOKEN)

# Setup client
client = AsyncOpenAI(
    base_url = os.getenv("HPC4AI_URL", ""),
    api_key = os.getenv("OPENWEB_API", ""),
    timeout= 35.0
)

client = instructor.patch(client, mode = instructor.Mode.JSON)

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

def detection(text: str) -> list[Span]:
    try:
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

async def generation(text: str, spans:list[Span], strategy: str, lookup_results: MultipleSpanLookupResults) -> list[Span]:
    if not spans:
        return []
    prompt = ""
    strat_type, ref_option = strategy.split("-")
    ref_option = int(ref_option)
    # initialize the span dict to easily handle keys comparisons
    spans_dict = SpanDict.from_list(spans)
    spans_ids = spans_dict.key_list
    assert set(spans_ids) == set(lookup_results.key_list)
    
    # all spans are sent once, so one flag is enough to trigger the new prompt
    # or we could decide additional logic
    # if strategy in ["CV","IO","IV"]
    # i) looping through lookup_results, if one detected span has all tokens found in the lookup
    #    the rewrite is then automatic
    # ii) flags are used for a change in prompt
    # if strategy == "CO"
    # i) flags are used for a change in prompt
    
    rulebased_reformulated_spans = {}
    prompt_flag = False
    for id in spans_ids:
      if not lookup_results[id].has_flag():
        if strat_type in ["CV", "IO", "IV"]:
          # all tokens in the span are a lookup hit
          span = spans_dict[id]
          span.reformulation = "Easy rewrite for " + span.original_text
          rulebased_reformulated_spans[id] = span
          # later it will be merged with the llm reformulations
      else:
        # prompt will reflect the uncertainty
        prompt_flag = True
              
    # TODO add log for percentage of rule based rewrites
    
    # Get id and content of spans that were not reformulated with rules
    spans_text = [{span.span_id: span.original_text} for span in spans if span.span_id not in rulebased_reformulated_spans]
    
    machine_reformulated_spans = []
    if spans_text:
      if strat_type in ["IO"]:
          if 0 <= ref_option < len(INNOVATIVE_SYMBOLS_EXAMPLES):
              symbol = INNOVATIVE_SYMBOLS_EXAMPLES[ref_option][0]
              example = INNOVATIVE_SYMBOLS_EXAMPLES[ref_option][1]
              strategy_example = STRATEGIES[strat_type].format(symbol= symbol, example=example)
              if not prompt_flag:
                prompt = PROMPT.format(text = text, spans=spans_text, reformulation_strategy= strategy_example)
              else:
                prompt = PROMPT_UNCERTAIN.format(text = text, spans=spans_text, reformulation_strategy= strategy_example)
      else:
        if not prompt_flag:
          prompt = PROMPT.format(text=text, spans=spans_text, reformulation_strategy= STRATEGIES[strat_type][ref_option])
        else:
          prompt = PROMPT_UNCERTAIN.format(text=text, spans=spans_text, reformulation_strategy= STRATEGIES[strat_type][ref_option])
      
      if prompt != "":
          try:
              response = await client.chat.completions.create(
                  model = GENERATION_MODEL,
                  messages=[
                      {"role":"user", "content": prompt}
                  ],
                  response_model = LLMOutput,
              )

              for r in response.result:
                  if r.span_id in spans_ids:
                      span = spans_dict[r.span_id]
                      span.reformulation = r.reformulation
                      machine_reformulated_spans.append(span)
                      
          except Exception as e:
              logger.exception(f"Generation failed with error: {e}")
              raise Exception(f"LLM provider unavailable or timeout: {str(e)}")
      else:
        # IO instructions were missing the symbol specifications
        # spans are sent back without reformulation
        for span.id in spans_text:
          span = spans_dict[r.span_id]
          machine_reformulated_spans.append(span)
    
    merged_reformulated_spans = machine_reformulated_spans + list(rulebased_reformulated_spans.values())
    # DEBUG
    #print("\n-- machine ref "+"-"*30)
    #print(machine_reformulated_spans)
    #print("-- rule ref "+"-"*30)
    #print(list(rulebased_reformulated_spans.values()))
    #print("-- merge ref "+"-"*30)
    #print(merged_reformulated_spans)
    
    if merged_reformulated_spans:
      return merged_reformulated_spans
    else:
      return spans