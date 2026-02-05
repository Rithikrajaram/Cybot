import sqlite3
import os

DB_NAME = "secure_enclave.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create Users Table (Simulating Secure Enclave storage)
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            device_id TEXT PRIMARY KEY,
            secret_seed TEXT NOT NULL,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''') # Turbo: Created users table

    # Create Credentials Table (For WebAuthn/Passkeys)
    c.execute('''
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            credential_id BLOB NOT NULL,
            public_key BLOB NOT NULL,
            sign_count INTEGER DEFAULT 0,
            transports TEXT,
            FOREIGN KEY(user_id) REFERENCES users(device_id)
        )
    ''') # Turbo: Created credentials table

    # Create Audit Logs Table (Tamper-Resistant Hash Chain)
    c.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            previous_hash TEXT NOT NULL,
            event_data TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            current_hash TEXT NOT NULL
        )
    ''') # Turbo: Created audit_logs table

    conn.commit()
    conn.close()
    print(f"Database {DB_NAME} initialized successfully.")

if __name__ == "__main__":
    init_db()
