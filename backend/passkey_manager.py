import base64
import os
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
    base64url_to_bytes,
)
from webauthn.helpers import bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    RegistrationCredential,
    AuthenticationCredential,
    AuthenticatorAttachment,
)
from secure_db import get_db_connection

RP_ID = "localhost"  # Change this to your domain in production
RP_NAME = "Secure Offline Auth"
ORIGIN = "http://localhost:5000"  # Change this to match your hosting URL

def generate_reg_options(user_id, user_name):
    """
    Generate options for creating a new credential (registration).
    """
    # Simply using user_id as both id and name for simulation, 
    # but WebAuthn expects bytes for user.id
    user_id_bytes = user_id.encode('utf-8')
    
    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=user_id_bytes,
        user_name=user_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM, # Force internal device (Offline/Secure Enclave)
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=None, 
        ),
    )
    return options

def store_credential(user_id, credential_id, public_key, sign_count, transports=None):
    """
    Store the verified credential in the database.
    """
    db = get_db_connection()
    
    try:
        db.credentials.insert_one({
            "user_id": user_id,
            "credential_id": credential_id,
            "public_key": public_key,
            "sign_count": sign_count,
            "transports": transports
        })
    except Exception as e:
        print(f"Error storing credential: {e}")
        return False, str(e)
    
    return True, "Success"

def get_credentials(user_id):
    """
    Retrieve credentials for a given user.
    """
    db = get_db_connection()
    return list(db.credentials.find({"user_id": user_id}))

def verify_reg_response(response_data, challenge, user_id):
    """
    Verify the response from the browser after user registration.
    """
    try:
        # Normalize to Dict first for consistency / fallback
        if isinstance(response_data, str):
            import json
            data = json.loads(response_data)
        elif isinstance(response_data, dict):
            data = response_data
        else:
            return False, "Invalid response_data type"

        credential = None
        
        # 1. Try Pydantic V2 'model_validate' (Takes Dict)
        if hasattr(RegistrationCredential, "model_validate"):
             try: credential = RegistrationCredential.model_validate(data)
             except: pass
        
        # 2. Try Pydantic V1 'parse_obj' (Takes Dict)
        if not credential and hasattr(RegistrationCredential, "parse_obj"):
             try: credential = RegistrationCredential.parse_obj(data)
             except: pass
             
        # 3. Try Pydantic V2 'model_validate_json' (Takes Str) - re-dump if needed
        if not credential and hasattr(RegistrationCredential, "model_validate_json"):
             try: 
                 import json
                 credential = RegistrationCredential.model_validate_json(json.dumps(data))
             except: pass

        if not credential:
             # Last resort: Try converting keys from camelCase to snake_case for direct init
             mapped_data = data.copy()
             if 'rawId' in mapped_data: mapped_data['raw_id'] = mapped_data.pop('rawId')
             if 'clientExtensionResults' in mapped_data: mapped_data['client_extension_results'] = mapped_data.pop('clientExtensionResults')
             if 'authenticatorAttachment' in mapped_data: mapped_data['authenticator_attachment'] = mapped_data.pop('authenticatorAttachment')
             
             # Nested 'response' mapping
             if 'response' in mapped_data and isinstance(mapped_data['response'], dict):
                 resp = mapped_data['response'].copy()
                 if 'clientDataJSON' in resp: resp['client_data_json'] = resp.pop('clientDataJSON')
                 if 'attestationObject' in resp: resp['attestation_object'] = resp.pop('attestationObject')
                 if 'authenticatorData' in resp: resp['authenticator_data'] = resp.pop('authenticatorData')
                 if 'userHandle' in resp: resp['user_handle'] = resp.pop('userHandle')
                 mapped_data['response'] = resp

             try:
                # Retry validation/init with snake_case data
                if hasattr(RegistrationCredential, "model_validate"): 
                    credential = RegistrationCredential.model_validate(mapped_data)
                elif hasattr(RegistrationCredential, "parse_obj"):
                    credential = RegistrationCredential.parse_obj(mapped_data)
                else:
                    credential = RegistrationCredential(**mapped_data)
             except Exception as e:
                # If that fails, final Hail Mary
                try:
                    credential = RegistrationCredential(**data)
                except:
                    raise e

        registration_verification = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
        )
        
        # If successful, save to DB
        return store_credential(
            user_id,
            registration_verification.credential_id,
            registration_verification.credential_public_key,
            registration_verification.sign_count,
            None 
        )
    except Exception as e:
        print(f"Registration Verification Failed: {e}")
        return False, str(e)

