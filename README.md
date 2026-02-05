# 🛡️ Cybot Secure Authenticator (v2.0)
> *Next-Generation Zero Trust Identity Management Platform*

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18-cyan?style=for-the-badge&logo=react)
![Flask](https://img.shields.io/badge/Flask-3.0-black?style=for-the-badge&logo=flask)
![MongoDB](https://img.shields.io/badge/MongoDB-Distributed-green?style=for-the-badge&logo=mongodb)
![Security](https://img.shields.io/badge/Security-Zero_Trust-blue?style=for-the-badge)

**Cybot Secure** is an enterprise-grade identity management platform designed for high-security environments. It moves beyond traditional passwords, implementing a **Zero Trust** architecture backed by hardware-level cryptographic verification (FIDO2 Passkeys), AI-driven face recognition with liveness detection, and an intelligent offline-first synchronization engine.

---

## ⚡ Key Features

### 🔐 Multi-Modal Authentication
- **AI Face Recognition**: Biometric logic with liveness detection (blink check) and 128d facial embedding matching via ResNet.
- **FIDO2 Passkeys**: WebAuthn integration for passwordless, hardware-bound security (TouchID, FaceID, YubiKeys).
- **Mobile Key Tap**: Direct phone-to-PC authentication via NFC and Magnetic (Hall Effect) sensors.
- **TOTP Protocol**: Industry-standard Time-based One-Time Password support for traditional 2FA.

### 📡 Offline-First Resilience
- **Primary Local Storage**: All authentication events and credentials are saved locally first to ensure 100% availability during network outages.
- **Background Sync Engine**: An intelligent `SyncManager` monitors connectivity and automatically replicates data to Cloud MongoDB when online (30s interval).
- **Dual-Database Strategy**: Seamlessly handles state across local (`mongodb://localhost`) and remote Atlas instances.

### 👁️ Command Center UI
- **Obsidian Design System**: High-fidelity "Titanium & Obsidian" UI with deep glassmorphism and premium aesthetics.
- **Reactive Radar**: Dynamic sensor feedback UI for mobile and desktop interactions.
- **Real-time Metrics**: Live system load, memory integrity, and encryption status visualization.

### ⛓️ Immutable Audit Logs
- **Hash Chaining**: Every log entry is cryptographically linked to the previous one using SHA-256 (Merkle-style chaining).
- **Tamper Evidence**: Any modification to the database results in a broken chain, making unauthorized changes immediately detectable.

---

## 🛠️ Technology Stack

### Frontend (Client)
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS + Custom Design System tokens
- **Icons**: Lucide React
- **Sensors**: NDEF Reader (NFC) & Magnetometer API

### Backend (Server)
- **Runtime**: Python 3.10+
- **Framework**: Flask (HTTPS / SSL Enabled)
- **Biometrics**: Face Recognition (HOG/CNN), OpenCV, Numpy
- **Database**: Dual MongoDB (PyMongo + Atlas Sync)
- **Security**: PyOpenSSL, WebAuthn, PyOTP, python-dotenv

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MongoDB Community Server (Running on localhost:27017)
- C++ Build Tools (Required for `dlib`/`face_recognition`)

### 1. Backend Setup
Initialize the secure API server with all cryptographic and biometric modules.

```bash
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install all required security and processing modules
pip install flask flask-cors qrcode pyopenssl webauthn pymongo dnspython face_recognition numpy opencv-python python-dotenv

# Configure Environment
# Create a .env file with your specific Mongo URIs:
# LOCAL_MONGO_URI=mongodb://localhost:27017/
# CLOUD_MONGO_URI=your_atlas_connection_string
# DB_NAME=secure_enclave_db
# SECRET_KEY=your_secret

# Launch the secure core
python app.py
```

### 2. Frontend Setup
Launch the visual command center.

```bash
cd frontend
npm install
npm run dev
```

---

## 📸 System Previews

### 1. Landing Terminal
The high-security entry point featuring system status metrics and multi-pathway authentication selection.

### 2. Biometric Enrollment
Interactive camera interface with real-time feedback and blink-based liveness verification.

### 3. Secure Dashboard
A bento-grid overview of the user's session, featuring isolated environment simulations and the immutable audit log.
