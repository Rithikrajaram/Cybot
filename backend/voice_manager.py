from secure_db import get_db_connection

def store_voice_pattern(user_id, pattern, voice_text=""):
    """
    Store the voice spectral pattern and recognized text in the database.
    """
    db = get_db_connection()
    try:
        db.users.update_one(
            {"device_id": user_id},
            {"$set": {
                "voice_pattern": pattern,
                "voice_text": voice_text.lower().strip()
            }},
            upsert=True 
        )
        return True
    except Exception as e:
        print(f"Error storing voice pattern: {e}")
        return False

def get_voice_pattern(user_id):
    """Retrieves voice fingerprint and text for a user."""
    db = get_db_connection()
    try:
        user = db.users.find_one({"device_id": user_id})
        if user:
            return {
                "pattern": user.get("voice_pattern"),
                "text": user.get("voice_text", "")
            }
        return None
    except Exception as e:
        print(f"Error retrieving voice pattern: {e}")
        return None