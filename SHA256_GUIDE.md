# Understanding SHA-256 & Immutable Logs 🛡️

## What is SHA-256?
**SHA-256** (Secure Hash Algorithm 256-bit) is a cryptographic function that takes any input (text, file, image) and converts it into a unique, fixed-size string of characters, called a **hash**.

Think of it like a **digital fingerprint**.

### Key Characteristics:
1.  **Deterministic**: The same input *always* produces the same hash.
2.  **One-Way**: You cannot convert the hash back into the original message (it's not encryption).
3.  **Avalanche Effect**: Changing even a *single letter* in the input results in a completely different hash.

---

## Example: The Avalanche Effect ❄️

Let's see how a tiny change alters the entire fingerprint.

### Input 1: "Cybot"
**Hash**:
`e9b4c0f8... (long string) ...`

### Input 2: "cybot" (Lowercase 'c')
**Hash**:
`a1b2c3d4... (completely different string) ...`

Even though the inputs are almost identical, the outputs share no similarity. This makes it impossible to guess the original input or "tweak" a file to match a specific hash.

---

## How We Use It: The Immutable Audit Log 🔗

In Cybot, we use SHA-256 to create a "Blockchain-like" chain of custody for logs. This ensures that **nobody** (not even an admin) can delete or modify a log entry without breaking the chain.

### The Mechanism: Chaining

Each new log entry's hash is calculated using:
1.  The **Current Data** (e.g., "User Login Success")
2.  The **Previous Log's Hash**

```python
Current_Hash = SHA256( Current_Message + Previous_Hash )
```

### Visualizing the Chain

| ID | Message | Previous Hash | Current Hash |
| :--- | :--- | :--- | :--- |
| **001** | `System Init` | `000000...` (Genesis) | **`9F8A...`** |
| **002** | `User Login` | **`9F8A...`** | **`B7C2...`** |
| **003** | `File Open` | **`B7C2...`** | **`3D4E...`** |

### What Happens if a Hacker Changes Log 002?

If a hacker changes `User Login` to `User Unknown` in Log 002:
1.  They must recalculate the hash for **002**.
2.  But Log **003** *checked* the old hash of 002!
3.  So Log **003** becomes invalid.
4.  Consequently, **004**, **005**, and all future logs become invalid.

The entire chain "breaks" from the point of tampering onwards. This is how we mathematically prove integrity.

---

## Try It Yourself (Python Example)

You can run this simple script to see SHA-256 in action:

```python
import hashlib

def get_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()

# 1. Original
text1 = "Secret Access Codes"
hash1 = get_hash(text1)
print(f"Original: {hash1}")

# 2. Tampered (Change one letter)
text2 = "Secret Access Coded" 
hash2 = get_hash(text2)
print(f"Tampered: {hash2}")

# Result: The hashes will look nothing alike!
```
