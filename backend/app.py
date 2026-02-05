from flask import Flask, request, session, jsonify
from flask_cors import CORS
import qrcode
import io
import base64
import json
import os
import tempfile
import whisper
import numpy as np
import imageio_ffmpeg
from auth_manager import register_device, get_totp_uri, verify_login

# Ensure ffmpeg is found (required by Whisper)
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
os.environ["PATH"] += os.pathsep + os.path.dirname(FFMPEG_PATH)
from passkey_manager import (
    generate_reg_options,
    verify_reg_response,
    generate_auth_options,
    verify_auth_response,
    options_to_json
)
from logger import verify_chain_integrity
from secure_db import get_db
from voice_auth import VoiceAuthenticator
from voice_manager import store_voice_pattern, get_voice_pattern

app = Flask(__name__)
app.secret_key = 'SUPER_SECRET_OFFLINE_KEY'
# Session configuration for better persistence
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_HTTPONLY=True,
    # If not on HTTPS, Secure must be False
    SESSION_COOKIE_SECURE=False, 
    PERMANENT_SESSION_LIFETIME=3600 # 1 hour
)
# Allow CORS for the React frontend
CORS(app, supports_credentials=True)

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
    
    db = get_db()
    
    # Fetch logs, sort by _id desc (newest first)
    logs_cursor = db.audit_logs.find().sort("_id", -1)
    
    logs_data = []
    for log in logs_cursor:
        # Convert ObjectId to string for JSON serialization
        log['id'] = str(log['_id'])
        del log['_id']
        logs_data.append(log)
    
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

    db = get_db()
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
        session['user'] = user_id_or_error
        return jsonify({"success": True, "message": "Logged in with Passkey", "user": user_id_or_error})
    else:
        return jsonify({"success": False, "message": f"Authentication failed: {user_id_or_error}"}), 400






# Initialize Local Whisper (Base English-only model for better accuracy)
print("Loading Local Whisper English Model (base.en)... (may take a moment)")
whisper_model = whisper.load_model("base.en")
print("Whisper English Model (base.en) Loaded! 🎙️🇬🇧")

voice_authenticator = VoiceAuthenticator(threshold=0.7)

@app.route('/api/voice/register', methods=['POST'])
def register_voice():
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



if __name__ == '__main__':
    app.run(debug=True, port=5000)
