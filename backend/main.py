from contextlib import asynccontextmanager
from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI
from starlette.concurrency import run_in_threadpool
from transformers import AutoTokenizer, AutoModelForTokenClassification
import instructor
import random

import os
import hmac
import hashlib
import logging
import nltk
import spacy
import time
from config import DETECTION_MODEL, TOKENIZER_MODEL
from models import (
    Request,
    StoreEventRequest,
    Response,
    OutputData,
    EventType,
    SpanEvent,
    User,
    InfoEventRequest,
    FrontendErrorRequest
)
from llm import detection, generation
from dictionary_rewriting import dictionary_based_rewrite
from presidio import setup_presidio, process_text
from database import insert_event, insert_user, insert_info_event, insert_backend_errors, insert_frontend_error

logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)
logging.getLogger("presidio-analyzer").setLevel(logging.WARNING)
CHROME_EXTENSION_ID = os.getenv("CHROME_EXTENSION_ID")
CHROME_EXTENSION_ID_1 = os.getenv("CHROME_EXTENSION_ID_1")
CHROME_EXTENSION_ID_2 = os.getenv("CHROME_EXTENSION_ID_2")
HUGGINFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")
SECRET_KEY = os.environ.get("SECRET_KEY")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.nlp = spacy.load("it_core_news_lg")

    # Load models for detection
    app.state.sent_tokenizer = nltk.tokenize.punkt.PunktSentenceTokenizer()
    app.state.detection_model = AutoModelForTokenClassification.from_pretrained(DETECTION_MODEL, token = HUGGINFACE_TOKEN)
    app.state.tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_MODEL, token = HUGGINFACE_TOKEN)
    # Setup client
    client = AsyncOpenAI(
        base_url = os.getenv("HPC4AI_URL", ""),
        api_key = os.getenv("OPENWEB_API", ""),
        timeout= 35.0
    )

    app.state.client = instructor.patch(client, mode = instructor.Mode.JSON)
    setup_presidio()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Specify the id of the Chrome extension to allow it to call the backend
    allow_origins=[
        f"chrome-extension://{CHROME_EXTENSION_ID}",
        f"chrome-extension://{CHROME_EXTENSION_ID_1}",
        f"chrome-extension://{CHROME_EXTENSION_ID_2}",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

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
async def analyse(request: Request, http_request: FastAPIRequest):
    logger.info("Analysis request: session=%s, strategy=%s, docs=%d", request.session_id, request.strategy, len(request.data))
    results = {}
    strategy = request.strategy
    email = request.user_id.strip().lower()
    request.user_id = _hash_email(email)
    nlp = http_request.app.state.nlp

    # Store request
    analysis_events = []

    try:
        for doc in request.data:
            # Remove "\n" from text
            text = "".join([chunk for chunk in doc.text.split("\n") if chunk])
            anonymized_text, _ = process_text(text)
            try:
                # Detection (on full text)
                detected_spans = await run_in_threadpool(
                    detection, 
                    text, 
                    http_request.app.state.sent_tokenizer, 
                    http_request.app.state.tokenizer, 
                    http_request.app.state.detection_model
                )

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

            # ------------------ Rewriting ------------------

            # Dictionary based
            # If not all spans could be rewritten using an algorithm, call the generation branch only for that spans
            reformulated = [] 
            need_generation = []
            gender_precedence = None
            if strategy.split("-")[0] == "CO":
                need_generation = detected_spans
            else:
                if strategy.split("-")[0] in ["CV", "IV"]:
                    gender_precedence = random.sample(["masculine", "feminine"], 1)[0]
                for span in detected_spans:
                    reformulated_span = dictionary_based_rewrite(nlp, text, span, strategy, gender_precedence)
                    if not reformulated_span:
                        need_generation.append(span)
                    else:
                        reformulated.append(reformulated_span)
                
            # Generation based
            try:
                reformulated.extend(await generation(anonymized_text, need_generation, strategy, http_request.app.state.client))
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

            # Put results together and order
            reformulated = sorted(
                reformulated, key = lambda span: span.start_char
            )
            # Detection ran on the original text, so span indices already match it
            results[doc.id] = OutputData(
                text=text, unfair_spans=reformulated
            )
            analysis_request = StoreEventRequest(
                event=EventType.ANALYSIS,
                spans=[
                    SpanEvent(
                        span_id=s.span_id,
                        # start_char = s.start_char,
                        # end_char = s.end_char,
                        original=process_text(s.original_text)[0],
                        reformulation=s.reformulation,
                        current_used="",
                    )
                    for s in reformulated
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


