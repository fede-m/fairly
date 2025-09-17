- Virtual environment was created using uv: https://docs.astral.sh/uv/guides/projects/#pyprojecttoml
- Virtual environment to select is backend 3.12

- Run the app for developement:

```bash
  fastapi dev main.py`
```

- Run the app for deployment:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Then, go to: `http://127.0.0.1:8000/docs` --> to get the FastAPI Swagger UI to test the endpoint
- If you only go to `http://127.0.0.1:8000`, uvicorn tries to call the root "GET" endpoint of your app (the one with path "/"). If you do not have it, you get a message `{"detail":"Not Found"}`

### Test the deployment

- To make the backend available to the the front-end (Chrome extension), we use `ngrok`.
- Use the following steps:
  1. Open a terminal and run the backend server using `uvicorn`
  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```
  2. In another terminal, run:
  ```bash
  ngrok http 8000
  ```
  3. This will generate a one-time URL (available in `Forwarding`) that you can provide to your extension to call the backend.
  4. NOTE: everytime you activate the server again, you will be provided with a new URL, so make sure to change it in the front-end
