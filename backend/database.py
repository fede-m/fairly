from pymongo import MongoClient
from dotenv import load_dotenv
import os
import urllib.parse
import hmac
import hashlib
import certifi
from models import EventRequest
# import dns.resolver
# dns.resolver.default_resolver=dns.resolver.Resolver(configure=False)
# dns.resolver.default_resolver.nameservers=['8.8.8.8']
load_dotenv()

import ssl

# Get secret key for hashing
SECRET_KEY = os.environ.get("SECRET_KEY")
# password = urllib.parse.quote_plus(os.environ.get("MONGODB_PWD"))
# user = os.environ.get("MONGODB_USER")
user = os.environ.get("MONGO_INITDB_ROOT_USERNAME")
password = os.environ.get("MONGO_INITDB_ROOT_PASSWORD")

print(user)
# MONGODB_URI = f"mongodb+srv://{user}:{password}@fairlycluster.khg90i7.mongodb.net/?appName=FairlyCluster"
MONGO_URL=f"mongodb://{user}:{password}@mongodb:27017/fairly?authSource=admin"
# Connect to the MongoDB Cluster
client = MongoClient(MONGO_URL)

dbs = client.list_database_names()
print(dbs)

db = client["fairly_db"]
collection = db["user_events"]


def insert_event(events: list[EventRequest]):
    for event in events:
        # Hash the user id
        email = event.user_id.strip().lower()
        event.user_id = hmac.new(
            SECRET_KEY.encode(),
            email.encode(),
            hashlib.sha256
        ).hexdigest()

        inserted_id = collection.insert_one(event.dict()).inserted_id




