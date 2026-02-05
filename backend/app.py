from flask import Flask, request, session, jsonify
from flask_cors import CORS
import qrcode
import io
import base64
import json
from auth_manager import register_device, get_totp_uri, verify_login
from passkey_manager import (
    generate_reg_options,
    verify_reg_response,
    generate_auth_options,
    verify_auth_response,
    options_to_json
)
from logger import verify_chain_integrity
from secure_db import get_db_connection

app = Flask(__name__)
app.secret_key = 'SUPER_SECRET_OFFLINE_KEY'
# Allow CORS for the React frontend
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])

@app.route('/api/status')
def status():
    return jsonify({"status": "online", "message": "Secure Authentication API is running"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    device_id = data.get('device_id')
    token = data.get('token')
    
    if not device_id or not token:
        return jsonify({"success": False, "message": "Missing device_id or token"}), 400

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
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM audit_logs ORDER BY id DESC")
    logs_data = [dict(row) for row in c.fetchall()]
    conn.close()
    
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

# --- PASSKEY ROUTES ---

@app.route('/api/register/passkey/options', methods=['POST'])
def register_passkey_options():
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"error": "Username required"}), 400

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE device_id = ?", (username,))
    existing = c.fetchone()
    conn.close()

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
        session['user'] = user_id_or_error
        return jsonify({"success": True, "message": "Logged in with Passkey", "user": user_id_or_error})
    else:
        return jsonify({"success": False, "message": f"Authentication failed: {user_id_or_error}"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