def generate_auth_options(user_id):
    """
    Generate options for logging in (authentication).
    """
    # Get all registered credentials for this user
    # to allow 'allowCredentials' list
    creds = get_credentials(user_id)
    allow_credentials = []
    
    # Not strictly necessary for 'discoverable' credentials, but good practice if we know the user
    # For now, let's assume we know the user_id trying to login
    # If we want passwordless (user enters nothing), we'd need discoverable credentials and resident keys.
    # Based on the prompt, "Sign in with Passkey" often implies we might not know who it is yet,
    # OR we ask them for their username first. 
    # Let's support the flow where we know the user (e.g. from a form) or allow empty allow_credentials for discoverable.
    
    # We will pass empty allow_credentials to let the authenticator decide/find keys for this RP
    
    options = generate_authentication_options(
        rp_id=RP_ID,
        user_verification=UserVerificationRequirement.PREFERRED,
        # allow_credentials=... # Leave empty to allow any credential for this RP (if resident key)
        # However, without resident keys, we MUST provide allow_credentials. 
        # Standard non-resident passkeys require us to tell the browser "use one of these keys".
    )
    return options

def verify_auth_response(response_data, challenge, user_id):
    """
    Verify the login response.
    """
    # We need the credential stored in DB to verify
    # The response contains the credential_id used.
    try:
        # Normalize
        if isinstance(response_data, str):
            import json
            data = json.loads(response_data)
        elif isinstance(response_data, dict):
            data = response_data
        else:
            return False, "Invalid response_data type"
            
        credential = None
        # Try generic Pydantic methods on DICT
        if hasattr(AuthenticationCredential, "model_validate"):
             try: credential = AuthenticationCredential.model_validate(data)
             except: pass
        if not credential and hasattr(AuthenticationCredential, "parse_obj"):
             try: credential = AuthenticationCredential.parse_obj(data)
             except: pass
             
        if not credential:
             # Last resort: Try converting keys from camelCase to snake_case for direct init
             mapped_data = data.copy()
             if 'rawId' in mapped_data: mapped_data['raw_id'] = mapped_data.pop('rawId')
             if 'clientExtensionResults' in mapped_data: mapped_data['client_extension_results'] = mapped_data.pop('clientExtensionResults')
             if 'authenticatorAttachment' in mapped_data: mapped_data['authenticator_attachment'] = mapped_data.pop('authenticatorAttachment')
             
             # Nested 'response' mapping for Auth
             if 'response' in mapped_data and isinstance(mapped_data['response'], dict):
                 resp = mapped_data['response'].copy()
                 if 'clientDataJSON' in resp: resp['client_data_json'] = resp.pop('clientDataJSON')
                 # Auth specific
                 if 'authenticatorData' in resp: resp['authenticator_data'] = resp.pop('authenticatorData')
                 if 'signature' in resp: resp['signature'] = resp.pop('signature')
                 if 'userHandle' in resp: resp['user_handle'] = resp.pop('userHandle')
                 mapped_data['response'] = resp
             
             try:
                # Filter out optional fields that might not be in __init__
                safe_data = mapped_data.copy()
                safe_data.pop('client_extension_results', None)
                safe_data.pop('authenticator_attachment', None)
                
                # Ensure nested response fields are bytes if strings (Base64URL)
                if 'response' in safe_data and isinstance(safe_data['response'], dict):
                     resp = safe_data['response']
                     def to_bytes(key):
                         if key in resp and isinstance(resp[key], str):
                             resp[key] = base64url_to_bytes(resp[key])
                     to_bytes('authenticator_data')
                     to_bytes('client_data_json')
                     to_bytes('signature')
                     to_bytes('user_handle')
                
                if hasattr(AuthenticationCredential, "model_validate"): 
                    credential = AuthenticationCredential.model_validate(safe_data)
                elif hasattr(AuthenticationCredential, "parse_obj"):
                    credential = AuthenticationCredential.parse_obj(safe_data)
                else:
                    credential = AuthenticationCredential(**safe_data)
             except Exception as e:
                 print(f"DEBUG Auth: Mapped Init Failed: {e}")
                 # Retry with absolute minimal data
                 try:
                     minimal_data = {
                         'id': mapped_data.get('id'),
                         'raw_id': mapped_data.get('raw_id'),
                         'response': safe_data.get('response'),
                         'type': mapped_data.get('type')
                     }
                     credential = AuthenticationCredential(**minimal_data)
                 except: 
                     raise e
        
        cred_id = credential.id
        # ... logic continues ...
        
        # Look up credential in DB
        db = get_db_connection()
        # Handle the fact that credential.id is base64url string, but we might store as BLOB or string
        # passkey.js sends id as base64url string.
        # We store credential_id as BLOB in DB (from registration).
        # We need to match them.
        # credential.raw_id is bytes. Let's use that.
        cred_id_bytes = credential.raw_id
        
        row = db.credentials.find_one({"credential_id": cred_id_bytes})
        
        if not row:
            print("Credential not found in DB")
            return False, "Credential not found in DB"
            
        public_key = row['public_key']
        sign_count = row['sign_count']
        
        auth_verification = verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=public_key,
            credential_current_sign_count=sign_count,
        )
        
        # Update sign count
        db.credentials.update_one(
            {"_id": row['_id']},
            {"$set": {"sign_count": auth_verification.new_sign_count}}
        )
        
        return True, row['user_id']
    except Exception as e:
        print(f"Authentication Verification Failed: {e}")
        return False, str(e)
