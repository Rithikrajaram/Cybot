from pymongo import MongoClient
import os

# Using the connection string provided by the user
MONGO_URI = "mongodb+srv://rithik123:riti123raja@cluster0.ewq4e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "secure_enclave_db"

def get_db_client():
    client = MongoClient(MONGO_URI)
    return client

def get_db():
    client = get_db_client()
    return client[DB_NAME]

def init_db():
    """
    Initializes collections and indexes.
    MongoDB creates collections automatically on first insert, but we can set up indexes here.
    """
    db = get_db()
    
    # Users Collection
    # device_id should be unique
    db.users.create_index("device_id", unique=True)
    
    # Credentials Collection
    # user_id + credential_id should be unique (conceptually, though credential_id itself is globally unique usually)
    db.credentials.create_index("credential_id", unique=True)
    db.credentials.create_index("user_id")

    # Audit Logs Collection
    # Index for ordering if needed, though _id usually suffices.
    # We might want to query by previous_hash if we ever traverse backwards efficiently
    db.audit_logs.create_index("id") # We might need to manually manage 'id' if we want strict auto-increment behavior or just use _id

    print(f"Database {DB_NAME} initialized/connected successfully.")

if __name__ == "__main__":
    init_db()
