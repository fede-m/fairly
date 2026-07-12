# Concurrency Design

## Problem Overview
- For each user request, the FastAPI-powered backend has to perform 3 main steps/actions:
    1. Detection: a BERT-based model identifies unfair spans in text
    2. Generation: a remote LLM API call to the models hosted by HPC4AI
    3. Storage step: results are stored on MongoDB

Each request must go through these steps in order.

FastAPI is built on top of an **async** event loop, which is responsible for handling many requests efficiently.