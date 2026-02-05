# Cybot Secure Authenticator

![Status](https://img.shields.io/badge/Status-Operational-green?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-Zero_Trust-blue?style=for-the-badge)
![Encryption](https://img.shields.io/badge/Encryption-SHA--256-blueviolet?style=for-the-badge)

**Cybot Secure** is a next-generation identity management platform designed for high-security environments. It moves beyond traditional passwords, implementing a **Zero Trust** architecture backed by hardware-level cryptographic verification (WebAuthn/Passkeys) and time-based one-time passwords (TOTP).

---

## 🛡️ Key Features

### 🔐 Advanced Authentication
- **Hardware Passkeys**: Native integration with TouchID, FaceID, and YubiKeys via WebAuthn API.
- **TOTP Protocol**: Industry-standard Time-based One-Time Password support (Google Authenticator / Authy).
- **Device Binding**: Cryptographic binding of user sessions to specific hardware devices.

### 👁️ Command Center UI
- **Professional Aesthetic**: "Titanium & Obsidian" dark mode theme designed for long-exposure readability.
- **Reactive Interfaces**: Real-time status indicators, micro-interactions, and smooth framer-motion animations.
- **High-Density Data**: Dashboard visualization of system load, memory integrity, and network status in a bento-grid layout.

### ⛓️ Immutable Audit
- **Merkle-Hashed Logs**: All session actions are logged and cryptographically chained to prevent tampering.
- **Live Monitoring**: Real-time visibility into authentication attempts and system access.

---

## 🛠️ Technology Stack

### Frontend (Client)
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS (Custom "Neo-Swiss" Design System)
- **Icons**: Lucide React
- **State/Effects**: React Hooks + CSS Variables

### Backend (Server)
- **Runtime**: Python 3.10+
- **Framework**: Flask
- **Security**: PyOpenSSL, WebAuthn, QRCode
- **API**: RESTful JSON endpoints

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- Python (v3.8+)

### 1. Backend Setup
Initialize the secure API server.

```bash
cd backend
# Create virtual environment (Optional but Recommended)
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install flask flask-cors qrcode pyopenssl webauthn

# Launch the secure core
python app.py
```
*Server runs on port `5000`*

### 2. Frontend Setup
Launch the command center interface.

```bash
cd frontend
# Install dependencies
npm install

# Initialize development server
npm run dev
```
*Client runs on port `5173`

---

## 📸 System Previews

### Landing Terminal
The entry point featuring system status metrics and dual-pathway authentication selection.

### Secure Dashboard
A high-fidelity overview of the user's secure session, complete with an isolated environment simulation and real-time encryption status.

