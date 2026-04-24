from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from models import Request, EventRequest, Response, OutputData, EventType, SpanEvent
from llm import detection, generation

from database import insert_event

CHROME_EXTENSION_ID = os.getenv("CHROME_EXTENSION_ID")
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Specify the id of the Chrome extension to allow it to call the backend
    allow_origins = [f"chrome-extension://{CHROME_EXTENSION_ID}",  "http://localhost:3000", "http://localhost:8000"],
    allow_methods = ["GET", "POST"],
    allow_headers = ["*"]
)

@app.post("/analyse")
async def analyse(request: Request):
    print(request)
    results = {}
    strategy = request.strategy
    # Store request
    analysis_events = []
    for doc in request.data:
        # Remove "\n" from text
        text = "".join([chunk for chunk in doc.text.split("\n") if chunk])
        # Detection
        detected_spans = detection(text)
        # Generation
        reformulated_spans = generation(text, detected_spans, strategy)
        print(reformulated_spans)
        results[doc.id] = OutputData(text = text, unfair_spans = reformulated_spans)
        analysis_request =EventRequest(
                event = EventType.ANALYSIS,
                spans = [
                    SpanEvent(
                        original = text[s.start_char:s.end_char],
                        reformulation = s.reformulation,
                        current_used = ""
                    )
                    for s in reformulated_spans
                ],
                session_id =request.session_id,
                user_id = request.user_id,
                email_id = doc.id,
                strategy = strategy
            )
        
        analysis_events.append(analysis_request)
    
    insert_event(analysis_events)
    
    return Response(results = results)


# da rivedere
@app.post("/store-event")
async def store_event(request: list[EventRequest]):
    insert_event(request)
    return {"status": 200, "message": "Everything is fine"}
