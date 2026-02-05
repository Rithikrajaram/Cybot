
import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, CheckCircle, XCircle, Search, AlertTriangle, Unlock, Lock } from 'lucide-react';
import api from '../services/api';

const MobileTap = () => {
    // Modes: 'nfc' | 'magnetic'
    const [authMode, setAuthMode] = useState('magnetic');

    // Persistent Mobile Identity (The "Key")
    const [mobileId] = useState(() => {
        const stored = localStorage.getItem('cybot_mobile_id');
        if (stored) return stored;
        const newId = 'Mobile-' + Math.floor(Math.random() * 10000);
        localStorage.setItem('cybot_mobile_id', newId);
        return newId;
    });

    const [status, setStatus] = useState('Idle');
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [targetDevice, setTargetDevice] = useState('');

    // Magnetic Radar State
    const [magLevel, setMagLevel] = useState(0);
    const [radarStage, setRadarStage] = useState('scanning'); // scanning | detected | locked
    const [sensorAvailable, setSensorAvailable] = useState(false);

    // Filter noise (simple moving average)
    const readingsRef = useRef([]);
    const MAX_READINGS = 5;

    // Refs to avoid stale closures in async NFC/Sensor callbacks
    const isRegisterModeRef = useRef(isRegisterMode);
    const targetDeviceRef = useRef(targetDevice);

    useEffect(() => { isRegisterModeRef.current = isRegisterMode; }, [isRegisterMode]);
    useEffect(() => { targetDeviceRef.current = targetDevice; }, [targetDevice]);

    useEffect(() => {
        let magSensor = null;
        let orientationSensor = null;

        const initSensors = async () => {
            // Priority 1: Magnetometer (Hall Effect Direct)
            if ('Magnetometer' in window) {
                try {
                    const permission = await navigator.permissions.query({ name: 'magnetometer' });
                    if (permission.state !== 'denied') {
                        magSensor = new window.Magnetometer({ frequency: 10 });
                        magSensor.addEventListener('reading', () => {
                            const { x, y, z } = magSensor;
                            const magnitude = Math.sqrt(x * x + y * y + z * z);
                            updateMagLevel(magnitude);
                        });
                        magSensor.start();
                        setSensorAvailable(true);
                        return; // Found primary, exit
                    }
                } catch (err) {
                    console.log("Magnetometer failed, trying fallback...", err);
                }
            }

            // Priority 2: AbsoluteOrientationSensor (Fuse Fallback)
            if ('AbsoluteOrientationSensor' in window) {
                try {
                    const permission = await navigator.permissions.query({ name: 'accelerometer' }); // usually covered by generic
                    if (permission.state !== 'denied') {
                        orientationSensor = new window.AbsoluteOrientationSensor({ frequency: 10 });
                        let lastQuat = null;

                        orientationSensor.addEventListener('reading', () => {
                            const q = orientationSensor.quaternion;
                            if (lastQuat) {
                                // Calculate simple delta/disturbance
                                const delta = Math.abs(q[0] - lastQuat[0]) + Math.abs(q[1] - lastQuat[1]) + Math.abs(q[2] - lastQuat[2]);
                                // Map small delta to "uT" (Simulation)
                                // A magnet causes HUGE swinging variance.
                                // Reduced sensitivity to prevent false triggering (was 1500)
                                let simulatedUT = delta * 1000;

                                // Floor it to reduce noise
                                if (simulatedUT < 25) simulatedUT = 10;
                                updateMagLevel(simulatedUT);
                            }
                            lastQuat = q;
                        });
                        orientationSensor.start();
                        setSensorAvailable(true);
                        console.log("Using Orientation Sensor Fallback");
                    }
                } catch (err) {
                    console.error("Orientation Sensor failed", err);
                }
            }
        };

        const updateMagLevel = (val) => {
            readingsRef.current.push(val);
            if (readingsRef.current.length > MAX_READINGS) readingsRef.current.shift();
            const avgMag = readingsRef.current.reduce((a, b) => a + b, 0) / readingsRef.current.length;
            setMagLevel(avgMag);
        };

        initSensors();

        return () => {
            if (magSensor) magSensor.stop();
            if (orientationSensor) orientationSensor.stop();
        };
    }, []);

    const playSuccessSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.type = 'sine';
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
            console.error("Audio failed", e);
        }
    };

    // Sensitivity Control
    // Default tuned to User's hardware (210 uT)
    const [threshold, setThreshold] = useState(210);

    // NFC AUTO-START: When switching to NFC mode, start the scanner immediately
    useEffect(() => {
        if (authMode === 'nfc' && !scanning) {
            startScan();
        }
    }, [authMode]);

    // Radar Logic Flow
    useEffect(() => {
        if (magLevel > threshold) {
            if (radarStage !== 'locked') {
                setRadarStage('locked');
                playSuccessSound();

                // ACTION: Trigger based on Mode
                if (authMode === 'magnetic' && !scanning) {
                    handleMagneticAuth();
                } else if (authMode === 'nfc' && !scanning) {
                    // Auto-start scan if magnet brings it to locked, though useEffect above handles mode switch
                    startScan();
                }
            }
        } else if (magLevel > (threshold * 0.4)) { // Detected is 40% of Locked
            if (radarStage !== 'locked') setRadarStage('detected');
        } else {
            if (radarStage !== 'locked') {
                // In NFC mode, we stay in "detected" state visually if scanner is ON
                // to show we are ready even if far from magnet
                setRadarStage(authMode === 'nfc' && scanning ? 'detected' : 'scanning');
            }
        }
    }, [magLevel, authMode, threshold, scanning]);

    const handleMagneticAuth = async () => {
        setScanning(true);
        setStatus("Authenticating via Sensor...");
        try {
            // We treat "Magnetic Presence" as a valid credential for the TARGET DEVICE
            const deviceID = targetDeviceRef.current || (new URLSearchParams(window.location.search).get('target') || 'PC-Unknown');

            // Reuse the /register/nfc endpoint but with a special UID
            // UID is now tied to the MOBILE DEVICE, not the PC
            await api.post('/register/nfc', {
                device_id: deviceID,
                nfc_uid: `MagKey-${mobileId}`,
                force_login: !isRegisterModeRef.current
            });
            const msg = isRegisterModeRef.current ? 'Sensor Registered!' : 'Login Successful!';
            setStatus(msg);
            setRadarStage('locked'); // Force locked for success UI

            setTimeout(() => {
                setScanning(false);
                setRadarStage('scanning');
                setStatus('Idle');
            }, 3000);
        } catch (e) {
            setError("Magnetic Auth Failed: " + e.message);
            setScanning(false);
        }
    };

    const startScan = async () => {
        if (!('NDEFReader' in window)) {
            // If checking on desktop without NFC, just simulate for UI demo if Locked
            if (radarStage === 'locked') {
                setStatus("Simulated NFC Scan (Desktop Mode)");
                // Simulate API call
                try {
                    await api.post('/register/nfc', {
                        device_id: targetDeviceRef.current || 'PC-Unknown',
                        nfc_uid: 'SIMULATED-UID-' + Math.floor(Math.random() * 1000),
                        force_login: !isRegisterModeRef.current
                    });
                    setStatus(isRegisterModeRef.current ? 'Card Registered!' : 'Login Success!');
                } catch (e) {
                    // ignore network err for demo
                }
                return;
            }
            setError('NFC not supported. Use Chrome on Android with HTTPS.');
            return;
        }

        if (isRegisterMode && !targetDevice) {
            setError('Please enter a Device ID to register this card.');
            return;
        }

        try {
            const ndef = new parse_NDEFReader();
            await ndef.scan();
            setScanning(true);
            setStatus(isRegisterMode ? 'Ready to Register Tap...' : 'Ready to Login Tap...');
            setError('');

            ndef.onreading = async (event) => {
                const uid = event.serialNumber;
                if (!uid) {
                    setError("Failed: Could not read Card UID. Your device might not have permission or the card is incompatible.");
                    return;
                }

                setStatus(`Card Found: ${uid}`);

                try {
                    const currentIsRegister = isRegisterModeRef.current;
                    const currentTarget = targetDeviceRef.current;

                    // Final fallback for device_id
                    const deviceID = currentIsRegister ? currentTarget : (new URLSearchParams(window.location.search).get('target') || currentTarget || 'PC-Unknown');

                    if (currentIsRegister && !deviceID) {
                        setError("Failed: Device ID is required for registration.");
                        return;
                    }

                    await api.post('/register/nfc', {
                        device_id: deviceID,
                        nfc_uid: uid,
                        force_login: !currentIsRegister
                    });

                    const msg = currentIsRegister ? 'Card Linked!' : 'NFC Login Success!';
                    setStatus(msg);
                    setRadarStage('locked');

                    setTimeout(() => {
                        setScanning(false);
                        setRadarStage('scanning');
                        setStatus('Idle');
                    }, 3000);
                } catch (e) {
                    setError(`Failed: ${e.response?.data?.message || e.message}`);
                    setScanning(false);
                }
            };
        } catch (error) {
            setError(`Scan Error: ${error}`);
            setScanning(false);
        }
    };

    const parse_NDEFReader = window.NDEFReader || class { scan() { throw "Not Supported"; } };

    // --- VISUAL COMPUTATIONS ---
    const getRadarColor = () => {
        if (authMode === 'nfc') {
            if (radarStage === 'locked') return 'bg-green-500 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.6)]';
            return 'bg-purple-600 border-purple-500 shadow-[0_0_30px_rgba(147,51,234,0.5)]';
        }

        switch (radarStage) {
            case 'locked': return 'bg-green-500 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.6)]';
            case 'detected': return 'bg-yellow-500 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)]';
            default: return 'bg-blue-500 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]';
        }
    };

    const getIcon = () => {
        if (radarStage === 'locked') return <CheckCircle className="w-24 h-24 text-white animate-[bounce_0.5s_ease-in-out_infinite]" />;

        if (authMode === 'nfc' && radarStage !== 'locked') {
            return <Smartphone className="w-20 h-20 text-white animate-pulse" />;
        }
        switch (radarStage) {
            case 'detected': return <AlertTriangle className="w-20 h-20 text-white animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_infinite]" />;
            default: return <Search className="w-16 h-16 text-white/70 animate-pulse" />;
        }
    };

    const getText = () => {
        if (radarStage === 'locked') return status.toUpperCase();
        if (authMode === 'nfc') return scanning ? "TAP CARD NOW" : "READY TO TAP";

        switch (radarStage) {
            case 'detected': return "TERMINAL DETECTED...";
            default: return "SCANNING AREA...";
        }
    };

    const getProgress = () => {
        switch (radarStage) {
            case 'locked': return 100;
            case 'detected': return 60 + (Math.random() * 10); // Jitter
            default: return 10;
        }
    };

    return (
        <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">

            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <h1 className="text-3xl font-bold mb-4 z-10 relative">Cybot Security</h1>
            <div className="z-10 relative mb-6 text-xs text-gray-500 font-mono">
                Mobile Key: <span className="text-blue-400">{mobileId}</span>
            </div>

            {/* MODE TOGGLE */}
            <div className="flex bg-gray-900 rounded-full p-1 mb-6 z-20 border border-gray-700">
                <button
                    onClick={() => setAuthMode('magnetic')}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${authMode === 'magnetic' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:text-white'}`}
                >
                    Magnetic Sensor
                </button>
                <button
                    onClick={() => setAuthMode('nfc')}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${authMode === 'nfc' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:text-white'}`}
                >
                    NFC Card
                </button>
            </div>
            {/* Stage Indicator (Debug/Dev) - ONLY IN MAGNETIC MODE */}
            {authMode === 'magnetic' && (
                <div className="absolute top-4 right-4 text-xs font-mono text-gray-500 text-right z-20">
                    <div>uT (Raw): {magLevel.toFixed(1)}</div>
                    <div>Stage: {radarStage}</div>
                    {!sensorAvailable && <div className="text-red-500">Using Gyro Fallback</div>}
                </div>
            )}

            <div className="flex bg-gray-800 rounded-full p-1 mb-8 gap-2 z-10 relative">
                <button onClick={() => setIsRegisterMode(false)} className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${!isRegisterMode ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Login</button>
                <button onClick={() => setIsRegisterMode(true)} className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${isRegisterMode ? 'bg-green-600 text-white' : 'text-gray-400'}`}>Register</button>
            </div>

            {isRegisterMode && (
                <div className="w-full max-w-xs mb-8 z-10">
                    <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Link to Device ID</label>
                    <input
                        type="text"
                        value={targetDevice}
                        onChange={(e) => setTargetDevice(e.target.value)}
                        placeholder="Enter Device ID from PC"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-center font-mono focus:border-green-500 outline-none"
                    />
                </div>
            )}

            {/* Sensitivity Calibrated (210uT) */}

            {/* MAIN RADAR UI */}
            <div className="relative mb-12 z-10">
                {/* Ripples */}
                {radarStage === 'scanning' && (
                    <>
                        <div className={`absolute inset-0 rounded-full border ${authMode === 'nfc' ? 'border-purple-500/30' : 'border-blue-500/30'} animate-[ping_3s_linear_infinite]`}></div>
                        <div className={`absolute inset-0 rounded-full border ${authMode === 'nfc' ? 'border-purple-500/20' : 'border-blue-500/20'} animate-[ping_3s_linear_infinite_1s]`}></div>
                    </>
                )}

                {/* Jitter Effect Wrapper */}
                <div className={`transition-all duration-300 ${radarStage === 'detected' ? 'animate-[spin_0.1s_linear_infinite] translate-x-1' : ''} ${radarStage === 'locked' ? 'scale-125' : ''}`}>
                    <div className={`w-48 h-48 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${getRadarColor()}`}>
                        {getIcon()}
                    </div>
                </div>
            </div>

            <div className={`text-2xl font-mono font-bold mb-8 tracking-widest transition-colors duration-300 ${radarStage === 'locked' ? 'text-green-400' : (radarStage === 'detected' ? 'text-yellow-400' : 'text-blue-400 animate-pulse')}`}>
                {getText()}
            </div>

            {/* Progress Bar */}
            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-8 border border-white/10 z-10">
                <div
                    className={`h-full transition-all duration-300 ${radarStage === 'locked' ? 'bg-green-500' : (radarStage === 'detected' ? 'bg-yellow-500' : 'bg-blue-500')}`}
                    style={{ width: `${getProgress()}%` }}
                ></div>
            </div>

            {/* Manual Override / Status */}
            <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto z-10">{status}</p>

            {error && <div className="bg-red-900/50 p-4 rounded-lg mb-8 text-red-200 border border-red-500 text-sm max-w-xs break-words z-10">{error}</div>}

            {/* Manual Controls Removed for "Magic" Experience */}
        </div>
    );
};

export default MobileTap;
