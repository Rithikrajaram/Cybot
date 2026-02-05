import api from './api';

// WebAuthn helpers
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = "";
    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }
    const base64 = btoa(str);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(base64url) {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

export const registerPasskey = async (username) => {
    if (!username) {
        throw new Error("Please enter a device name/username first.");
    }

    try {
        // 1. Get options from server
        const resp = await api.post("/register/passkey/options", { username });
        const opts = resp.data;

        // 2. Decode options
        opts.challenge = base64urlToBuffer(opts.challenge);
        opts.user.id = base64urlToBuffer(opts.user.id);
        if (opts.excludeCredentials) {
            opts.excludeCredentials = opts.excludeCredentials.map((c) => ({
                ...c,
                id: base64urlToBuffer(c.id),
            }));
        }

        // 3. Create credential
        const cred = await navigator.credentials.create({ publicKey: opts });

        // 4. Encode response
        const credData = {
            id: cred.id,
            rawId: bufferToBase64url(cred.rawId),
            type: cred.type,
            authenticatorAttachment: cred.authenticatorAttachment,
            clientExtensionResults: cred.getClientExtensionResults(),
            response: {
                clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
                attestationObject: bufferToBase64url(cred.response.attestationObject),
                transports: cred.response.getTransports ? cred.response.getTransports() : [],
            },
        };

        // 5. Verify on server
        const verifyResp = await api.post("/register/passkey/verify", {
            passkey_data: credData,
            username: username
        });

        return verifyResp.data;
    } catch (e) {
        console.error(e);
        throw e;
    }
};

export const loginPasskey = async (username = "") => {
    try {
        // 1. Get options
        const resp = await api.post("/login/passkey/options", { username });
        const opts = resp.data;

        // 2. Decode options
        opts.challenge = base64urlToBuffer(opts.challenge);
        if (opts.allowCredentials) {
            opts.allowCredentials = opts.allowCredentials.map((c) => ({
                ...c,
                id: base64urlToBuffer(c.id),
            }));
        }

        // 3. Get credential
        const cred = await navigator.credentials.get({ publicKey: opts });

        // 4. Encode response
        const credData = {
            id: cred.id,
            rawId: bufferToBase64url(cred.rawId),
            type: cred.type,
            authenticatorAttachment: cred.authenticatorAttachment,
            clientExtensionResults: cred.getClientExtensionResults(),
            response: {
                clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
                authenticatorData: bufferToBase64url(cred.response.authenticatorData),
                signature: bufferToBase64url(cred.response.signature),
                userHandle: cred.response.userHandle ? bufferToBase64url(cred.response.userHandle) : null,
            },
        };

        // 5. Verify
        const verifyResp = await api.post("/login/passkey/verify", {
            passkey_data: credData,
            username: username
        });

        return verifyResp.data;
    } catch (e) {
        console.error(e);
        throw e;
    }
};
