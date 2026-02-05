import React, { useState } from 'react';
import { Shield, Smartphone, ArrowLeft, CheckCircle2, Copy, Download, Key } from 'lucide-react';
import api, { getRawBaseUrl } from '../services/api';
import { registerPasskey } from '../services/passkey';

const Register = () => {
    const [deviceName, setDeviceName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [registrationData, setRegistrationData] = useState(null);
    const [passkeySuccess, setPasskeySuccess] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const resp = await api.post('/register', { device_name: deviceName });
            setRegistrationData(resp.data);
        } catch (err) {
            console.error("Registration failed:", err);
            if (err.message === "Network Error") {
                setError(
                    <span>
                        Connection Failed. Is the backend running? <br />
                        <a href={`${getRawBaseUrl()}/api/status`} target="_blank" className="underline text-red-300 font-bold">Check Server Status / Trust Cert</a>
                    </span>
                );
            } else {
                setError(err.response?.data?.message || 'Registration failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyRegister = async () => {
        if (!deviceName) {
            setError('Please enter a device name first');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await registerPasskey(deviceName);
            if (result.success) {
                setPasskeySuccess(true);
            }
        } catch (err) {
            setError('Passkey registration failed or cancelled');
        } finally {
            setLoading(false);
        }
    };

    if (passkeySuccess) {
        return (
            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-8 bg-surface border border-white/10 p-12 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>

                    <div className="inline-flex p-4 rounded-full bg-green-500/10 mb-2 ring-1 ring-green-500/30">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-white tracking-tight">Passkey Registered</h1>
                        <p className="text-text-dim leading-relaxed">Hardware credential stored in secure enclave.</p>
                    </div>

                    <a href="/" className="inline-flex items-center justify-center w-full px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all uppercase tracking-widest text-sm">
                        Proceed to Login
                    </a>
                </div>
            </div>
        );
    }

    if (registrationData) {
        return (
            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 py-12">
                <div className="max-w-3xl w-full bg-surface border border-white/10 p-10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-500 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>

                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1">Device Registration Complete</h1>
                            <p className="text-text-dim text-sm">Credentials generated. Import immediately.</p>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-primary block">Device ID</label>
                                <div className="group flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                                    <span className="font-mono text-white text-sm truncate pr-4">{registrationData.device_id}</span>
                                    <button onClick={() => navigator.clipboard.writeText(registrationData.device_id)} className="text-text-dim hover:text-white transition-colors">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-primary block">TOTP Secret</label>
                                <div className="group flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                                    <span className="font-mono text-white text-sm truncate pr-4">{registrationData.secret}</span>
                                    <button onClick={() => navigator.clipboard.writeText(registrationData.secret)} className="text-text-dim hover:text-white transition-colors">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4">
                                <a href="/" className="flex items-center justify-center w-full py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-all uppercase tracking-widest text-sm">
                                    Return to Console
                                </a>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-6 bg-white/5 rounded-xl p-8 border border-white/5">
                            <div className="p-3 bg-white rounded-xl shadow-lg">
                                <img
                                    src={`data:image/png;base64,${registrationData.qr_data}`}
                                    alt="QR Code"
                                    className="w-40 h-40 mix-blend-multiply"
                                />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-white font-bold text-sm">Scan with Authenticator</p>
                                <p className="text-xs text-text-dim">Google Auth / Authy / Microsoft Auth</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 lg:px-12 overflow-hidden">
            <div className="max-w-7xl w-full grid lg:grid-cols-12 gap-16 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Left Side: Brand & Context */}
                <div className="lg:col-span-7 space-y-8">
                    <a href="/" className="inline-flex items-center gap-2 text-text-dim hover:text-white mb-2 transition-colors group text-sm font-mono uppercase tracking-widest">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Return to Gate
                    </a>

                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-3 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full w-fit">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                            <span className="text-xs font-mono font-medium text-yellow-500 tracking-widest uppercase">Initializing New Device</span>
                        </div>

                        <h1 className="text-6xl lg:text-8xl font-black text-white leading-none tracking-tight">
                            SETUP <br />
                            <span className="text-text-dim">IDENTITY</span>
                        </h1>
                        <p className="text-xl text-text-dim max-w-lg leading-relaxed font-light border-l-2 border-primary/30 pl-6">
                            Establish a new cryptographic identity. This device will be permanently linked to your profile until revocation.
                        </p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="lg:col-span-5 relative">
                    {/* Decorative cyber lines */}
                    <div className="absolute -top-10 -right-10 w-20 h-20 border-t-2 border-r-2 border-primary/20 rounded-tr-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-20 h-20 border-b-2 border-l-2 border-primary/20 rounded-bl-3xl"></div>

                    <div className="bg-surface border border-white/10 p-8 lg:p-12 rounded-2xl shadow-2xl relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Provisioning</h2>
                            <Smartphone className="w-5 h-5 text-primary" />
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 text-red-500 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Device Designation</label>
                                <input
                                    type="text"
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    className="w-full bg-background border border-border rounded-lg py-4 px-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm placeholder:text-gray-500"
                                    placeholder="e.g., MAIN-TERMINAL-01"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-sm"
                            >
                                Generate Credentials
                            </button>
                        </form>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-surface px-4 text-text-dim font-medium tracking-widest">Alternative Methods</span>
                            </div>
                        </div>

                        <button
                            onClick={handlePasskeyRegister}
                            disabled={loading}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] text-sm group"
                        >
                            <Key className="w-3.5 h-3.5 text-yellow-500" />
                            Use Biometric Passkey
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
