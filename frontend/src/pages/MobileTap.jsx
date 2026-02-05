
import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, CheckCircle, XCircle, Search, AlertTriangle, Shield, Check, Lock, Terminal } from 'lucide-react';
import api, { getRawBaseUrl } from '../services/api';
import { generateKeyPair, exportKeyToPEM, exportKeyToJWK, importKeyFromJWK, signData } from '../services/crypto';

const MobileTap = () => {
    // Modes: 'nfc' | 'magnetic'
    const [authMode, setAuthMode] = useState('magnetic');
    const [status, setStatus] = useState('Idle');
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);

    // Identity & Crypto
    const [mobileId, setMobileId] = useState('');
    const [rsaKeyPair, setRsaKeyPair] = useState(null);
    const [publicKeyPEM, setPublicKeyPEM] = useState(null);
    const [cryptoStatus, setCryptoStatus] = useState('Initializing Secure Enclave...');

    // Magnetic Sensor Data
    const [magLevel, setMagLevel] = useState(0);
    const [sensorAvailable, setSensorAvailable] = useState(true);
    const [radarStage, setRadarStage] = useState('scanning'); // scanning | detected | locked

    // User Inputs
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [targetDevice, setTargetDevice] = useState('');

    // Refs
    const readingsRef = useRef([]);
    const sensorValuesRef = useRef({ x: 0, y: 0, z: 0 });
    const MAX_READINGS = 5;
    const isRegisterModeRef = useRef(isRegisterMode);
    const targetDeviceRef = useRef(targetDevice);

    useEffect(() => { isRegisterModeRef.current = isRegisterMode; }, [isRegisterMode]);
    useEffect(() => { targetDeviceRef.current = targetDevice; }, [targetDevice]);

    // 1. INITIALIZE IDENTITY & CRYPTO
    useEffect(() => {
        const initIdentity = async () => {
            // A. Mobile ID
            let storedId = localStorage.getItem('cybot_mobile_id');
            if (!storedId) {
                storedId = 'MOB-' + Math.floor(Math.random() * 10000);
                localStorage.setItem('cybot_mobile_id', storedId);
            }
            setMobileId(storedId);

            // B. RSA Keys
            try {
                const storedKeyJWK = localStorage.getItem('cybot_private_key');
                if (storedKeyJWK) {
                    // Import existing key
                    const privateKey = await importKeyFromJWK(JSON.parse(storedKeyJWK), 'private');
                    // We need the public key too, usually typically we'd recreate it or store it too. 
                    // For simplicity, let's just regenerate keys if public is missing or just store both.
                    // Actually, let's just generate fresh keys if anything is missing to be safe for this demo.
                    // Real app would be more persistent.
                    const storedPublicKeyJWK = localStorage.getItem('cybot_public_key');
                    if (storedPublicKeyJWK) {
                        const publicKey = await importKeyFromJWK(JSON.parse(storedPublicKeyJWK), 'public');
                        setRsaKeyPair({ privateKey, publicKey });
                        const pem = await exportKeyToPEM(publicKey, 'public');
                        setPublicKeyPEM(pem);
                        setCryptoStatus("Enclave Secured: RSA-2048 Ready");
                    } else {
                        throw new Error("Missing public key");
                    }
                } else {
                    throw new Error("Missing private key");
                }
            } catch (e) {
                console.log("Generating new keys...", e);
                setCryptoStatus("Generating RSA-2048 Keypair...");
                const keys = await generateKeyPair();
                setRsaKeyPair(keys);

                // Save to storage
                const privateJWK = await exportKeyToJWK(keys.privateKey);
                const publicJWK = await exportKeyToJWK(keys.publicKey);
                localStorage.setItem('cybot_private_key', JSON.stringify(privateJWK));
                localStorage.setItem('cybot_public_key', JSON.stringify(publicJWK));

                const pem = await exportKeyToPEM(keys.publicKey, 'public');
                setPublicKeyPEM(pem);
                setCryptoStatus("Enclave Secured: Keys Generated");
            }
        };
        initIdentity();
    }, []);


    // 2. SENSOR LOGIC (Magnetometer)
    useEffect(() => {
        let magSensor = null;
        let orientationSensor = null;

        const handleReading = (val) => {
            readingsRef.current.push(val);
            if (readingsRef.current.length > MAX_READINGS) readingsRef.current.shift();
            const avg = readingsRef.current.reduce((a, b) => a + b, 0) / readingsRef.current.length;
            setMagLevel(avg);
        };

        if ('Magnetometer' in window) {
            try {
                magSensor = new Magnetometer({ frequency: 10 });
                magSensor.addEventListener('reading', () => {
                    const total = Math.sqrt(magSensor.x ** 2 + magSensor.y ** 2 + magSensor.z ** 2);
                    sensorValuesRef.current = { x: magSensor.x, y: magSensor.y, z: magSensor.z };
                    handleReading(total);
                });
                magSensor.start();
            } catch (e) {
                console.error("Magnetometer failed", e);
                setSensorAvailable(false);
            }
        } else if ('AbsoluteOrientationSensor' in window) {
            // Fallback for some Androids
            try {
                orientationSensor = new AbsoluteOrientationSensor({ frequency: 10 });
                let lastQuat = null;
                orientationSensor.addEventListener('reading', () => {
                    const q = orientationSensor.quaternion;
                    if (lastQuat) {
                        const delta = Math.abs(q[0] - lastQuat[0]) + Math.abs(q[1] - lastQuat[1]) + Math.abs(q[2] - lastQuat[2]);
                        handleReading(delta * 1000 + 25); // Simulate uT
                    }
                    lastQuat = q;
                });
                orientationSensor.start();
            } catch (e) {
                console.error("Orientation sensor failed", e);
                setSensorAvailable(false);
            }
        } else {
            setSensorAvailable(false);
        }

        return () => {
            if (magSensor) magSensor.stop();
            if (orientationSensor) orientationSensor.stop();
        };
    }, []);

    // 3. AUTH LOGIC (The "Fusion")
    const performSecureAuth = async (triggerType, nfcUid = null) => {
        if (!rsaKeyPair) return;
        setScanning(true);

        const mode = isRegisterModeRef.current ? 'REGISTER' : 'LOGIN';
        const deviceId = targetDeviceRef.current || (new URLSearchParams(window.location.search).get('target') || 'PC-Unknown');

        setStatus(mode === 'REGISTER' ? "Signing Identity..." : "Calculating RSA Signature...");

        try {
            // payload construction
            const timestamp = Date.now();
            const magneticProof = magLevel.toFixed(2);
            const uidToUse = nfcUid || `MagKey-${mobileId}`;

            // PHYSICS SALT EXTRACTION (Micro-Jitter)
            const getJitter = (n) => (n.toFixed(5).split('.')[1] || "000").slice(-3);
            const { x, y, z } = sensorValuesRef.current;
            const physicsSalt = getJitter(x) + getJitter(y) + getJitter(z);

            // The data to sign (Now includes the Physics Salt)
            const dataToSign = `${deviceId}:${uidToUse}:${timestamp}:${magneticProof}:${physicsSalt}`;

            // Sign it!
            const signature = await signData(rsaKeyPair.privateKey, dataToSign);

            if (mode === 'REGISTER') {
                // Register: Send Public Key
                await api.post('/register_device', {
                    device_id: deviceId,
                    uid: uidToUse,
                    public_key: publicKeyPEM,
                    type: triggerType,
                    initial_salt: physicsSalt // Initial Genesis Salt
                });
                setStatus("Device & Public Key Registered!");
            } else {
                // Login: Send Signature
                await api.post('/login_device', {
                    device_id: deviceId,
                    uid: uidToUse,
                    timestamp: timestamp,
                    magnetic_proof: magneticProof,
                    magnetic_salt: physicsSalt, // Live Physics
                    signature: signature
                });
                setStatus("Signature Verified. Access Granted.");
            }

            setRadarStage('locked');
            setTimeout(() => {
                setScanning(false);
                setRadarStage('scanning');
                setStatus('Idle');
            }, 3000);

        } catch (e) {
            console.error(e);
            const baseUrl = getRawBaseUrl();
            if (e.message === "Network Error") {
                setError(
                    <span>
                        Network Error connecting to <b>{baseUrl}</b>.<br />
                        1. Check Laptop firewall.<br />
                        2. <a href={`${baseUrl}/api/status`} target="_blank" className="underline text-red-300 font-bold">Trust Cert Again</a>
                    </span>
                );
            } else {
                setError("Auth Failed: " + (e.response?.data?.message || e.message));
            }
            setScanning(false);
        }
    };

    // NFC Trigger
    const startScan = async () => {
        if (!('NDEFReader' in window)) {
            // Simulation for desktop
            performSecureAuth('NFC_SIM', 'SIMULATED-NFC-' + Math.floor(Math.random() * 1000));
            return;
        }
        try {
            const ndef = new NDEFReader();
            await ndef.scan();
            setScanning(true);
            setStatus("READY TO TAP CARD");

            ndef.onreading = (event) => {
                performSecureAuth('NFC', event.serialNumber);
            };
        } catch (e) {
            setError("NFC Error: " + e.message);
        }
    };

    // Magnetic Trigger
    const [threshold] = useState(210);
    useEffect(() => {
        // Auto-start NFC scan if in NFC mode
        if (authMode === 'nfc' && !scanning) startScan();

        if (magLevel > threshold) {
            if (radarStage !== 'locked') {
                setRadarStage('locked');
                // Only trigger if in Magnetic Mode AND not already busy
                if (authMode === 'magnetic' && !scanning) {
                    performSecureAuth('MAGNETIC');
                }
            }
        } else if (magLevel > (threshold * 0.4)) {
            if (radarStage !== 'locked') setRadarStage('detected');
        } else {
            if (radarStage !== 'locked') {
                setRadarStage(authMode === 'nfc' && scanning ? 'detected' : 'scanning');
            }
        }
    }, [magLevel, authMode, threshold, scanning]);


    // --- VISUALS ---
    const getRadarColor = () => {
        if (radarStage === 'locked') return 'bg-green-500 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.6)]';
        if (authMode === 'nfc') return 'bg-purple-600 border-purple-500 shadow-[0_0_30px_rgba(147,51,234,0.5)]';

        // Mag detected vs scanning
        if (radarStage === 'detected') return 'bg-yellow-500 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)]';
        return 'bg-blue-500 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]';
    };

    const getIcon = () => {
        if (radarStage === 'locked') return <CheckCircle className="w-24 h-24 text-white animate-[bounce_0.5s_ease-in-out_infinite]" />;
        if (authMode === 'nfc') return <Smartphone className="w-20 h-20 text-white animate-pulse" />;
        if (radarStage === 'detected') return <AlertTriangle className="w-20 h-20 text-white animate-ping" />;
        return <Search className="w-16 h-16 text-white/70 animate-pulse" />;
    };

    return (
        <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center overflow-hidden relative font-mono">
            {/* Background Grid */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* Header */}
            <div className="z-10 relative mb-4">
                <h1 className="text-3xl font-bold tracking-tighter flex items-center justify-center gap-2">
                    <Shield className="w-8 h-8 text-green-500" />
                    CYBOT <span className="text-xs align-top border border-green-500/50 px-1 rounded text-green-500">RSA-2048</span>
                </h1>
                <div className="text-[10px] text-gray-500 mt-1">{mobileId}</div>
            </div>

            {/* Crypto Status */}
            <div className="z-10 mb-6 flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-3 py-1 rounded-full border border-green-900/50">
                <Lock className="w-3 h-3" />
                {cryptoStatus}
            </div>

            {/* Toggles */}
            <div className="flex bg-gray-900 rounded-full p-1 mb-8 z-20 border border-gray-700">
                <button onClick={() => setAuthMode('magnetic')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${authMode === 'magnetic' ? 'bg-blue-600 shadow-blue-900/50' : 'text-gray-400'}`}>Magnetic</button>
                <button onClick={() => setAuthMode('nfc')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${authMode === 'nfc' ? 'bg-purple-600 shadow-purple-900/50' : 'text-gray-400'}`}>NFC Card</button>
            </div>

            {/* Register/Login Toggle */}
            <div className="flex bg-gray-800 rounded-full p-1 mb-6 z-10">
                <button onClick={() => setIsRegisterMode(false)} className={`w-32 py-2 rounded-full text-sm font-bold transition-colors ${!isRegisterMode ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>LOGIN</button>
                <button onClick={() => setIsRegisterMode(true)} className={`w-32 py-2 rounded-full text-sm font-bold transition-colors ${isRegisterMode ? 'bg-green-600 text-white' : 'text-gray-400'}`}>REGISTER</button>
            </div>

            {isRegisterMode && (
                <input
                    value={targetDevice}
                    onChange={e => setTargetDevice(e.target.value)}
                    placeholder="Enter Host ID (e.g. PC-1)"
                    className="z-10 mb-8 bg-gray-900 border border-gray-700 text-center text-white p-3 rounded w-64 focus:border-green-500 outline-none"
                />
            )}

            {/* MAIN RADAR */}
            <div className="relative mb-8 z-10 transition-all duration-300">
                <div className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${getRadarColor()} ${radarStage === 'locked' ? 'scale-110' : ''}`}>
                    {getIcon()}
                </div>
            </div>

            {/* Status & Error */}
            <div className="z-10 h-12 flex flex-col items-center justify-center">
                <div className={`text-xl font-bold tracking-widest ${radarStage === 'locked' ? 'text-green-400' : 'text-blue-400'}`}>
                    {radarStage === 'locked' ? status.toUpperCase() : (authMode === 'nfc' && scanning ? "TAP CARD NOW" : "SEARCHING...")}
                </div>
                {error && <div className="text-red-500 text-xs mt-2 max-w-xs">{error}</div>}
            </div>

            {/* Debug Info (Only in Mag Mode) */}
            {authMode === 'magnetic' && (
                <div className="absolute bottom-4 left-0 right-0 text-[10px] text-gray-600 font-mono">
                    SENSOR: {magLevel.toFixed(1)} uT
                </div>
            )}
        </div>
    );
};

export default MobileTap;
