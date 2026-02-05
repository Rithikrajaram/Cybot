import face_recognition
import numpy as np
import cv2
import base64
from secure_db import get_db_connection
from logger import log_event
from datetime import datetime

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def decode_image(image_data_base64):
    """
    Decodes a base64 image string into a numpy array (OpenCV format).
    """
    if "," in image_data_base64:
        image_data_base64 = image_data_base64.split(",")[1]
    
    image_bytes = base64.b64decode(image_data_base64)
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return image

def get_face_embedding(image):
    """
    Detects faces and returns 128D embedding for the first face found.
    """
    # Convert BGR (OpenCV) to RGB (face_recognition)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Detect face locations
    face_locations = face_recognition.face_locations(rgb_image, model="hog")
    
    if not face_locations:
        return None
    
    # Compute encoding
    face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
    
    if not face_encodings:
        return None
        
    return face_encodings[0]

def register_face(username, image_data_list):
    """
    Registers a user's face.
    Takes multiple images to ensure consistency.
    """
    db = get_db_connection()
    
    # Check if user exists (should have been registered via Basic Auth first ideally, or created here)
    user = db.users.find_one({"device_id": username})
    if not user:
        # Auto-create user if not exists (for this demo flow)
        db.users.insert_one({
            "device_id": username,
            "registered_at": datetime.utcnow()
        })
    
    embeddings = []
    
    for img_b64 in image_data_list:
        img = decode_image(img_b64)
        if img is None:
            continue
            
        emb = get_face_embedding(img)
        if emb is not None:
            embeddings.append(emb)
    
    if len(embeddings) == 0:
        return False, "No face detected in any image."
        
    # Average the embeddings for a robust reference
    avg_embedding = np.mean(embeddings, axis=0)
    
    # Check if this face is already registered by ANOTHER user (Unique Face Constraint)
    all_users = db.users.find({"face_embedding": {"$exists": True}})
    for u in all_users:
        if u['device_id'] == username: 
            continue # Skip self re-registration
            
        stored_emb = np.array(u['face_embedding'])
        dist = np.linalg.norm(stored_emb - avg_embedding)
        if dist < 0.5: # Euclidean Distance Threshold
            return False, f"This face is already registered to user '{u['device_id']}'."

    # Store
    db.users.update_one(
        {"device_id": username},
        {"$set": {"face_embedding": avg_embedding.tolist()}},
        upsert=True
    )
    
    log_event(f"Face Registered: {username}")
    return True, "Face registered successfully."

def verify_face_liveness(image_data_list, challenge_type="blink"):
    """
    Analyze a sequence of frames to detect liveness (e.g. Blinking).
    """
    ear_history = []
    
    for img_b64 in image_data_list:
        img = decode_image(img_b64)
        if img is None: continue
        rgb_image = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        landmarks_list = face_recognition.face_landmarks(rgb_image)
        
        if not landmarks_list:
            continue
            
        landmarks = landmarks_list[0]
        left_eye = landmarks['left_eye']
        right_eye = landmarks['right_eye']
        
        def eye_aspect_ratio(eye):
            A = np.linalg.norm(np.array(eye[1]) - np.array(eye[5]))
            B = np.linalg.norm(np.array(eye[2]) - np.array(eye[4]))
            C = np.linalg.norm(np.array(eye[0]) - np.array(eye[3]))
            ear = (A + B) / (2.0 * C)
            return ear
            
        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)
        ear_history.append((left_ear + right_ear) / 2.0)
    
    has_blink = False
    closed_frames = 0
    BLINK_THRESH = 0.21
    
    for ear in ear_history:
        if ear < BLINK_THRESH:
            closed_frames += 1
        else:
            if closed_frames >= 1:
                has_blink = True
            closed_frames = 0
            
    if challenge_type == "blink":
        return has_blink
    
    return True

def verify_face_login(username, image_data):
    """
    Verifies a user's face against stored embedding.
    """
    db = get_db_connection()
    user = db.users.find_one({"device_id": username})
    
    if not user or "face_embedding" not in user:
        return False, "User not found or no face registered."
        
    stored_embedding = np.array(user['face_embedding'])
    
    img = decode_image(image_data)
    login_embedding = get_face_embedding(img)
    
    if login_embedding is None:
        return False, "No face detected."
        
    distance = np.linalg.norm(stored_embedding - login_embedding)
    
    if distance < 0.50:
        log_event(f"Face Login Success: {username} (Dist: {distance:.2f})")
        return True, "Login Successful"
    else:
        log_event(f"Face Login Failed: {username} (Dist: {distance:.2f})")
        return False, "Face not recognized."
