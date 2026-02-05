
import socket
import sys

def check_bt():
    try:
        print(f"Python: {sys.version}")
        if hasattr(socket, 'AF_BLUETOOTH'):
            print("AF_BLUETOOTH exists.")
            s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
            print("Socket created successfully.")
            return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    check_bt()
