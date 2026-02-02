# Cybot - Secure Authentication System

A robust offline-first authentication system built with Flask, featuring TOTP (Time-based One-Time Password) and modern Passkey/WebAuthn support.

## 🔐 Features

- **TOTP Authentication**: Secure time-based one-time password login compatible with authenticator apps (Google Authenticator, Microsoft Authenticator, Authy, etc.)
- **Passkey/WebAuthn Support**: Modern passwordless authentication using biometrics or hardware security keys
- **Offline-First Architecture**: Works without internet connectivity after initial setup
- **Audit Logging**: Comprehensive logging with blockchain-style chain integrity verification
- **QR Code Registration**: Easy device registration using QR codes for TOTP setup

## 📁 Project Structure

```
Secure Authentication/
├── app.py                 # Main Flask application with routes
├── auth_manager.py        # TOTP authentication logic
├── passkey_manager.py     # WebAuthn/Passkey management
├── secure_db.py           # Database connection utilities
├── logger.py              # Audit logging with chain integrity
├── static/
│   └── js/
│       └── passkey.js     # Client-side passkey handling
└── templates/
    ├── base.html          # Base template with styling
    ├── index.html         # Login page
    ├── register.html      # Registration page
    ├── register_success.html  # Post-registration page with QR code
    ├── dashboard.html     # User dashboard
    └── logs.html          # Audit logs viewer
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rithikrajaram/Cybot.git
   cd Cybot
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies**
   ```bash
   pip install flask pyotp qrcode[pil] webauthn
   ```

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:5000`

## 📱 Usage

### Registration with TOTP
1. Navigate to the registration page
2. Enter a device name
3. Scan the QR code with your authenticator app
4. Use the 6-digit code from your app to log in

### Registration with Passkey
1. Navigate to the registration page
2. Enter a username
3. Choose "Register with Passkey"
4. Follow your browser's prompts to create a passkey
5. Use your passkey (fingerprint, face, or security key) for future logins

### Viewing Audit Logs
Access the `/logs` endpoint to view all authentication events with chain integrity verification.

## 🔒 Security Features

- **Encrypted Storage**: All credentials are securely stored in SQLite
- **Chain Integrity**: Audit logs use cryptographic chaining to prevent tampering
- **Secure Sessions**: Flask session management with secret key protection
- **WebAuthn**: Industry-standard passkey implementation

## 🛠️ Technologies Used

- **Backend**: Flask (Python)
- **Authentication**: PyOTP, WebAuthn
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **QR Generation**: qrcode library

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Rithikrajaram/Cybot/issues).

---

Made with ❤️ for secure, offline-first authentication
