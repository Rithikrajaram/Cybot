from flask import Flask, render_template, request, redirect, url_for, session, flash
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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    device_id = request.form['device_id']
    token = request.form['token']
    
    success, message = verify_login(device_id, token)
    
    if success:
        session['user'] = device_id
        flash("Login Successful! You are now working Offline.", "success")
        return redirect(url_for('dashboard'))
    else:
        flash(f"Login Failed: {message}", "error")
        return redirect(url_for('index'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    device_id = None
    secret = None
    encoded_img = None
    error = None

    if request.method == 'POST':
        custom_name = request.form.get('device_name')
        if not custom_name:
            error = "Device Name cannot be empty."
        else:
            device_id, secret = register_device(custom_name)
            if not device_id:
                error = "Device Name already taken. Please choose another."
    
    if request.method == 'GET':
        # Just show the form initially
        return render_template('register.html')

    if error:
        return render_template('register.html', error=error)

    # If success (or auto-generated if we wanted that, but we forced post for custom name)
    uri = get_totp_uri(device_id, secret)
    
    # Generate QR Code Image in memory
    img = qrcode.make(uri)
    data = io.BytesIO()
    img.save(data)
    encoded_img = base64.b64encode(data.getvalue()).decode('utf-8')
    
    return render_template('register_success.html', device_id=device_id, secret=secret, qr_data=encoded_img)

@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html', user=session['user'])

@app.route('/logs')
def logs():
    # Verify integrity before showing
    is_valid, status = verify_chain_integrity()
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM audit_logs ORDER BY id DESC")
    logs = c.fetchall()
    conn.close()
    
    return render_template('logs.html', logs=logs, integrity_status=status, is_valid=is_valid)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))

# --- PASSKEY ROUTES ---

@app.route('/register/passkey/options', methods=['POST'])
def register_passkey_options():
    data = request.json
    username = data.get('username')
    
    # Check if user exists or create them to get a stable ID
    # In this app, device_id IS the username/ID.
    # We try to register. If it fails (exists), we fetch the existing ID?
    # Or should we enforce unique usernames? register_device enforces unique.
    
    # For this flow: If user enters a name, we try to create it.
    # If it exists, we can't 're-register' usually unless we are adding a credential to existing account.
    # But for simplicity: If 'device_name' exists, we assume duplication error.
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE device_id = ?", (username,))
    existing = c.fetchone()
    conn.close()

    if existing:
        # If user exists, we might imply "Adding a passkey to existing account"
        # OR we error. Let's error for now to avoid confusion, or handle gracefully.
        # But wait, what if they just want to add a passkey?
        # Let's simple check: if existing, use that ID.
        user_id = existing['device_id']
    else:
        # Create new user
        user_id, _ = register_device(username)
        if not user_id:
             return {"error": "Username taken or invalid"}, 400
    
    options = generate_reg_options(user_id, username)
    # Store challenge as string for Flask session
    from webauthn.helpers import bytes_to_base64url
    session['current_registration_challenge'] = bytes_to_base64url(options.challenge)
    return options_to_json(options)

@app.route('/register/passkey/verify', methods=['POST'])
def register_passkey_verify():
    data = request.json
    username = data.get('username')
    passkey_data = data.get('passkey_data') # This is a JSON string passed from JS
    
    challenge = session.get('current_registration_challenge')
    if not challenge:
        return {"success": False, "message": "Challenge expired"}, 400

    success, message = verify_reg_response(passkey_data, challenge, username)
    if success:
        session['user'] = username # Auto login
        flash("Passkey Registered Successfully!", "success")
        return {"success": True, "redirect_url": url_for('dashboard')}
    else:
        return {"success": False, "message": f"Verification failed: {message}"}, 400

@app.route('/login/passkey/options', methods=['POST'])
def login_passkey_options():
    try:
        data = request.json
        username = data.get('username')
        
        # If username is empty, we act as 'discoverable' (but our backend logic currently expects user_id for allowCredentials if not discoverable)
        # PasskeyManager generate_auth_options uses get_credentials(user_id).
        # We need to handle the case where username is known.
        
        options = generate_auth_options(username)
        from webauthn.helpers import bytes_to_base64url
        session['current_authentication_challenge'] = bytes_to_base64url(options.challenge)
        return options_to_json(options)
    except Exception as e:
        print(e)
        return {"error": str(e)}, 400

@app.route('/login/passkey/verify', methods=['POST'])
def login_passkey_verify():
    data = request.json
    passkey_data = data.get('passkey_data')
    username_hint = data.get('username') # Might be empty
    
    challenge = session.get('current_authentication_challenge')
    if not challenge:
        return {"success": False, "message": "Challenge expired"}, 400
        
    success, user_id_or_error = verify_auth_response(passkey_data, challenge, username_hint)
    
    if success:
        session['user'] = user_id_or_error
        flash("Logged in with Passkey!", "success")
        return {"success": True, "redirect_url": url_for('dashboard')}
    else:
        return {"success": False, "message": f"Authentication failed: {user_id_or_error}"}, 400


if __name__ == '__main__':
    app.run(debug=True, port=5000)
