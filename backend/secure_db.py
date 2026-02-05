from pymongo import MongoClient
import os

# Connection String
MONGO_URI = "mongodb+srv://rithik123:riti123raja@cluster0.ewq4e.mongodb.net/?retryWrites=true&w=majority"
DB_NAME = "secure_enclave_db"

client = None

def get_db_connection():
    global client
    if client is None:
        client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    return db

def init_db():
    try:
        db = get_db_connection()
        # Verify connection
        db.command('ping')
        print(f"Connected to MongoDB: {DB_NAME}")
        
        # Create indexes
        db.users.create_index("device_id", unique=True)
        db.credentials.create_index("credential_id", unique=True)
        # audit_logs doesn't strict unique constraint but we sort by insertion order
        
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")

if __name__ == "__main__":
    init_db()
