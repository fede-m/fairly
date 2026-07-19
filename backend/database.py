from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone
import logging
import os
from models import StoreEventRequest, InfoEventRequest, FrontendErrorRequest, User
import urllib

# import dns.resolver
# dns.resolver.default_resolver=dns.resolver.Resolver(configure=False)
# dns.resolver.default_resolver.nameservers=['8.8.8.8']
load_dotenv()
logger = logging.getLogger(__name__)

# Get secret key for hashing
SECRET_KEY = os.environ.get("SECRET_KEY")
# password = urllib.parse.quote_plus(os.environ.get("MONGODB_PWD"))
# user = os.environ.get("MONGODB_USER")
user = os.environ.get("MONGO_INITDB_ROOT_USERNAME")
password = os.environ.get("MONGO_INITDB_ROOT_PASSWORD")

#MONGO_URL = f"mongodb+srv://{user}:{password}@fairlycluster.khg90i7.mongodb.net/?appName=FairlyCluster"
MONGO_URL = f"mongodb://{user}:{password}@mongodb:27017/fairly?authSource=admin"

## Comment all of the following to test locally
# Connect to the MongoDB Cluster
client = AsyncIOMotorClient(MONGO_URL)

db = client["fairly_db"]
collection = db["user_events"]
user_collection = db["user_data"]
be_error_collection = db["backend_errors"]
fe_error_collection = db["frontend_errors"]

def _as_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


async def insert_event(events: list[StoreEventRequest]):
    if not events:
        return
    docs = [_as_dict(event) for event in events]
    await collection.insert_many(docs)


async def insert_user(user: User):
    await user_collection.insert_one(_as_dict(user))


async def insert_info_event(event: InfoEventRequest):
    await collection.insert_one(_as_dict(event))

async def insert_backend_errors(error_type, details, session_id= None, user_id = None):
    await be_error_collection.insert_one({
        "timestamp": datetime.now(timezone.utc),
        "error_type": error_type,
        "details": str(details),
        "session_id": session_id,
        "user_id": user_id
    })

async def insert_frontend_error(error: FrontendErrorRequest):
    await fe_error_collection.insert_one(_as_dict(error))




