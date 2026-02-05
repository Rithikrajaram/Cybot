
// Cybot Cryptographic Enclave
// Handles RSA-2048 Key Generation, Signing, and Exporting

const ALGORITHM = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
};

// 1. Generate a new Key Pair (Public + Private)
export const generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true, // extractable
        ["sign", "verify"]
    );
    return keyPair;
};

// 2. Export Key to PEM format (for sending to server/storage)
export const exportKeyToPEM = async (key, type = 'public') => {
    const format = type === 'public' ? 'spki' : 'pkcs8';
    const exported = await window.crypto.subtle.exportKey(format, key);
    const exportedAsString = String.fromCharCode(...new Uint8Array(exported));
    const exportedAsBase64 = window.btoa(exportedAsString);
    const header = type === 'public' ? 'PUBLIC KEY' : 'PRIVATE KEY';

    return `-----BEGIN ${header}-----\n${exportedAsBase64}\n-----END ${header}-----`;
};

// 3. Import Key from PEM (if we stored it) - Simplified: We might just store JWK in localStorage for ease
export const exportKeyToJWK = async (key) => {
    return await window.crypto.subtle.exportKey("jwk", key);
};

export const importKeyFromJWK = async (jwk, type = 'public') => {
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256",
        },
        true,
        type === 'public' ? ["verify"] : ["sign"]
    );
};

// 4. Sign Data (The "Digital Signature")
export const signData = async (privateKey, dataString) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const signature = await window.crypto.subtle.sign(
        ALGORITHM,
        privateKey,
        data
    );
    // Convert signature to Base64 to send over network
    return window.btoa(String.fromCharCode(...new Uint8Array(signature)));
};
