from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from models import StoreEventRequest, InfoEventRequest, User
import urllib

# import dns.resolver
# dns.resolver.default_resolver=dns.resolver.Resolver(configure=False)
# dns.resolver.default_resolver.nameservers=['8.8.8.8']
load_dotenv()

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




