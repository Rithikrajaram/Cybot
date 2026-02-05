from flask import Flask, request, session, jsonify
from flask_cors import CORS
import qrcode
import io
import base64
import json
from auth_manager import register_device, get_totp_uri, verify_login, register_nfc
from passkey_manager import (
    generate_reg_options,
    verify_reg_response,
    generate_auth_options,
    verify_auth_response,
    options_to_json
)
from logger import verify_chain_integrity
from secure_db import get_db_connection
import time

app = Flask(__name__)
app.secret_key = 'SUPER_SECRET_OFFLINE_KEY'
# Allow CORS for the React frontend (HTTP & HTTPS) and Mobile IPs
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "https://localhost:5173", "*"])

@app.route('/api/status')
def status():
    return jsonify({"status": "online", "message": "Secure Authentication API is running"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    device_id = data.get('device_id')
    token = data.get('token')
    
    if not device_id:
        return jsonify({"success": False, "message": "Missing device_id"}), 400

    success, message = verify_login(device_id, token)
    
    if success:
        session['user'] = device_id
        return jsonify({"success": True, "message": "Login Successful", "user": device_id})
    else:
        return jsonify({"success": False, "message": f"Login Failed: {message}"}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    custom_name = data.get('device_name')
    
    if not custom_name:
        return jsonify({"success": False, "message": "Device Name cannot be empty"}), 400
    
    device_id, secret = register_device(custom_name)
    if not device_id:
        return jsonify({"success": False, "message": "Device Name already taken"}), 400
    
    uri = get_totp_uri(device_id, secret)
    
    # Generate QR Code Image
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf)
    encoded_img = base64.b64encode(buf.getvalue()).decode('utf-8')
    
    return jsonify({
        "success": True,
        "device_id": device_id,
        "secret": secret,
        "qr_data": encoded_img
    })

@app.route('/api/dashboard')
def dashboard():
    if 'user' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    return jsonify({"success": True, "user": session['user']})

@app.route('/api/logs')
def logs():
    if 'user' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    # Verify integrity before showing
    is_valid, status_msg = verify_chain_integrity()
    
    db = get_db_connection()
    logs_data = list(db.audit_logs.find().sort("_id", -1))
    
    # Convert ObjectIds to strings
    for log in logs_data:
        log['_id'] = str(log['_id'])
    
    return jsonify({
        "success": True,
        "logs": logs_data,
        "integrity_status": status_msg,
        "is_valid": is_valid
    })

@app.route('/api/logout')
def logout():
    session.pop('user', None)
    return jsonify({"success": True, "message": "Logged out"})

# --- NFC / BLUETOOTH ROUTES ---

@app.route('/api/register/nfc', methods=['POST'])
def register_nfc_card():
    data = request.json
    force_login = data.get('force_login', False)
    device_id = data.get('device_id', 'Unknown-PC' if force_login else None)
    nfc_uid = data.get('nfc_uid')
    
    if (not device_id and not force_login) or not nfc_uid:
        return jsonify({"success": False, "message": "Missing device_id or nfc_uid"}), 400

    success, message = register_nfc(device_id, nfc_uid, force_login=force_login)
    if success:
        return jsonify({"success": True, "message": message})
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/api/auth/bluetooth-poll', methods=['POST'])
def check_bluetooth_login():
    """
    Frontend calls this every 2 seconds when in 'Waiting for Bluetooth' mode.
    """
    db = get_db_connection()
    now = time.time()
    
    # Find a pending login from the last 10 seconds that hasn't been consumed
    # We really should have a session ID or something to link it, 
    # but for this demo, we'll take the most recent authorized tapped card.
    
    data = request.json or {}
    target_device_id = data.get('device_id')
    
    # SECURITY FIX: If no device_id is provided, we MUST NOT return any logins.
    # Otherwise, it would return the most recent login for ANY user (Session Hijacking).
    if not target_device_id:
        return jsonify({"success": False, "message": "Missing device_id"}), 200

    query = {
        "device_id": target_device_id,
        "consumed": False,
        "timestamp": {"$gt": now - 10} # Valid for 10 seconds
    }

    login = db.pending_bluetooth_logins.find_one(query, sort=[("timestamp", -1)])
    
    if login:
        # Mark consumed
        db.pending_bluetooth_logins.update_one(
            {"_id": login['_id']},
            {"$set": {"consumed": True}}
        )
        
        # Log user in
        device_id = login['device_id']
        session['user'] = device_id
        return jsonify({"success": True, "message": "Bluetooth Login Successful", "user": device_id})
        
    return jsonify({"success": False, "message": "No login detected"}), 200

# --- PASSKEY ROUTES ---

@app.route('/api/register/passkey/options', methods=['POST'])
def register_passkey_options():
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"error": "Username required"}), 400

    db = get_db_connection()
    existing = db.users.find_one({"device_id": username})

    if existing:
        user_id = existing['device_id']
    else:
        user_id, _ = register_device(username)
        if not user_id:
             return jsonify({"error": "Username taken or invalid"}), 400
    
    options = generate_reg_options(user_id, username)
    from webauthn.helpers import bytes_to_base64url
    session['current_registration_challenge'] = bytes_to_base64url(options.challenge)
    return options_to_json(options)

@app.route('/api/register/passkey/verify', methods=['POST'])
def register_passkey_verify():
    data = request.json
    username = data.get('username')
    passkey_data = data.get('passkey_data')
    
    challenge = session.get('current_registration_challenge')
    if not challenge:
        return jsonify({"success": False, "message": "Challenge expired"}), 400

    success, message = verify_reg_response(passkey_data, challenge, username)
    if success:
        session['user'] = username
        return jsonify({"success": True, "message": "Passkey Registered Successfully"})
    else:
        return jsonify({"success": False, "message": f"Verification failed: {message}"}), 400

@app.route('/api/login/passkey/options', methods=['POST'])
def login_passkey_options():
    try:
        data = request.json
        username = data.get('username')
        
        options = generate_auth_options(username)
        from webauthn.helpers import bytes_to_base64url
        session['current_authentication_challenge'] = bytes_to_base64url(options.challenge)
        return options_to_json(options)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/login/passkey/verify', methods=['POST'])
def login_passkey_verify():
    data = request.json
    passkey_data = data.get('passkey_data')
    username_hint = data.get('username')
    
    challenge = session.get('current_authentication_challenge')
    if not challenge:
        return jsonify({"success": False, "message": "Challenge expired"}), 400
        
    success, user_id_or_error = verify_auth_response(passkey_data, challenge, username_hint)
    
    if success:
        log_event(f"Passkey Login Success: {user_id_or_error}") # <--- This merges it into the SHA-256 Chain
        session['user'] = user_id_or_error
        return jsonify({"success": True, "message": "Logged in with Passkey", "user": user_id_or_error})
    else:
        return jsonify({"success": False, "message": f"Authentication failed: {user_id_or_error}"}), 400

if __name__ == '__main__':
    # Use persistent SSL certs if available, otherwise adhoc
    import os
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        ssl_context = ('cert.pem', 'key.pem')
        print(" Using persistent SSL certificates.")
    else:
        ssl_context = 'adhoc'
        print(" Warning: Using temporary adhoc SSL certificates.")

    app.run(debug=True, port=5000, host='0.0.0.0', ssl_context=ssl_context)
