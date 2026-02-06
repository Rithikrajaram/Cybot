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
from logger import verify_chain_integrity, log_event
from secure_db import get_db_connection
from sync_manager import sync_manager
import time
import os
from dotenv import load_dotenv
import tempfile
import whisper
import numpy as np
import imageio_ffmpeg

load_dotenv()

# Ensure ffmpeg is found (required by Whisper)
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
os.environ["PATH"] += os.pathsep + os.path.dirname(FFMPEG_PATH)

# Initialize Local Whisper (Base English-only model for better accuracy)
print("Loading Local Whisper English Model (base.en)... (may take a moment)")
whisper_model = whisper.load_model("base.en")
print("Whisper English Model (base.en) Loaded! 🎙️🇬🇧")

from voice_auth import VoiceAuthenticator
voice_authenticator = VoiceAuthenticator(threshold=0.7)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024 # 32MB Upload Limit
app.secret_key = os.getenv("SECRET_KEY", "SUPER_SECRET_OFFLINE_KEY")
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
    print(f"DEBUG: /api/register/nfc received: {data}")
    force_login = data.get('force_login', False)
    # Robust extraction of fields
    nfc_uid = data.get('nfc_uid')
    
    # If device_id is missing or empty, use fallback if in force_login mode
    device_id = data.get('device_id')
    if not device_id:
        device_id = 'Unknown-PC' if force_login else None

    if not nfc_uid:
        return jsonify({"success": False, "message": "Missing nfc_uid"}), 400
    
    if not device_id and not force_login:
        return jsonify({"success": False, "message": "Missing device_id"}), 400

    success, message = register_nfc(device_id, nfc_uid, force_login=force_login)
    if success:
        return jsonify({"success": True, "message": message})
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/api/auth/bluetooth-poll', methods=['POST'])
def check_bluetooth_login():
    db = get_db_connection()
    now = time.time()
    data = request.json or {}
    target_device_id = data.get('device_id')
    
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

# --- RSA DEVICE ROUTES (NEW) ---

@app.route('/api/register_device', methods=['POST'])
def api_register_device():
    """
    Registers a mobile device key (Magnetic/NFC) + RSA Public Key.
    """
    from auth_manager import register_rsa_device
    data = request.json
    device_id = data.get('device_id')
    nfc_uid = data.get('uid')
    public_key = data.get('public_key')
    initial_salt = data.get('initial_salt', '000000000')
    
    if not device_id or not nfc_uid or not public_key:
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    success, msg = register_rsa_device(device_id, nfc_uid, public_key, initial_salt)
    if success:
        return jsonify({"success": True, "message": msg})
    return jsonify({"success": False, "message": msg}), 400


@app.route('/api/login_device', methods=['POST'])
def api_login_device():
    """
    Verifies a Signed Login Request (Mag/NFC + RSA Signature + Physics).
    """
    from auth_manager import verify_rsa_login
    data = request.json
    device_id = data.get('device_id')
    nfc_uid = data.get('uid')
    signature = data.get('signature')
    timestamp = data.get('timestamp')
    magnetic_proof = data.get('magnetic_proof')
    magnetic_salt = data.get('magnetic_salt', '000000000')

    if not all([device_id, nfc_uid, signature, timestamp, magnetic_proof]):
        return jsonify({"success": False, "message": "Missing crypto parameters"}), 400

    success, msg = verify_rsa_login(device_id, nfc_uid, signature, timestamp, magnetic_proof, magnetic_salt)
    if success:
        return jsonify({"success": True, "message": msg})
    return jsonify({"success": False, "message": msg}), 401

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
        log_event(f"Passkey Login Success: {user_id_or_error}")
        session['user'] = user_id_or_error
        return jsonify({"success": True, "message": "Logged in with Passkey", "user": user_id_or_error})
    else:
        return jsonify({"success": False, "message": f"Authentication failed: {user_id_or_error}"}), 400

# --- VOICE AUTH ROUTES (NEW) ---
from voice_manager import store_voice_pattern, get_voice_pattern

