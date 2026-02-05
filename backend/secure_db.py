from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

LOCAL_URI = os.getenv("LOCAL_MONGO_URI")
CLOUD_URI = os.getenv("CLOUD_MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

# Cache clients
local_client = None
cloud_client = None

def get_db_connection():
    """
    Returns the PRIMARY (Local) Database handle.
    The application always works with this to ensure offline availability.
    """
    global local_client
    if local_client is None:
        local_client = MongoClient(LOCAL_URI, serverSelectionTimeoutMS=2000)
    return local_client[DB_NAME]

def get_cloud_db():
    """
    Returns the SECONDARY (Cloud) Database handle for the Sync Manager.
    """
    global cloud_client
    if not CLOUD_URI:
        return None
    try:
        if cloud_client is None:
            cloud_client = MongoClient(CLOUD_URI, serverSelectionTimeoutMS=5000)
        return cloud_client[DB_NAME]
    except Exception as e:
        print(f"Cloud DB Connection Error: {e}")
        return None

def init_db():
    """
    Initializes the local database indexes.
    """
    try:
        db = get_db_connection()
        # Verify connection
        db.command('ping')
        print(f"Connected to Local MongoDB: {DB_NAME}")
        
        # Create indexes
        db.users.create_index("device_id", unique=True)
        db.credentials.create_index("credential_id", unique=True)
        db.audit_logs.create_index("timestamp")
        print("Indexes initialized successfully.")
        
    except Exception as e:
        print(f"Failed to connect to Local MongoDB: {e}")

if __name__ == "__main__":
    init_db()
