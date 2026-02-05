import pyotp
import uuid
import base64
from secure_db import get_db_connection
from logger import log_event
import math
import time

# RSA Imports
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.exceptions import InvalidSignature

# ... existing code ...

def generate_location_hash_component(alpha, beta, gamma):
    """
    Quantizes orientation data (Alpha, Beta, Gamma) into a stable grid.
    Grid Size = 15.0 (Degrees - reduced sensitivity for hand jitter)
    """
    GRID_SIZE = 15.0
    if alpha is None or beta is None or gamma is None:
        return "LOC:UNKNOWN"
        
    # Normalize angles to 0-360 to handle negative wrap-around
    # Alpha (Compass) is 0-360.
    stable_alpha = round((float(alpha) % 360) / GRID_SIZE) * GRID_SIZE
    # Beta (Tilt FB) is -180 to 180, normalize to 0-360
    stable_beta = round((float(beta) % 360) / GRID_SIZE) * GRID_SIZE
    # Gamma (Tilt LR) is -90 to 90, normalize to 0-360
    stable_gamma = round((float(gamma) % 360) / GRID_SIZE) * GRID_SIZE
    
    return f"LOC:{int(stable_alpha)}:{int(stable_beta)}:{int(stable_gamma)}"

APP_NAME = "SecureOfflineAuth"

def register_device(custom_id=None):
    """
    Simulates the 'Online' registration.
    Uses custom_id if provided, else generates UUID.
    """
    device_id = custom_id if custom_id else str(uuid.uuid4())
    secret_seed = pyotp.random_base32()

    db = get_db_connection()
    try:
        db.users.insert_one({
            "device_id": device_id,
            "secret_seed": secret_seed
        })
    except Exception as e:
        print(f"Registration Error: {e}")
        return None, None # Duplicate ID

    log_event(f"Device Registered: {device_id}")
    return device_id, secret_seed

def get_totp_uri(device_id, secret_seed):
    return pyotp.totp.TOTP(secret_seed).provisioning_uri(name=device_id, issuer_name=APP_NAME)

def verify_login(device_id, token):
    """
    The 'Offline' Verification.
    """
    db = get_db_connection()
    user = db.users.find_one({"device_id": device_id})


    if not user:
        log_event(f"Login Failed: Unknown Device {device_id}")
        return False, "Device not found"

    secret_seed = user['secret_seed']
    totp = pyotp.TOTP(secret_seed)
    
    # Verify with a slight window (backup for clock drift)
    if not token:
        return False, "Token Required"

    if totp.verify(token, valid_window=1):
        log_event(f"Login Success: {device_id}")
        return True, "Authenticated"
    else:
       log_event(f"Login Failed: Invalid Token for {device_id}")
       return False, "Invalid Code"

def register_nfc(device_id, nfc_uid, force_login=False):
    """
    Links an NFC UID (or Magnetic Key) to a specific Device ID.
    Supports 1-to-MANY mapping: One mobile phone can unlock multiple accounts.
    """
    db = get_db_connection()
    try:
        if force_login:
             # ACTION: LOGIN TAP FROM PHONE
             import time
             # Find ALL accounts linked to this specific key
             linked_users = list(db.users.find({"nfc_uid": nfc_uid}))
             
             if not linked_users:
                 return False, "This mobile/card is not registered to any account."

             # Create a pending login for EVERY account this phone has access to
             login_records = []
             for user in linked_users:
                 login_records.append({
                    "device_id": user['device_id'],
                    "timestamp": time.time(),
                    "consumed": False
                 })
             
             db.pending_bluetooth_logins.insert_many(login_records)
             log_event(f"Multi-Account Sensor Tap: {len(linked_users)} accounts authorized by {nfc_uid}")
             return True, f"Login Tap Broadcast to {len(linked_users)} accounts"

        # ACTION: REGISTRATION / LINKING
        # We NO LONGER strip the key from others. We simply add it to THIS user.
        
        # 1. Bind to the target device
        result = db.users.update_one(
            {"device_id": device_id},
            {"$set": {"nfc_uid": nfc_uid}}
        )
        
        if result.matched_count > 0:
            log_event(f"Key Linked: {device_id} -> {nfc_uid}")
            return True, "Success: Key linked to existing device."
        else:
            # 2. UPSERT: If device ID is new, create the record
            new_seed = pyotp.random_base32()
            db.users.insert_one({
                "device_id": device_id,
                "nfc_uid": nfc_uid,
                "secret_seed": new_seed
            })
            log_event(f"New Device Created: {device_id}")
            return True, "Success: New device registered and key linked."

    except Exception as e:
        return False, str(e)
def verify_nfc(nfc_uid):
    """
    Verifies an NFC UID and returns the associated device_id.
    """
    db = get_db_connection()
    user = db.users.find_one({"nfc_uid": nfc_uid})
    
    if user:
        log_event(f"NFC Login Success: {user['device_id']}")
        return True, user['device_id']
    else:
        log_event(f"NFC Login Failed: Unknown UID {nfc_uid}")
        return False, None

