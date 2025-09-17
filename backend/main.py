from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import DetectionRequest, DetectionResponse, DetectedSpans, GenerationRequest, GenerationResponse
from llm import detection, generation


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Specify the id of the Chrome extension to allow it to call the backend
    allow_origins = ["chrome-extension://fkjhnlgognmafffgjfhdgechiilmljfc"],
    allow_methods = ["GET", "POST"],
    allow_headers = ["*"]
)

# @app.get("/")
# def root():
#     return {"status": 200}

# @app.post("/analyze")
# async def analyze_text(request: Request):
#     print(request)
#     results = {}
#     for data in request.data:
#         # Remove "\n" from text
#         text = "".join([chunk.strip() for chunk in data.text.split("\n") if chunk.strip()])
#         result = detection(text)
#         results[data.id] = OutputData(text=text, unfair_spans=result)
#     response = Response(data = results)
#     print(response)
#     return response


@app.post("/detect")
async def detect_spans(request: DetectionRequest):
    results = {}
    for doc in request.documents:
        # Remove "\n" from text
        text = "".join([chunk.strip() for chunk in doc.text.split("\n") if chunk.strip()])
        detected_spans = detection(text)
        results[doc.id] = DetectedSpans(text=text, unfair_spans= detected_spans)

    return DetectionResponse(results = results)

@app.post("/generate")
async def generate_reformulations(request: GenerationRequest):
    results = {}
    reformulation_type = request.reformulation_type
    innovative_symbol = request.innovative_symbol
    for doc_id, doc in request.detected_spans.items():
        cleaned_text = "".join([chunk.strip() for chunk in doc.text.split("\n") if chunk.strip()])
        if len(doc.unfair_spans) > 0:
            # Add the alternative according to the to the Span objects
            reformulated_spans = generation(cleaned_text, doc.unfair_spans,reformulation_type, innovative_symbol)
            results[doc_id] = DetectedSpans(text= cleaned_text, unfair_spans=reformulated_spans)

    return GenerationResponse(reformulated_results= results)