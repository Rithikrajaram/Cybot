from OpenSSL import crypto
import os

def generate_self_signed_cert(cert_path, key_path):
    if os.path.exists(cert_path) and os.path.exists(key_path):
        print("Cert already exists.")
        return

    # create a key pair
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, 4096)

    # create a self-signed cert
    cert = crypto.X509()
    cert.get_subject().C = "US"
    cert.get_subject().ST = "Local"
    cert.get_subject().L = "Local"
    cert.get_subject().O = "Cybot Secure"
    cert.get_subject().OU = "Cybot Secure"
    cert.get_subject().CN = "10.32.50.242"
    cert.set_serial_number(1000)
    cert.set_notBefore(b"20240101000000Z")
    cert.set_notAfter(b"20340101000000Z")
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(k)
    cert.sign(k, 'sha256')

    with open(cert_path, "wt") as f:
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert).decode('utf-8'))
    with open(key_path, "wt") as f:
        f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, k).decode('utf-8'))
    print("Persistent certificates generated.")

if __name__ == "__main__":
    generate_self_signed_cert("cert.pem", "key.pem")
