import hashlib
import json
from datetime import datetime
from secure_db import get_db_connection

GENESIS_HASH = "0" * 64

def calculate_hash(previous_hash, event_data, timestamp):
    payload = f"{previous_hash}{event_data}{timestamp}".encode()
    return hashlib.sha256(payload).hexdigest()

def log_event(event_data):
    """
    Logs an event into the immutable hash chain.
    """
    db = get_db_connection()

    # Get the last hash
    # Sort by _id descending to get last inserted (natural order)
    last_entry = db.audit_logs.find_one(sort=[("_id", -1)])
    
    if last_entry:
        previous_hash = last_entry['current_hash']
    else:
        previous_hash = GENESIS_HASH

    timestamp = datetime.utcnow().isoformat()
    
    # Calculate new hash binding the previous one
    current_hash = calculate_hash(previous_hash, event_data, timestamp)

    db.audit_logs.insert_one({
        "previous_hash": previous_hash,
        "event_data": event_data,
        "timestamp": timestamp,
        "current_hash": current_hash
    })

    return current_hash

def verify_chain_integrity():
    """
    Re-calculates the entire chain to find tampering.
    Returns: (True, "OK") or (False, "Broken at ID: X")
    """
    db = get_db_connection()
    rows = list(db.audit_logs.find().sort("_id", 1))

    if not rows:
        return True, "Empty Log"

    last_hash = GENESIS_HASH

    for row in rows:
        calc_hash = calculate_hash(last_hash, row['event_data'], row['timestamp'])
        
        if calc_hash != row['current_hash']:
            # Use _id as identifier since we don't have auto-increment 'id' anymore
            return False, f"Integrity Failure at ID: {row['_id']}"
        
        last_hash = row['current_hash']

    return True, "Integrity Verified: Chain Intact"
