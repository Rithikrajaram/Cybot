import pyotp
import uuid
from secure_db import get_db
from logger import log_event

APP_NAME = "SecureOfflineAuth"

def register_device(custom_id=None):
    """
    Simulates the 'Online' registration.
    Uses custom_id if provided, else generates UUID.
    """
    device_id = custom_id if custom_id else str(uuid.uuid4())
    secret_seed = pyotp.random_base32()

    db = get_db()
    users = db.users
    
    # Check if user already exists
    if users.find_one({"device_id": device_id}):
        return None, None # Duplicate ID

    try:
        users.insert_one({
            "device_id": device_id, 
            "secret_seed": secret_seed
        })
    except Exception as e:
        print(f"Error registering device: {e}")
        return None, None
    
    log_event(f"Device Registered: {device_id}")
    return device_id, secret_seed

def get_totp_uri(device_id, secret_seed):
    return pyotp.totp.TOTP(secret_seed).provisioning_uri(name=device_id, issuer_name=APP_NAME)

def verify_login(device_id, token):
    """
    The 'Offline' Verification.
    """
    db = get_db()
    users = db.users
    
    user = users.find_one({"device_id": device_id})

    if not user:
        log_event(f"Login Failed: Unknown Device {device_id}")
        return False, "Device not found"

    secret_seed = user['secret_seed']
    totp = pyotp.TOTP(secret_seed)
    
    # Verify with a slight window (backup for clock drift)
    if totp.verify(token, valid_window=1):
        log_event(f"Login Success: {device_id}")
        return True, "Authenticated"
    else:
        log_event(f"Login Failed: Invalid Token for {device_id}")
        return False, "Invalid Code"
