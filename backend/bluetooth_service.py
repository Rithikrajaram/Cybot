
import socket
import json
import time
import threading
from secure_db import get_db_connection
from auth_manager import verify_nfc

# Windows Bluetooth RFCOMM Server
def start_bluetooth_server():
    server_sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
    
    bind_success = False
    port_used = 0
    
    # Try ports 1 through 10
    for port in range(1, 11):
        try:
            print(f"Attempting to bind to RFCOMM Channel {port}...")
            server_sock.bind((socket.BDADDR_ANY, port))
            server_sock.listen(1)
            port_used = port
            bind_success = True
            print(f"Successfully bound to Channel {port}")
            break
        except PermissionError:
            print(f"Channel {port} is reserved or requires Admin. Trying next...")
        except OSError as e:
            print(f"Channel {port} error: {e}")
            
    if not bind_success:
        print("CRITICAL ERROR: Could not bind to any RFCOMM channel (1-10).")
        print("Try running VS Code as Administrator or check if Bluetooth is enabled.")
        return

    print(f"Bluetooth Service Listening on Channel {port_used}.")
    print("Waiting for connection...")

    while True:
        try:
            client_sock, address = server_sock.accept()
            print(f"Accepted connection from {address}")
            
            # Handle client in a thread or inline (inline for simplicity in this demo)
            handle_client(client_sock)
        except Exception as e:
            print(f"Error accepting connection: {e}")
            time.sleep(1)

def handle_client(sock):
    try:
        data = sock.recv(1024)
        if not data:
            return

        print(f"Received data: {data}")
        try:
            # Expecting JSON: {"nfc_uid": "..."}
            # Or if it's raw text, handle that too
            decoded = data.decode('utf-8').strip()
            
            # Try parsing JSON
            try:
                payload = json.loads(decoded)
                nfc_uid = payload.get('nfc_uid')
            except:
                # Fallback to raw string
                nfc_uid = decoded

            if nfc_uid:
                print(f"Verifying NFC UID: {nfc_uid}")
                success, device_id = verify_nfc(nfc_uid)
                
                if success:
                    print(f"Login Validated for {device_id}")
                    # Store in DB for the Web App to pick up
                    db = get_db_connection()
                    db.pending_bluetooth_logins.insert_one({
                        "device_id": device_id,
                        "timestamp": time.time(),
                        "consumed": False
                    })
                    sock.send(b"OK")
                else:
                    print("Invalid NFC")
                    sock.send(b"DENY")
            else:
                sock.send(b"ERR_FORMAT")
                
        except Exception as e:
            print(f"Processing error: {e}")
            
    except Exception as e:
        print(f"Connection error: {e}")
    finally:
        sock.close()
        print("Connection closed")

if __name__ == "__main__":
    start_bluetooth_server()
