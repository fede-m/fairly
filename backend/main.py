from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
import json
import os
import hmac
import hashlib
import logging
import time
from models import (
    Request,
    StoreEventRequest,
    Response,
    OutputData,
    EventType,
    SpanEvent,
    User,
    InfoEventRequest,
    FrontendErrorRequest,
    LookupResult,
    LookupResults,
    MorphoVariants,
    LookupFlag
)
from llm import detection, generation
from presidio import setup_presidio, process_text, deanonymize, get_spacy_model
from database import insert_event, insert_user, insert_info_event, insert_backend_errors, insert_frontend_error

logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)
CHROME_EXTENSION_ID = os.getenv("CHROME_EXTENSION_ID")
SECRET_KEY = os.environ.get("SECRET_KEY")
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Specify the id of the Chrome extension to allow it to call the backend
    allow_origins=[
        f"chrome-extension://{CHROME_EXTENSION_ID}",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# -- initialization of the spacy model for pos tagging --------------------
nlp = None
setup_presidio()
nlp = get_spacy_model()
try:
    doc = nlp("Questo è un test.")
    for token in doc:
        print(f"{token.text} → {token.pos_} ({token.lemma_})")
except Exception as e:
    print(f"Set up of spacy model failed.\nError: {type(e).__name__}: {e}")
    
# -- reading of the .json lookup table for morphosyntactic rewrites -------
with open("dictionary.json", encoding="utf-8") as f:
    LOOKUP_TABLE: dict = json.load(f)

@app.middleware("http")
async def log_requests(request: FastAPIRequest, call_next):
    # Log for every request for every endpoint
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info("%s %s → %d (%.2fs)", request.method, request.url.path, response.status_code, elapsed)
    return response

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: FastAPIRequest, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    await insert_backend_errors("unhandled", str(exc))
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "Internal server error", "code": "INTERNAL_ERROR"}
    )

def _hash_email(email):
    return hmac.new(SECRET_KEY.encode(), email.encode(), hashlib.sha256).hexdigest()

@app.post("/add-user")
async def store_user(user: User):
    if user:
        # Hash email address
        email = user.user_id.strip().lower()
        user.user_id = _hash_email(email)
        await insert_user(user)
        return {"status": 200, "message": "User was added successfully"}

@app.post("/analyse")
async def analyse(request: Request):
    logger.info("Analysis request: session=%s, strategy=%s, docs=%d", request.session_id, request.strategy, len(request.data))
    results = {}
    strategy = request.strategy
    email = request.user_id.strip().lower()
    request.user_id = _hash_email(email)

    # Store request
    analysis_events = []

    try:
        for doc in request.data:
            # Remove "\n" from text
            text = "".join([chunk for chunk in doc.text.split("\n") if chunk])
            anonymized_text, mapping = process_text(text)
            try:
                # Detection (on full text)
                detected_spans = await run_in_threadpool(detection, text)
            except Exception as e:
                logger.exception("Detection failed for session=%s, doc=%s", request.session_id, doc.id)
                await insert_backend_errors("detection_failed", str(e), session_id=request.session_id, user_id=request.user_id)
                # Return error response if generation fails
                return {
                    "error": True,
                    "message": "Si è verificato un errore durante la generazione delle riformulazioni.",
                    "code": "ANALYSIS_FAILED",
                    "details": str(e),
                }
                
            # 1. POS tagging
            # 2. Look-up in a table with frequent morphosyntactic rewritings in Italian
            #   i) look-up can be used as an indicator for good/bad detections: if the detected word is not in the table,
            #      there is a chance it was not a word that needed detection to begin with
            #   ii) for strategies CB, IV, IO, that are morphosyntactic rewritings, a lookup table could be enough
            #       and enable some token savings and gain in efficiency
            
            lookup_results = {}
            for span in detected_spans:
                lookup_results[span.span_id] = lookup_span(doc, span.start_char, span.end_char)
                print(lookup_results[span.span_id])
            print("\n- - - - - -\n")
            print(lookup_results)    
                
            # Generation
            try:
                reformulated_spans = await generation(anonymized_text, detected_spans, strategy, lookup_results)
            except Exception as e:
                logger.exception("Generation failed for session=%s, doc=%s", request.session_id, doc.id)
                await insert_backend_errors("generation_failed", str(e), session_id=request.session_id, user_id=request.user_id)
                # Return error response if generation fails
                return {
                    "error": True,
                    "message": "Si è verificato un errore durante la generazione delle riformulazioni.",
                    "code": "ANALYSIS_FAILED",
                    "details": str(e),
                }

            # user sees deanonimized text + shifted spans
            deanonymized_text, unfair_spans = deanonymize(
                anonymized_text, mapping, reformulated_spans
            )
            results[doc.id] = OutputData(
                text=deanonymized_text, unfair_spans=unfair_spans
            )
            analysis_request = StoreEventRequest(
                event=EventType.ANALYSIS,
                spans=[
                    SpanEvent(
                        span_id=s.span_id,
                        # start_char = s.start_char,
                        # end_char = s.end_char,
                        original=anonymized_text[s.start_char : s.end_char],
                        reformulation=s.reformulation,
                        current_used="",
                    )
                    for s in reformulated_spans
                ],
                session_id=request.session_id,
                user_id=request.user_id,
                email_id=doc.id,
                strategy=strategy,
                email_char_count=doc.char_length,
                email_word_count=doc.word_count,
            )

            analysis_events.append(analysis_request)
        await insert_event(analysis_events)
        return Response(results=results)
    
    except Exception as e:
        logger.exception("Analysis failed for session=%s", request.session_id)
        await insert_backend_errors("analysis_failed", str(e), session_id=request.session_id, user_id=request.user_id)
        return {
            "error": True,
            "message": "Si è verificato un errore durante l'analisi.",
            "code": "ANALYSIS_FAILED",
            "details": str(e),
        }


