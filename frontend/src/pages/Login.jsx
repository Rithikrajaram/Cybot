import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Key, Smartphone, Loader2, ArrowLeft, Activity } from 'lucide-react';
import api from '../services/api';
import { loginPasskey } from '../services/passkey';

const Login = ({ onLoginSuccess }) => {
    const [deviceId, setDeviceId] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                                        onChange={(e) => setDeviceId(e.target.value)}
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

                        <button
                            onClick={handlePasskeyLogin}
                            disabled={loading}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] text-sm group"
                        >
                            <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                                <Key className="w-3.5 h-3.5 text-yellow-500" />
                            </div>
                            Hardware Passkey
                        </button>

                        <Link
                            to="/voice-auth"
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] text-sm group"
                        >
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                                <Activity className="w-3.5 h-3.5 text-purple-500" />
                            </div>
                            Voice Login
                        </Link>



                        <div className="mt-8 text-center">
                            <Link to="/register" className="text-sm text-text-dim hover:text-white transition-colors border-b border-dashed border-text-dim/50 hover:border-white pb-0.5">
                                Initialize New Device
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
