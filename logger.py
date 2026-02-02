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
    conn = get_db_connection()
    c = conn.cursor()

    # Get the last hash
    c.execute("SELECT current_hash FROM audit_logs ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    
    if row:
        previous_hash = row['current_hash']
    else:
        previous_hash = GENESIS_HASH

    timestamp = datetime.utcnow().isoformat()
    
    # Calculate new hash binding the previous one
    current_hash = calculate_hash(previous_hash, event_data, timestamp)

    c.execute('''
        INSERT INTO audit_logs (previous_hash, event_data, timestamp, current_hash)
        VALUES (?, ?, ?, ?)
    ''', (previous_hash, event_data, timestamp, current_hash))

    conn.commit()
    conn.close()
    return current_hash

def verify_chain_integrity():
    """
    Re-calculates the entire chain to find tampering.
    Returns: (True, "OK") or (False, "Broken at ID: X")
    """
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM audit_logs ORDER BY id ASC")
    rows = c.fetchall()
    conn.close()

    if not rows:
        return True, "Empty Log"

    last_hash = GENESIS_HASH

    for row in rows:
        calc_hash = calculate_hash(last_hash, row['event_data'], row['timestamp'])
        
        if calc_hash != row['current_hash']:
            return False, f"Integrity Failure at ID: {row['id']}"
        
        last_hash = row['current_hash']

    return True, "Integrity Verified: Chain Intact"
