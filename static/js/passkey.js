
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

// REGISTER PASSKEY
async function registerPasskey() {
    const username = document.getElementById("device_name").value;
    if (!username) {
        alert("Please enter a device name/username first.");
        return;
    }

    try {
        // 1. Get options from server
        const resp = await fetch("/register/passkey/options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username }),
        });
        const opts = await resp.json();

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
        const verifyResp = await fetch("/register/passkey/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passkey_data: credData, username: username }),
        });

        const verifyResult = await verifyResp.json();
        if (verifyResult.success) {
            window.location.href = verifyResult.redirect_url;
        } else {
            alert("Registration failed: " + verifyResult.message);
        }
    } catch (e) {
        console.error(e);
        alert("Passkey registration failed. See console.");
    }
}

// LOGIN PASSKEY
async function loginPasskey() {
    // We can try a "usernameless" flow or ask for username. 
    // To match current TOTP flow, let's ask for the Device ID (username) OR try discoverable.
    // Let's try sending an empty username to see if server supports discoverable, 
    // OR we just prompt user for device_id in the UI. 
    // For "Sign in with Passkey", it's best if we don't *have* to type. 
    // But our backend 'generate_auth_options' assumes we know the user or search all.

    // Let's try sending just the challenge and let the user pick a credential.

    const deviceIdInput = document.getElementById("device_id");
    const username = deviceIdInput ? deviceIdInput.value : "";

    try {
        // 1. Get options
        const resp = await fetch("/login/passkey/options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username }),
        });
        const opts = await resp.json();

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
        const verifyResp = await fetch("/login/passkey/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passkey_data: credData, username: username }),
        });

        const verifyResult = await verifyResp.json();
        if (verifyResult.success) {
            window.location.href = verifyResult.redirect_url;
        } else {
            alert("Login failed: " + verifyResult.message);
        }
    } catch (e) {
        console.error(e);
        alert("Passkey login failed/cancelled.");
    }
}
