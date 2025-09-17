from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import Request, Response, OutputData
from llm import process_data, process_data_test


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

@app.post("/analyze")
async def analyze_text(request: Request):
    print(request)
    results = {}
    for data in request.data:
        # Remove "\n" from text
        text = "".join([chunk.strip() for chunk in data.text.split("\n") if chunk.strip()])
        result = process_data_test(text)
        results[data.id] = OutputData(text=text, unfair_spans=result)
    response = Response(data = results)
    print(response)
    return response
