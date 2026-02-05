import React, { useState, useEffect } from 'react';
import { Shield, Key, Smartphone, Loader2, ArrowLeft, Camera, Zap } from 'lucide-react';
import api from '../services/api';
import { loginPasskey } from '../services/passkey';
import { loginFace } from '../services/api';
import FaceCapture from '../components/FaceCapture';

const Login = ({ onLoginSuccess }) => {
    const [deviceId, setDeviceId] = useState(() => {
        const stored = localStorage.getItem('cybot_device_id');
        if (stored) return stored;
        const newId = 'PC-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        localStorage.setItem('cybot_device_id', newId);
        return newId;
    });

    const handleDeviceChange = (e) => {
        setDeviceId(e.target.value);
        localStorage.setItem('cybot_device_id', e.target.value);
    };

    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showFaceAuth, setShowFaceAuth] = useState(false);

    const [authStatus, setAuthStatus] = useState('IDLE'); // IDLE, ANALYZING, SUCCESS, ERROR
    const [statusMessage, setStatusMessage] = useState('');
    const [waitingForMobile, setWaitingForMobile] = useState(false);

    const handleTotpLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/login', { device_id: deviceId, token });
            if (response.data.success) {
                onLoginSuccess(response.data.user);
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await loginPasskey(deviceId);
            if (result.success) {
                onLoginSuccess(result.user);
            }
        } catch (err) {
            setError('Passkey login failed or cancelled');
        } finally {
            setLoading(false);
        }
    };

    const handleFaceLogin = async (livenessData) => {
        setAuthStatus('ANALYZING');
        setStatusMessage('Verifying biometric data...');

        try {
            const response = await loginFace(deviceId, livenessData);
            if (response.data.success) {
                setAuthStatus('SUCCESS');
                setStatusMessage('Identity Verified');
                setTimeout(() => {
                    onLoginSuccess(response.data.user || deviceId);
                }, 1500);
            } else {
                setAuthStatus('ERROR');
                setStatusMessage(response.data.message || 'Face not recognized.');
            }
        } catch (err) {
            console.error("Face Login Error:", err);
            setAuthStatus('ERROR');
            setStatusMessage(err.response?.data?.message || err.message || 'Face login failed');
        }
    };

    const resetFaceAuth = () => {
        setAuthStatus('IDLE');
        setStatusMessage('');
    };

    const toggleMobileWait = () => {
        if (!deviceId) {
            setError('Please enter your Device ID first');
            return;
        }
        setWaitingForMobile(!waitingForMobile);
    };

    useEffect(() => {
        let timer;
        if (waitingForMobile) {
            const checkMobileLogin = async () => {
                try {
                    const response = await api.post('/auth/bluetooth-poll', { device_id: deviceId });
                    if (response.data.success) {
                        setWaitingForMobile(false);
                        onLoginSuccess(response.data.user);
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            };
            timer = setInterval(checkMobileLogin, 2000);
        }
        return () => clearInterval(timer);
    }, [waitingForMobile, deviceId, onLoginSuccess]);

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 lg:px-12">
            <div className="max-w-7xl w-full grid lg:grid-cols-12 gap-16 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Left Side: Brand & Welcome */}
                <div className="lg:col-span-7 space-y-8">
                    <a href="/" className="inline-flex items-center gap-2 text-text-dim hover:text-white mb-2 transition-colors group text-sm font-mono uppercase tracking-widest">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Return to Gate
                    </a>

                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-3 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full w-fit">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            <span className="text-xs font-mono font-medium text-primary tracking-widest uppercase">System Online</span>
                        </div>

                        <h1 className="text-6xl lg:text-8xl font-black text-white leading-none tracking-tight">
                            SECURE <br />
                            <span className="text-text-dim">ACCESS</span>
                        </h1>

                        <p className="text-xl text-text-dim max-w-lg leading-relaxed font-light border-l-2 border-primary/30 pl-6">
                            Authorized personnel only. All access attempts are geolocated and cryptographically signed.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-white/10 rounded-lg overflow-hidden border border-white/10 max-w-md">
                        <div className="p-6 bg-surface hover:bg-white/5 transition-colors group">
                            <Shield className="w-8 h-8 text-text-dim group-hover:text-primary mb-3 transition-colors" />
                            <div className="text-sm font-bold text-white mb-1">Zero Trust</div>
                            <div className="text-xs text-text-dim">Continuous validation protocol active.</div>
                        </div>
                        <div className="p-6 bg-surface hover:bg-white/5 transition-colors group">
                            <Loader2 className="w-8 h-8 text-text-dim group-hover:text-primary mb-3 transition-colors" />
                            <div className="text-sm font-bold text-white mb-1">Real-time Sync</div>
                            <div className="text-xs text-text-dim">Sub-millisecond latency.</div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="lg:col-span-5 relative">
                    <div className="absolute -top-10 -right-10 w-20 h-20 border-t-2 border-r-2 border-primary/20 rounded-tr-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-20 h-20 border-b-2 border-l-2 border-primary/20 rounded-bl-3xl"></div>

                    <div className="bg-surface border border-white/10 pt-6 pb-6 px-8 lg:px-12 rounded-2xl shadow-2xl relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Login</h2>
                            <div className="p-2 bg-white/5 rounded-lg">
                                <Key className="w-5 h-5 text-primary" />
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-1 bg-red-500/20 rounded-full mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-red-400">Authentication Failed</h4>
                                    <p className="text-xs text-red-300/80 mt-1 leading-relaxed">{error}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleTotpLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Device Identity</label>
                                <div className="relative group">
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-white transition-colors" />
                                    <input
                                        type="text"
                                        value={deviceId}
                                        onChange={handleDeviceChange}
                                        className="w-full bg-background border border-border rounded-lg py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm placeholder:text-gray-500"
                                        placeholder="ENTER-DEVICE-ID"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Authentication Token</label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-white transition-colors" />
                                    <input
                                        type="text"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg py-3 pl-12 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono tracking-[0.5em] text-center text-lg placeholder:text-gray-500"
                                        placeholder="......"
                                        maxLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Authenticate'}
                            </button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-surface px-4 text-text-dim font-medium tracking-widest">Or continue with</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handlePasskeyLogin}
                                disabled={loading}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex flex-col xl:flex-row items-center justify-center gap-3 active:scale-[0.98] text-sm group"
                            >
                                <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                                    <Key className="w-3.5 h-3.5 text-yellow-500" />
                                </div>
                                <span>Passkey</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (!deviceId) { setError('Enter Device ID first'); return; }
                                    resetFaceAuth();
                                    setShowFaceAuth(true);
                                }}
                                disabled={loading}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex flex-col xl:flex-row items-center justify-center gap-3 active:scale-[0.98] text-sm group"
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <Camera className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                                <span>Face ID</span>
                            </button>

                            <button
                                onClick={toggleMobileWait}
                                disabled={loading}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex flex-col xl:flex-row items-center justify-center gap-3 active:scale-[0.98] text-sm group col-span-2"
                            >
                                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                                </div>
                                <span>Mobile Key Tap</span>
                            </button>
                        </div>

                        <div className="mt-4 text-center">
                            <a href="/register" className="text-sm text-text-dim hover:text-white transition-colors border-b border-dashed border-text-dim/50 hover:border-white pb-0.5">
                                Initialize New Device
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {showFaceAuth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        {authStatus !== 'ANALYZING' && authStatus !== 'SUCCESS' && (
                            <button
                                onClick={() => setShowFaceAuth(false)}
                                className="absolute top-4 right-4 text-text-dim hover:text-white transition-colors p-1 z-10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        {authStatus === 'IDLE' && (
                            <>
                                <div className="text-center mb-6">
                                    <h3 className="text-xl font-bold text-white mb-2">Face Login</h3>
                                    <p className="text-sm text-text-dim">Look at the camera for verification.</p>
                                </div>
                                <FaceCapture onCaptureComplete={handleFaceLogin} mode="login" />
                            </>
                        )}
                        {authStatus === 'ANALYZING' && (
                            <div className="flex flex-col items-center justify-center py-12 space-y-6">
                                <div className="relative w-20 h-20">
                                    <div className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                    <div className="absolute inset-2 border-4 border-blue-400/20 border-b-blue-400 rounded-full animate-spin-reverse"></div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white mb-1">Analyzing...</h3>
                                    <p className="text-sm text-text-dim animate-pulse">Verifying biometric data</p>
                                </div>
                            </div>
                        )}
                        {authStatus === 'SUCCESS' && (
                            <div className="flex flex-col items-center justify-center py-12 space-y-6">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white mb-1">Login Successful</h3>
                                    <p className="text-sm text-green-400">Redirecting to dashboard...</p>
                                </div>
                            </div>
                        )}
                        {authStatus === 'ERROR' && (
                            <div className="flex flex-col items-center justify-center py-8 space-y-6">
                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center animate-in shake duration-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <div className="text-center max-w-xs">
                                    <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
                                    <p className="text-sm text-red-400 mb-6">{statusMessage}</p>
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={() => setShowFaceAuth(false)} className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors">Cancel</button>
                                        <button onClick={resetFaceAuth} className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors">Try Again</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {waitingForMobile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="relative w-full max-w-md bg-surface border border-white/10 rounded-3xl p-10 shadow-[0_0_50px_rgba(59,130,246,0.15)] text-center animate-in zoom-in-95 duration-300">
                        <div className="mb-8 relative">
                            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto relative z-10">
                                <Smartphone className="w-12 h-12 text-primary animate-bounce" />
                            </div>
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 tracking-tight">WAITING FOR TAP</h3>
                        <p className="text-sm text-text-dim mb-8">Please scan your <span className="text-white font-bold">NFC Card</span> or bring your <span className="text-white font-bold">Magnet</span> close to your mobile phone.</p>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-center gap-2 text-xs font-mono text-primary animate-pulse uppercase tracking-[0.2em]"><span className="w-1.5 h-1.5 bg-primary rounded-full"></span>Polling Secure Channel</div>
                            <button onClick={() => setWaitingForMobile(false)} className="mt-4 px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-white/10">Cancel Attempt</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
