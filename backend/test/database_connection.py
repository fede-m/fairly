"""Minimal MongoDB Atlas connection diagnostic."""
from dotenv import load_dotenv
import os, ssl, certifi
from pymongo import MongoClient

load_dotenv()
MONGODB_URI = os.environ.get("MONGODB_URI")

print("=== Environment ===")
print(f"OpenSSL: {ssl.OPENSSL_VERSION}")
print(f"URI starts with: {MONGODB_URI[:30]}..." if MONGODB_URI else "URI is None!")
print(f"certifi CA: {certifi.where()}")

# --- Test 1: DNS resolution ---
print("\n=== Test 1: DNS ===")
try:
    import dns.resolver
    host = MONGODB_URI.split("@")[1].split("/")[0]
    answers = dns.resolver.resolve(f"_mongodb._tcp.{host}", "SRV")
    for r in answers:
        print(f"  SRV: {r.target}:{r.port}")
except Exception as e:
    print(f"  DNS FAILED: {e}")


# --- Test 2: Raw TCP + TLS to one shard ---
print("\n=== Test 2: Raw TLS handshake ===")
try:
    import socket
    ctx = ssl.create_default_context(cafile=certifi.where())
    with socket.create_connection(("ac-qbojrxl-shard-00-00.khg90i7.mongodb.net", 27017), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname="ac-qbojrxl-shard-00-00.khg90i7.mongodb.net") as ssock:
            print(f"  TLS version: {ssock.version()}")
            print(f"  Cipher: {ssock.cipher()}")
            print("  TLS handshake OK")
except Exception as e:
    print(f"  TLS FAILED: {e}")



# --- Test 3: Relaxed PyMongo (TESTING ONLY) ---
print("\n=== Test 3: PyMongo relaxed TLS ===")
try:
    client = MongoClient(
        MONGODB_URI,
        tls=True,
        tlsAllowInvalidCertificates=True,   # TESTING ONLY - bypasses cert validation
        serverSelectionTimeoutMS=15000,
        connectTimeoutMS=10000,
    )
    print(f"  ping: {client.admin.command('ping')}")
    print(f"  databases: {client.list_database_names()}")
except Exception as e:
    print(f"  RELAXED FAILED: {e}")


# --- Test 4: Strict PyMongo with certifi ---
print("\n=== Test 4: PyMongo strict TLS + certifi ===")
try:
    client = MongoClient(
        MONGODB_URI,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=15000,
        connectTimeoutMS=10000,
    )
    print(f"  ping: {client.admin.command('ping')}")
    print(f"  databases: {client.list_database_names()}")
except Exception as e:
    print(f"  STRICT FAILED: {e}")

print("\n=== Done ===")