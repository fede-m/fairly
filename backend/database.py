from pymongo import MongoClient
from dotenv import load_dotenv
import os
import urllib.parse
load_dotenv()


MONGODB_PWD = os.environ.get("MONGODB_PWD")
password = urllib.parse.quote_plus(MONGODB_PWD)
MONGODB_CONNECTION_STRING = f"mongodb+srv://federicamanzi_db_user:{password}@fairlycluster.soocjbs.mongodb.net/?appName=FairlyCluster"

# Connect to the MongoDB Cluster
client = MongoClient(MONGODB_CONNECTION_STRING)

dbs = client.list_database_names()
print(dbs)


fairly_db = client["fairly_db"]
user_collection = fairly_db["users"]

result = user_collection.insert_one({"hello": "world"})
#person_collection = production.person_collection

#print(person_collection)

# def insert_doc():
#     collection = test_db["test"]
#     document = {
# 		"name": "Munster",
# 		"surname": "Frau",
# 		"age": 50,
# 		"married": False
# 	}

#     inserted_id = collection.insert_one(document).inserted_id

#     print(inserted_id)

# insert_doc()