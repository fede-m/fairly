# Concurrency Design
## How does FastAPI work?

FastAPI is built on top of an **async** event loop, which is responsible for handling many requests efficiently.
An event loop is essentially a scheduler that does:
```
while True
    take next task
    run it until it blocks
    switch to another task
```

This event loop is efficient and can handle many requests **only if no single request blocks it**.
A request blocks the loop when it performs long synchronous work (e.g. CPU or I/O).

When you run `uvicorn main:app`, Uvicorn handles:
- the event loop creation (where Fast API runs)
- socket listening
- request scheduling
- task switching

When a request comes in:
- The Uviconrn server receives the HTTP request
- The request is passed to FastAPI which routes it to the correct endpoint
- The endpoint Python function runs
- While the code runs, FastAPI is still responsive towards new user requests --> it needs a way to juggle them

## Problem Overview
- For each user request, the FastAPI-powered backend has to perform 3 main steps/actions:
    1. Detection: a BERT-based model identifies unfair spans in text
    2. Generation: a remote LLM API call to the models hosted by HPC4AI
    3. Storage step: results are stored on MongoDB

- At the moment, all these steps are blocking the event loop:
    1. Detection is CPU-bound: it needs to perform operations that need using the CPU
    2. Generation is I/O-bound: it needs to wait for the HPC4AI API to return the model's response. In the meantime, the CPU is idle, as no task is performed (only waiting)
    3. Storage is also I/O bound


## Solutions
- As the detection step is CPU-bound, in order to make it non-blocking of the event loop, this task is run in a thread-pool. 
    - If two requests arrive at the same time, the event loop can start Request A
    - The detection loop is executed in another thread (so that it does not block the main thread's event loop)
    - In the meantime, the main thread's event loop receives the second Request B
    - When it hits the detection step, this is also executed in a separate thread
    - The main thread is again free
    - Once Request A is done executing the detection step, the event loop proceeds with the following steps of Request A
    - Same with Request B
- As Generation and Storage are I/O bound, they use async/await, so that the loop can proceed with other requests while Request A is waiting for a response back

This way, the event loop does not have to wait for these processes to be completed before starting processing a new nequest, achieving concurrency.