def register_rsa_device(device_id, nfc_uid, public_key_pem, initial_salt):
    """
    Registers the RSA Public Key for a device.
    """
    db = get_db_connection()
    try:
        # Update One: Add public_key and nfc_uid to the device_id user
        result = db.users.update_one(
            {"device_id": device_id},
            {"$set": {
                "nfc_uid": nfc_uid,
                "rsa_public_key": public_key_pem,
                "last_fusion_salt": initial_salt  # GENESIS SALT
            }}
        )
        
        if result.matched_count == 0:
            # Create new if doesn't exist
            new_seed = pyotp.random_base32()
            db.users.insert_one({
                "device_id": device_id,
                "nfc_uid": nfc_uid,
                "secret_seed": new_seed,
                "rsa_public_key": public_key_pem,
                "last_fusion_salt": initial_salt,
                "chain_history": "GENESIS_BLOCK"
            })
            log_event(f"New RSA Device Created: {device_id}")
            return True, "Registered new device with RSA Key"
            
        log_event(f"RSA Key Updated: {device_id}")
        return True, "RSA Key Linked to Device"
    except Exception as e:
        return False, str(e)


def verify_rsa_login(device_id, nfc_uid, signature_b64, timestamp, magnetic_proof, magnetic_salt):
    """
    Verifies the RSA Signature of the login packet.
    Packet: "{device_id}:{nfc_uid}:{timestamp}:{magnetic_proof}:{magnetic_salt}"
    """
    db = get_db_connection()
    try:
        # 1. Fetch User by UID (Mobile Key)
        user = db.users.find_one({"nfc_uid": nfc_uid})
        
        if not user:
            # Fallback
            user = db.users.find_one({"device_id": device_id})
            if not user or 'rsa_public_key' not in user:
                 return False, f"Mobile Key {nfc_uid} not found or missing RSA."
            
        public_key_pem = user['rsa_public_key']
        
        # 2. Reconstruct Data (MUST MATCH FRONTEND EXACTLY)
        data_to_verify = f"{device_id}:{nfc_uid}:{timestamp}:{magnetic_proof}:{magnetic_salt}".encode('utf-8')
        
        print("\n" + "="*50)
        print(f"🔒 CYBOT SECURE ENCLAVE -- RSA VERIFICATION 🔒")
        print(f"📡 Incoming Payload: {data_to_verify}")
        
        # 3. Decode Signature
        signature = base64.b64decode(signature_b64)
        print(f"✍️  Digital Signature: {signature_b64[:30]}...[TRUNCATED]")
        
        # 4. Load Key
        public_key = serialization.load_pem_public_key(
            public_key_pem.encode('utf-8')
        )
        print(f"🔑 Public Key Loaded. Verifying...")
        
        # 5. Verify
        public_key.verify(
            signature,
            data_to_verify,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        
        print(f"✅ CRYTPO CHECK PASSED: Signature Matches Public Key!")
        
        # --- CYBOT FUSION ENGINE ---
        import hashlib
        
        history = user.get('chain_history', 'GENESIS_BLOCK')
        secret = device_id # Using Device ID as the "Secret/Password" for this flow
        hardware = nfc_uid
        physics = magnetic_salt
        
        # The Fusion Formula
        raw_fusion = f"{history}{secret}{hardware}{physics}"
        fusion_hash = hashlib.sha256(raw_fusion.encode()).hexdigest()
        
        print("\n🧪 CYBOT FUSION ENGINE INITIALIZED")
        print(f"   ├── 📜 History:   {history[:15]}...")
        print(f"   ├── 🔐 Secret:    {secret}")
        print(f"   ├── 💳 Hardware:  {hardware}")
        print(f"   └── 🌌 Physics:   {physics} (Micro-Jitter)")
        print("-" * 40)
        print(f"🔥 FUSION HASH: {fusion_hash}")
        print("="*50 + "\n")
        
        # Update Chain for Next Time
        db.users.update_one(
            {"_id": user['_id']},
            {"$set": {"chain_history": fusion_hash}}
        )

        
        # 6. Success! Create Pending Login for Laptop
        db.pending_bluetooth_logins.insert_one({
            "device_id": device_id,
            "timestamp": time.time(),
            "consumed": False,
            "method": "RSA_CRYPTO_MAGNETIC"
        })
        
        log_event(f"RSA LOGIN VERIFIED: {device_id} (Mag: {magnetic_proof})")
        return True, "Signature Verified. Access Granted."
        
    except InvalidSignature:
        log_event(f"RSA FAILURE: Signature Mismatch for {device_id}")
        return False, "Digital Signature Verification Failed"
    except Exception as e:
        log_event(f"RSA ERROR: {e}")
        return False, f"Crypto Error: {str(e)}"