@app.post("/store-event")
async def store_event(requests: list[StoreEventRequest]):
    logger.info("Storing %d event event(s): type:%s", len(requests), [r.event.value for r in requests])
    for event in requests:
        email = event.user_id.strip().lower()
        event.user_id = _hash_email(email)
        # If fairly was used, text is not none
        # it gets anonymized
        if event.event == EventType.SEND:
            if event.text is not None:
                event.text, _ = process_text(event.text)
        elif event.event in (EventType.REFUSE, EventType.ACCEPT, EventType.EDIT):
            for span in event.spans:
                span.original, _ = process_text(span.original)
                span.reformulation, _ = process_text(span.reformulation)
                if span.current_used:
                    span.current_used, _ = process_text(span.current_used)
                if span.user_form:
                    span.user_form, _ = process_text(span.user_form)
    await insert_event(requests)
    return {"status": 200, "message": "Event was stored successfully"}


@app.post("/store-info-event")
async def store_info_event(request: InfoEventRequest):
    # Hash email address
    email = request.user_id.strip().lower()
    request.user_id = _hash_email(email)
    await insert_info_event(request)
    return {"status": 200, "message": "Info event was stored successfully"}

@app.post("/log-error")
async def log_frontend_error(error: FrontendErrorRequest):
    if error.user_id:
        email = error.user_id.strip().lower()
        error.user_id = _hash_email(email)
    logger.warning("Frontend error from %s: %s", error.source, error.message)
    await insert_frontend_error(error)
    return {"status": 200, "message": "Error logged successfully"}

def lookup(lemma: str, spacy_pos: str) -> dict | None:
    """Return {'feminine': [...], 'neutral': [...]} for a lemma+POS, or None if absent."""
    pos_key = spacy_pos.lower()
    entry = LOOKUP_TABLE.get(lemma.lower())
    if entry is None:
        return None
    return entry.get(pos_key)
  
FLECTABLE_POS = {"noun", "adj", "verb", "aux", "det", "num", "pron"}

def lookup_span(doc, start_char: int, end_char: int) -> LookupResults:
    """Return {lemma: {pos: <forms>}} for all tokens in the span that exist in the table.
    plus a prompt flag: fails in lookup indicate weak detection and cause a change in the
    generation prompt to a more flexible one that asks the llm to rethink the detection"""
    span = doc.char_span(start_char, end_char, alignment_mode="expand")
    if span is None or len(span) == 0:
        return LookupResults(results={}, is_empty=True)
    
    results = {}
    
    for token in span:
      word = token.text
      lemma = token.lemma_
      pos = token.pos_.lower()
      if pos not in FLECTABLE_POS:
        if pos != "punct":
          results[word] = LookupResult(
                  lemma=lemma,
                  pos=pos,
                  variants=MorphoVariants(),
                  flag=LookupFlag.NON_INFLECTABLE_POS
          )
        continue
            
      entry = lookup(lemma, pos)
      if entry is not None:
            results[word] = LookupResult(
                lemma=lemma,
                pos=pos,
                variants=entry,
                flag=LookupFlag.OK
            )
      else:
            results[word] = LookupResult(
                lemma=lemma,
                pos=pos,
                variants=MorphoVariants(),
                flag=LookupFlag.INFLECTABLE_MISS
            )
            
    return LookupResults(results=results, is_empty=False)