@app.route('/api/voice/register', methods=['POST'])
def voice_register():
    """
    Register a voice spectral pattern and secret phrase (Local Whisper).
    """
    try:
        data = request.json
        user_id = data.get('user_id')
        spectral_data = data.get('audio_data') 
        audio_blob_b64 = data.get('audio_blob')

        if not user_id or not spectral_data or not audio_blob_b64:
            return jsonify({"success": False, "message": "Missing required data"}), 400

        # 1. Local Transcription with Whisper
        audio_bytes = base64.b64decode(audio_blob_b64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            result = whisper_model.transcribe(tmp_path, fp16=False, language="en", task="transcribe")
            voice_text = result['text'].strip().lower().replace(".", "").replace(",", "")
            os.remove(tmp_path)
        except Exception as e:
            if os.path.exists(tmp_path): os.remove(tmp_path)
            print(f"Whisper Error: {e}")
            return jsonify({"success": False, "message": f"Whisper error: {str(e)}"}), 500

        if not voice_text:
             return jsonify({
                 "success": False, 
                 "message": "Whisper could not hear any words. Speak louder!"
             }), 400

        # 2. Store in DB
        if store_voice_pattern(user_id, spectral_data, voice_text):
             return jsonify({
                 "success": True, 
                 "message": f"Registered! Whisper heard: '{voice_text}'",
                 "recognized_text": voice_text
             })
        else:
            return jsonify({"success": False, "message": "Database error."}), 500

    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500

print("DEBUG: Registering /api/voice/authenticate route")
@app.route('/api/voice/authenticate', methods=['POST'])
def authenticate_voice():
    """
    Strict Hybrid Authentication (100% Local Whisper):
    """
    try:
        data = request.json
        user_id = data.get('user_id')
        spectral_input = data.get('audio_data')
        audio_blob_b64 = data.get('audio_blob')

        if not user_id or not spectral_input or not audio_blob_b64:
            return jsonify({"success": False, "message": "Missing required data"}), 400

        # 1. Local Transcription with Whisper
        audio_bytes = base64.b64decode(audio_blob_b64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            result = whisper_model.transcribe(tmp_path, fp16=False, language="en", task="transcribe")
            input_text = result['text'].strip().lower().replace(".", "").replace(",", "")
            os.remove(tmp_path)
        except Exception as e:
            if os.path.exists(tmp_path): os.remove(tmp_path)
            print(f"Whisper Error during Auth: {e}")
            return jsonify({"success": False, "message": f"Whisper failed: {str(e)}"}), 500

        if not input_text:
             return jsonify({
                 "success": False, 
                 "message": "Whisper could not hear any words. Speak clearly!"
             }), 400

        # 2. Get Stored Data
        stored_data = get_voice_pattern(user_id)
        if not stored_data or not stored_data.get("pattern"):
            return jsonify({"success": False, "message": "No voice print for this user."}), 404

        stored_print = stored_data["pattern"]
        stored_text = stored_data.get("text", "").lower().strip()

        # 3. Security Checks (Text + Lenient Rhythm check +/- 50)
        text_match = (input_text == stored_text)
        
        # Strip silence before comparing "rhythm" (frame counts)
        s1_stripped = voice_authenticator.extract_voice_print(stored_print)
        s2_stripped = voice_authenticator.extract_voice_print(spectral_input)
        
        input_frames = len(s2_stripped)
        stored_frames = len(s1_stripped)
        frame_diff = abs(input_frames - stored_frames)
        # Increased tolerance to 50 as requested for better usability
        frame_match = frame_diff <= 50

        print(f"DEBUG LOCAL AUTH: Text: '{input_text}' vs '{stored_text}' | Match: {text_match}")
        print(f"DEBUG LOCAL AUTH: Stripped Frames: {input_frames} vs {stored_frames} | Diff: {frame_diff} | Match: {frame_match}")

        # Security: Fail if text or frame rhythm is way off
        if not text_match:
            return jsonify({
                "success": False, 
                "message": f"Phrase mismatch. Whisper heard: '{input_text}' (Stored: '{stored_text}')",
                "recognized_text": input_text
            }), 401
        
        if not frame_match:
            return jsonify({
                "success": False, 
                "message": f"Rhythm mismatch (Frames diff: {frame_diff} > 50). Try speaking at your registered speed.",
                "recognized_text": input_text
            }), 401

        # 4. Spectral Verification
        original_threshold = voice_authenticator.threshold
        voice_authenticator.threshold = original_threshold * 1.5 
        success, message, distance = voice_authenticator.verify_voice(stored_print, spectral_input)
        voice_authenticator.threshold = original_threshold

        if success:
             session['user'] = user_id
             return jsonify({
                 "success": True, 
                 "message": f"Access Granted! (Whisper word: '{input_text}')",
                 "user": user_id,
                 "recognized_text": input_text
             })
        else:
             return jsonify({
                 "success": False, 
                 "message": f"Voice match failed (Spectral diff: {distance:.3f}).",
                 "recognized_text": input_text
             }), 401

    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500

# --- FACE AUTH ROUTES ---
from face_auth_manager import register_face, verify_face_liveness, verify_face_login

@app.route('/api/face/register', methods=['POST'])
def face_register():
    data = request.json
    username = data.get('username')
    images = data.get('images')
    
    if not username or not images:
        return jsonify({"success": False, "message": "Missing username or face data"}), 400
        
    success, message = register_face(username, images)
    return jsonify({"success": success, "message": message}), 200 if success else 400

@app.route('/api/face/login', methods=['POST'])
def face_login():
    data = request.json
    username = data.get('username')
    liveness_images = data.get('liveness_images')
    match_image = data.get('match_image')
    
    if not username or not liveness_images or not match_image:
        return jsonify({"success": False, "message": "Missing biometric data"}), 400
        
    # 1. Verify Liveness
    is_live = verify_face_liveness(liveness_images)
    if not is_live:
        return jsonify({"success": False, "message": "Liveness check failed. Please blink."}), 403
        
    # 2. Verify Face Match
    success, message = verify_face_login(username, match_image)
    if success:
        session['user'] = username
        return jsonify({"success": True, "message": "Face login successful", "user": username})
    else:
        return jsonify({"success": False, "message": message}), 401

if __name__ == '__main__':
    # Start Background Sync Thread
    sync_manager.start()
    
    import os
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        ssl_context = ('cert.pem', 'key.pem')
        print(" Using persistent SSL certificates.")
    else:
        ssl_context = 'adhoc'
        print(" Warning: Using temporary adhoc SSL certificates.")

    print("Routes registered:")
    print(app.url_map)
    app.run(debug=True, port=5000, host='0.0.0.0', ssl_context=ssl_context)
