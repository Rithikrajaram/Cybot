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
    AuthenticatorAttestationResponse,
    AuthenticatorAssertionResponse,
)
from secure_db import get_db_connection

class SimpleCredential:
    """Mock class to bypass Pydantic validation issues in webauthn library"""
    def __init__(self, id, raw_id, response, type, authenticator_attachment=None):
        self.id = id
        self.raw_id = raw_id
        self.response = response
        self.type = type
        self.authenticator_attachment = authenticator_attachment
        self.public_key_algorithm = -7  # Default ES256


RP_ID = "localhost"  # Change this to your domain in production
RP_NAME = "Secure Offline Auth"
# ORIGIN must match the frontend URL exactly (including protocol and port)
ORIGIN = "https://localhost:5173"  

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
    # Normalize transports to None if empty list
    transports_str = ",".join(transports) if transports else None
    
    try:
        db.credentials.insert_one({
            "user_id": user_id,
            "credential_id": credential_id, # Pymongo handles bytes as Binary
            "public_key": public_key,       # Pymongo handles bytes as Binary
            "sign_count": sign_count,
            "transports": transports_str
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
    cursor = db.credentials.find({"user_id": user_id})
    rows = list(cursor)
    return rows

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
             
             # Ensure raw_id is bytes
             if 'raw_id' in mapped_data and isinstance(mapped_data['raw_id'], str):
                 try:
                     mapped_data['raw_id'] = base64url_to_bytes(mapped_data['raw_id'])
                 except: pass

             # Nested 'response' mapping
             if 'response' in mapped_data and isinstance(mapped_data['response'], dict):
                 resp = mapped_data['response'].copy()
                 if 'clientDataJSON' in resp: resp['client_data_json'] = resp.pop('clientDataJSON')
                 if 'attestationObject' in resp: resp['attestation_object'] = resp.pop('attestationObject')
                 if 'authenticatorData' in resp: resp['authenticator_data'] = resp.pop('authenticatorData')
                 if 'userHandle' in resp: resp['user_handle'] = resp.pop('userHandle')
                 mapped_data['response'] = resp

             try:
                # Filter out optional fields
                safe_data = mapped_data.copy()
                safe_data.pop('client_extension_results', None)
                safe_data.pop('authenticator_attachment', None)
                
                # Convert nested bytes and FORCE Object Instantiation
                if 'response' in safe_data and isinstance(safe_data['response'], dict):
                     resp = safe_data['response']
                     
                     # 1. Byte Conversion
                     cdj = resp.get('client_data_json')
                     ao = resp.get('attestation_object')
                     
                     if isinstance(cdj, str): cdj = base64url_to_bytes(cdj)
                     if isinstance(ao, str): ao = base64url_to_bytes(ao)
                     
                     # 2. Instantiate Object (Critical for library compatibility)
                     response_obj = AuthenticatorAttestationResponse(
                         client_data_json=cdj,
                         attestation_object=ao,
                     )
                     
                     safe_data['response'] = response_obj

                # Retry validation/init with safe_data containing the OBJECT
                if hasattr(RegistrationCredential, "model_validate"): 
                    credential = RegistrationCredential.model_validate(safe_data)
                elif hasattr(RegistrationCredential, "parse_obj"):
                    credential = RegistrationCredential.parse_obj(safe_data)
                else:
                    credential = RegistrationCredential(**safe_data)
             except Exception as e:
                print(f"DEBUG: Main Init Failed: {e}")
                # If that fails, final Hail Mary: Manual Instantiation
                try:
                    # Re-attempt creation if safe_data failed
                    resp_val = safe_data.get('response') # Might be dict or object
                    if isinstance(resp_val, dict):
                         # Force convert again for fallback
                         cdj = resp_val.get('client_data_json')
                         ao = resp_val.get('attestation_object')
                         if isinstance(cdj, str): cdj = base64url_to_bytes(cdj)
                         if isinstance(ao, str): ao = base64url_to_bytes(ao)
                         # Explicitly create object
                         resp_val = AuthenticatorAttestationResponse(
                             client_data_json=cdj,
                             attestation_object=ao
                         )

                    minimal_data = {
                         'id': mapped_data.get('id'),
                         'raw_id': mapped_data.get('raw_id'),
                         'response': resp_val, # Use proper object
                         'type': mapped_data.get('type')
                    }
                    credential = SimpleCredential(**minimal_data)
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
    options = generate_authentication_options(
        rp_id=RP_ID,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    return options


def verify_auth_response(response_data, challenge, user_id):
    """
    Verify the login response.
    """
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
             
             # Ensure raw_id is bytes (Crucial for DB lookup)
             if 'raw_id' in mapped_data and isinstance(mapped_data['raw_id'], str):
                 try:
                     mapped_data['raw_id'] = base64url_to_bytes(mapped_data['raw_id'])
                 except: pass

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
                
                # Convert nested bytes and FORCE Object Instantiation (Auth)
                if 'response' in safe_data and isinstance(safe_data['response'], dict):
                     resp = safe_data['response']
                     
                     cdj = resp.get('client_data_json')
                     ad = resp.get('authenticator_data')
                     sig = resp.get('signature')
                     uh = resp.get('user_handle')
                     
                     if isinstance(cdj, str): cdj = base64url_to_bytes(cdj)
                     if isinstance(ad, str): ad = base64url_to_bytes(ad)
                     if isinstance(sig, str): sig = base64url_to_bytes(sig)
                     if isinstance(uh, str): uh = base64url_to_bytes(uh)
                     
                     response_obj = AuthenticatorAssertionResponse(
                         client_data_json=cdj,
                         authenticator_data=ad,
                         signature=sig,
                         user_handle=uh
                     )
                     safe_data['response'] = response_obj
                
                if hasattr(AuthenticationCredential, "model_validate"): 
                    credential = AuthenticationCredential.model_validate(safe_data)
                elif hasattr(AuthenticationCredential, "parse_obj"):
                    credential = AuthenticationCredential.parse_obj(safe_data)
                else:
                    credential = AuthenticationCredential(**safe_data)
             except Exception as e:
                 print(f"DEBUG Auth: Main Init Failed: {e}")
                 # Final Hail Mary: Manual Instantiation with SimpleCredential
                 try:
                     resp_val = safe_data.get('response')
                     if isinstance(resp_val, dict):
                         # Instantiate nested response object if it's still a dict
                         cdj = resp_val.get('client_data_json')
                         ad = resp_val.get('authenticator_data')
                         sig = resp_val.get('signature')
                         uh = resp_val.get('user_handle')
                         
                         if isinstance(cdj, str): cdj = base64url_to_bytes(cdj)
                         if isinstance(ad, str): ad = base64url_to_bytes(ad)
                         if isinstance(sig, str): sig = base64url_to_bytes(sig)
                         if isinstance(uh, str): uh = base64url_to_bytes(uh)
                         
                         resp_val = AuthenticatorAssertionResponse(
                             client_data_json=cdj,
                             authenticator_data=ad,
                             signature=sig,
                             user_handle=uh
                         )

                     minimal_data = {
                         'id': mapped_data.get('id'),
                         'raw_id': mapped_data.get('raw_id'),
                         'response': resp_val,
                         'type': mapped_data.get('type')
                     }
                     credential = SimpleCredential(**minimal_data)
                 except: 
                     raise e
        
        cred_id_bytes = credential.raw_id
        
        # Look up credential in DB
        db = get_db_connection()
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
