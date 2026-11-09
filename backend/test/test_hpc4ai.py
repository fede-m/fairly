import asyncio, csv, os, sys, time 
import argparse
import requests
from dotenv import load_dotenv
from openai import OpenAI
import httpx
from datetime import datetime
import instructor
from pydantic import BaseModel, Field

load_dotenv()
BASE_URL = "https://utopia.hpc4ai.unito.it/api/"
URL = BASE_URL.rstrip("/") + "/chat/completions"
API_KEY = os.getenv("OPENWEB_API", "")
HEADERS = {"Authorization": f'Bearer {API_KEY}'}
CSV_PATH = "coldstart.csv"

MODEL = "SLURM.utopia/qwen3.8:27b"

async def probe(model: str, label, timeout: float = 300.0) -> list:
    body = {"model": model, "stream": True, "max_tokens": 5, 
            "messages": [{"role": "user", "content": "ok"}],
            "keep_alive": "10m",}
    t0 = time.monotonic()
    t_headers = t_first = None
    status = None

    # NOTE: if the time between t_headers and t_first is large: the gateway answeredd
    # immediately, the time is spent after it (loading, scheduling, queueing). 
    # If they are both large: the gateway waits for the model to load before replying

    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            async with c.stream("POST", URL, headers=HEADERS, json=body) as r:
                # Time until the server replies (containing status and headers) body is not yet received
                t_headers = time.monotonic() - t0
                status = r.status_code
                if r.status_code != 200:
                    await r.aread()
                else:
                    async for line in r.aiter_lines():
                        if line.startswith("data:") and t_first is None:
                            # Time to first token of the stream response
                            # This indicates that the model has loaded and started generating the answer
                            t_first = time.monotonic() - t0
    except Exception as e:
        status = type(e).__name__
    total = time.monotonic() - t0
    row = [datetime.now().isoformat(), label, model, status, t_headers, t_first, round(total, 2)]
    with open(CSV_PATH, "a", newline="") as f:
        csv.writer(f).writerow(row)
    print(row)
    return row

async def sweep(model: str, idle_minutes: list[float]):
    """Measure latency after increasing idle periods."""
    # Perform the first call (expected to take long)
    await probe(model, "initial request (expect higher latency)")
    for m in idle_minutes:
        await asyncio.sleep(m * 60)
        await probe(model, f"idle={m}min")

async def concurrency(model: str, levels =(1, 2, 4, 8)):
    """Check whether requests are queued on the HPC4AI server side on a warm model"""
    await probe(model, "warm up")
    for n in levels:
        await asyncio.gather(*(probe(model, f"concurrency={n}") for _ in range(n)))
        await asyncio.sleep(5)

async def disconnect(model: str, wait_s: float = 200):
    """Run on a cold model and check whether the loading continues after the client gives up"""
    await probe(model, "disconnect-5s", timeout=5)
    await asyncio.sleep(wait_s)
    await probe(model, f"after-disconnect-wait={wait_s}s")
    
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analysis HPC4AI server behaviour."
    )

    parser.add_argument("--model", type=str, default=MODEL)
    parser.add_argument("--mode", type=str, default="probe")

    args = parser.parse_args()

    return args

if __name__ == "__main__":
    args = parse_args()
    mode = args.mode
    model = args.model
    idle_minutes = [5, 10, 15, 20, 30, 60, 120]
    if mode == "probe":
        asyncio.run(probe(model, "test"))
    elif mode == "sweep":
        asyncio.run(sweep(model, idle_minutes))
    elif mode == "concurrency":
        asyncio.run(concurrency(model))
    elif mode == "disconnect":
        asyncio.run(disconnect(model))


# REQUESTS  option
# headers = {
#     "Authorization": f'Bearer {API_KEY}',
#     'Content-Type': 'application/json'
# }

# data = {
#     "model": MODEL,
#     "messages": [
#         {
#             "role": "user",
#             "content": "Organize the information using the given 'John Steel, 14 years old, was found dead in a slump.'"
#         }
#     ]
# }

# response = requests.post(hcp4ai_url, headers=headers, json = data)
# print(response.json())
