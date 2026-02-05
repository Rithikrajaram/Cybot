import React from 'react';
import { Shield, ChevronRight, Smartphone, Key, Lock, Fingerprint, Globe, Server, Activity, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const Landing = () => {
    return (
        <div className="min-h-[calc(100vh-64px)] w-full bg-background relative overflow-x-hidden flex items-center">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 lg:py-4 relative z-10 w-full">
                <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">

                    {/* Left Column: Hero Content */}
                    <div className="space-y-10 animate-in slide-in-from-left duration-700">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full w-fit">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                <span className="text-xs font-bold tracking-wider text-blue-400 uppercase">Secure Environment V4.2</span>
                            </div>

                            <h1 className="text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-none tracking-tight">
                                ZERO <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">TRUST</span>
                            </h1>

                            <p className="text-xl text-text-dim leading-relaxed max-w-lg border-l-4 border-primary/20 pl-6">
                                Enterprise-grade identity management. Hardware-backed cryptographic verification for every session.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link to="/login" className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95 group">
                                <Key className="w-5 h-5" />
                                <span>Access Console</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link to="/register" className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all active:scale-95">
                                <Smartphone className="w-5 h-5" />
                                <span>Register Device</span>
                            </Link>
                        </div>

                        <div className="grid grid-cols-3 gap-8 py-8 border-t border-white/5">
                            <div>
                                <div className="text-3xl font-black text-white mb-1">99.9%</div>
                                <div className="text-xs text-text-dim uppercase tracking-widest font-bold">Uptime</div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-white mb-1">&lt;1ms</div>
                                <div className="text-xs text-text-dim uppercase tracking-widest font-bold">Latency</div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-white mb-1">SHA-256</div>
                                <div className="text-xs text-text-dim uppercase tracking-widest font-bold">Encryption</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Feature Grid (Bento Style) */}
                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-right duration-700 delay-200">
                        {/* Card 1 */}
                        <div className="col-span-2 bg-surface hover:bg-surface/80 border border-white/10 p-6 rounded-2xl transition-colors group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
                            <div className="flex items-start justify-between mb-4 relative z-10">
                                <div className="p-3 bg-green-500/10 rounded-xl">
                                    <Shield className="w-6 h-6 text-green-500" />
                                </div>
                                <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase rounded border border-green-500/20">Active</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2 relative z-10">Hardware-Backed Security</h3>
                            <p className="text-sm text-text-dim leading-relaxed relative z-10">
                                Leveraging TPM 2.0 and Secure Enclave modules for key storage. Private keys never leave the device hardware.
                            </p>
                        </div>

                        {/* Card 2 */}
                        <div className="bg-surface hover:bg-surface/80 border border-white/10 p-6 rounded-2xl transition-colors hover:border-purple-500/30 group">
                            <Fingerprint className="w-8 h-8 text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-white mb-1">Biometric Ops</h3>
                            <p className="text-xs text-text-dim">Passkey & FaceID native integration.</p>
                        </div>

                        {/* Card 3 */}
                        <div className="bg-surface hover:bg-surface/80 border border-white/10 p-6 rounded-2xl transition-colors hover:border-orange-500/30 group">
                            <Activity className="w-8 h-8 text-orange-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-white mb-1">Live Audit</h3>
                            <p className="text-xs text-text-dim">Immutable session logging.</p>
                        </div>

                        {/* Card 4 - Wide Grid */}
                        <div className="col-span-2 grid grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="bg-surface p-6 hover:bg-white/5 transition-colors group">
                                <Globe className="w-6 h-6 text-blue-400 mb-3 group-hover:text-blue-300 transition-colors" />
                                <div className="font-bold text-white text-sm">Global Edge</div>
                            </div>
                            <div className="bg-surface p-6 hover:bg-white/5 transition-colors group">
                                <FileCheck className="w-6 h-6 text-yellow-400 mb-3 group-hover:text-yellow-300 transition-colors" />
                                <div className="font-bold text-white text-sm">SOC-2 Ready</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Landing;
