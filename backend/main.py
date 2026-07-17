from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
import os
import hmac
import hashlib
from models import (
    Request,
    StoreEventRequest,
    Response,
    OutputData,
    EventType,
    SpanEvent,
    User,
    InfoEventRequest,
)
from llm import detection, generation
from presidio import setup_presidio, process_text, deanonymize
from database import insert_event, insert_user, insert_info_event

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

setup_presidio()


def _hash_email(email):
    return hmac.new(SECRET_KEY.encode(), email.encode(), hashlib.sha256).hexdigest()


@app.post("/analyse")
async def analyse(request: Request):
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
                # Detection
                detected_spans = await run_in_threadpool(detection, anonymized_text)
            except Exception as e:
                # Return error response if generation fails
                return {
                    "error": True,
                    "message": "Si è verificato un errore durante la generazione delle riformulazioni.",
                    "code": "ANALYSIS_FAILED",
                    "details": str(e),
                }
            # Generation
            try:
                reformulated_spans = await generation(anonymized_text, detected_spans, strategy)
            except Exception as e:
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
        print(f"Analysis failed with error: {e}")
        return {
            "error": True,
            "message": "Si è verificato un errore durante l'analisi.",
            "code": "ANALYSIS_FAILED",
            "details": str(e),
        }


@app.post("/store-event")
async def store_event(requests: list[StoreEventRequest]):
    for event in requests:
        email = event.user_id.strip().lower()
        event.user_id = _hash_email(email)
        # If fairly was used, text is not none
        # it gets anonymized
        if event.text is not None:
            event.text, _ = process_text(event.text)
    await insert_event(requests)
    return {"status": 200, "message": "Event was stored successfully"}


@app.post("/store-info-event")
async def store_info_event(request: InfoEventRequest):
    # Hash email address
    email = request.user_id.strip().lower()
    request.user_id = _hash_email(email)
    await insert_info_event(request)
    return {"status": 200, "message": "Info event was stored successfully"}


@app.post("/add-user")
async def store_user(user: User):
    if user:
        # Hash email address
        email = user.user_id.strip().lower()
        user.user_id = _hash_email(email)
        await insert_user(user)
        return {"status": 200, "message": "User was added successfully"}
