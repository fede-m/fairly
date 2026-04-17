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
  

### Test Connection on MongoDB
- In order to activate and mount the Docker Compose, run:
```bash
docker-compose up
```

> [!WARNING]
> If you change something in the backend, you need to re-build the images to have the changes included!
> This means you need to run the command with the `--build` flag:
> `docker-compose up --build`

- This should:
  - Create a Docker network 
  - Pull the "mongo" image from Docker Hub
  - Build the application image from `./backend`

- Then, it should:
  - Start the connection with MongoDB (which refreshes with new logs every 10 s as set in docker-compose)
  - Run the Uvicon app (with FastAPI)

- FastAPI can be reached for testing using the Swagger UI at `http://127.0.0.1:8000/docs` where you can test the `store-event` endpoint by sending an event

- To check whether the event was successfully saved in the database, you can establish a connection to the MongoDB Shell (mongosh) inside the Docker container using:
```bash
docker exec -it fairly-mongo mongosh --username <USERNAME> --password <PASSWORD> --authenticationDatabase admin
```

- And then check using the following commands:

```shell
// Switch to the database
use fairly_db

// List collections
show collections

// Count documents in user_events
db.user_events.countDocuments()

// View all events
db.user_events.find()

// View with pretty formatting
db.user_events.find().pretty()

// View just the first event
db.user_events.findOne()
```