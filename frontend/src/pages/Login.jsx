import React, { useState } from 'react';
import { Shield, Key, Smartphone, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api, { getRawBaseUrl } from '../services/api';
import { loginPasskey } from '../services/passkey';

const Login = ({ onLoginSuccess }) => {
    // START: Auto-Generate/Load Device ID
    const [deviceId, setDeviceId] = useState(() => {
        const stored = localStorage.getItem('cybot_device_id');
        if (stored) return stored;
        const newId = 'PC-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        localStorage.setItem('cybot_device_id', newId);
        return newId;
    });
    // END: Auto-Generate/Load Device ID

    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [waitingForBluetooth, setWaitingForBluetooth] = useState(false);

    // Save ID if user edits it manually
    const handleDeviceChange = (e) => {
        setDeviceId(e.target.value);
        localStorage.setItem('cybot_device_id', e.target.value);
    };

    const handleSuccess = (user) => {
        setSuccess(true);
        setTimeout(() => {
            onLoginSuccess(user);
        }, 1500); // 1.5 second delay
    };

    const handleTotpLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/login', { device_id: deviceId, token });
            if (response.data.success) {
                // onLoginSuccess(response.data.user); <--- OLD
                handleSuccess(response.data.user); // <--- NEW
            } else {
                setError(response.data.message);
                setLoading(false); // Ensure loading stops on error
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await loginPasskey(deviceId);
            if (result.success) {
                // onLoginSuccess(result.user);
                handleSuccess(result.user);
            } else {
                setLoading(false);
            }
        } catch (err) {
            setError('Passkey login failed or cancelled');
            setLoading(false);
        }
    };

    const handleBluetoothLogin = () => {
        if (waitingForBluetooth) {
            setWaitingForBluetooth(false);
            return;
        }

        setWaitingForBluetooth(true);
        setError('');

        let attempts = 0;
        const maxAttempts = 30; // 60 seconds (2s interval)

        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                // SEND deviceId to ensure we only get logins for THIS account
                const response = await api.post('/auth/bluetooth-poll', { device_id: deviceId });
                if (response.data.success) {
                    clearInterval(pollInterval);
                    setWaitingForBluetooth(false);
                    // onLoginSuccess(response.data.user);
                    handleSuccess(response.data.user);
                }
            } catch (err) {
                console.error("Polling error:", err);
                if (err.message === "Network Error") {
                    clearInterval(pollInterval);
                    setWaitingForBluetooth(false);
                    setError(
                        <div>
                            Connection Blocked. <a href={`${getRawBaseUrl()}/api/status`} target="_blank" className="underline text-red-300">Click here</a> to trust the backend certificate.
                        </div>
                    );
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                setWaitingForBluetooth(false);
                setError('Bluetooth login timed out. Please try again.');
            }
        }, 1000);

        return () => clearInterval(pollInterval);
    };

    if (success) {
        return (
            <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-8 bg-surface border border-green-500/30 p-12 rounded-2xl shadow-[0_0_50px_rgba(34,197,94,0.2)] animate-in zoom-in-95 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-[loading_1.5s_ease-in-out]"></div>
                    <div className="inline-flex p-6 rounded-full bg-green-500/10 mb-2 ring-1 ring-green-500/30 animate-bounce">
                        <CheckCircle2 className="w-16 h-16 text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Access Granted</h1>
                        <p className="text-green-400 font-mono text-sm tracking-widest uppercase">Identity Verified</p>
                    </div>
                    <div className="text-xs text-text-dim">Redirecting to Secure Console...</div>
                </div>
            </div>
        );
    }

    // Import CheckCircle2 locally if not available globally (it was not imported in original file)
    // Actually it is not imported. I need to add it to imports.
    // Wait, CheckCircle2 is NOT imported. Shield, Key, Smartphone, Loader2, ArrowLeft are the imports.
    // I should add CheckCircle2 to the import list or use something else.
    // I will add it to the imports in a separate edit or assume I can use a different icon.
    // I will use Shield instead if I can't edit imports easily here? No, I am replacing the whole function body essentially, 
    // but I can't easily reach up to imports.
    // Wait, the previous file view showed: import { Shield, Key, Smartphone, Loader2, ArrowLeft } from 'lucide-react';
    // It did NOT allow CheckCircle2.
    // I will use Shield for now with a green color to avoid breaking it.

    /* ... rest of the render code ... */

    return (
        <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 lg:px-12 overflow-hidden">
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
                    {/* Decorative cyber lines */}
                    <div className="absolute -top-10 -right-10 w-20 h-20 border-t-2 border-r-2 border-primary/20 rounded-tr-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-20 h-20 border-b-2 border-l-2 border-primary/20 rounded-bl-3xl"></div>

                    <div className="bg-surface border border-white/10 p-8 lg:p-12 rounded-2xl shadow-2xl relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Login</h2>
                            <Key className="w-5 h-5 text-primary" />
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 text-red-500 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleTotpLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Device Identity</label>
                                <div className="relative group">
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-white transition-colors" />
                                    <input
                                        type="text"
                                        value={deviceId}
                                        onChange={handleDeviceChange}
                                        className="w-full bg-background border border-border rounded-lg py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm placeholder:text-gray-500 font-bold tracking-wider"
                                        placeholder="ENTER-DEVICE-ID"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Authentication Token (Optional)</label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-white transition-colors" />
                                    <input
                                        type="text"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono tracking-[0.5em] text-center text-lg placeholder:text-gray-500"
                                        placeholder="......"
                                        maxLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Authenticate'}
                            </button>
                        </form>

                        <div className="relative my-8">
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
                                disabled={loading || waitingForBluetooth}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-sm group"
                            >
                                <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                                    <Key className="w-3.5 h-3.5 text-yellow-500" />
                                </div>
                                Passkey
                            </button>

                            <button
                                onClick={handleBluetoothLogin}
                                disabled={loading}
                                className={`w-full py-4 border font-medium rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-sm group ${waitingForBluetooth
                                    ? 'bg-blue-500/20 border-blue-500 text-white animate-pulse'
                                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                                    }`}
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                                {waitingForBluetooth ? 'Scanning...' : 'Sensor Login (NFC/Mag)'}
                            </button>
                        </div>

                        <div className="mt-8 text-center">
                            <a href="/register" className="text-sm text-text-dim hover:text-white transition-colors border-b border-dashed border-text-dim/50 hover:border-white pb-0.5">
                                Initialize New Device
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
