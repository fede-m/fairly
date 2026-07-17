- Virtual environment was created using uv: https://docs.astral.sh/uv/guides/projects/#pyprojecttoml
- Virtual environment to select is backend 3.12

```bash
cd backend
uv venv --python 3.12
uv sync
source .venv/bin/activate
```

- Run the app for developement:

```bash
  fastapi dev main.py
```

- Run the app for deployment:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Then, go to: `http://127.0.0.1:8000/docs` --> to get the FastAPI Swagger UI to test the endpoint
- If you only go to `http://127.0.0.1:8000`, uvicorn tries to call the root "GET" endpoint of your app (the one with path "/"). If you do not have it, you get a message `{"detail":"Not Found"}`


### Test Docker

start daemon

```bash
sudo systemctl start docker
```

docker compose

```bash
sudo docker-compose up --build
```

if something goes wrong, use to check for memory and remove unused images

```bash
docker system df
docker image prune -a
```

this removes all unused conteainers, images, volumes

```bash
docker system prune -a --volumes
```

to remove an image used by a container

```bash
docker ps        # Find the container ID (e.g., 4f8dd1c65754)
docker stop 4f8dd1c65754
docker rm 4f8dd1c65754
```


### Test the deployment

Tokens to be addded to the .env file:
- huggingface: login and create an access token with read permissions
- ngrok: Create a free account at ngrok.com. Log in to your dashboard to find your unique authtoken
- OPENWEB_API: log into utopia `utopia.hpc4ai.unito.it` and generate a token (settings, account, token)
- extention token: after adding the front-end to the browser, copy the id from the extentions page

also, create the new config.js in the frontend before loading the extention on chrome

Then, open a terminal and run the backend server using `uvicorn`
  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```

It should work!
  

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