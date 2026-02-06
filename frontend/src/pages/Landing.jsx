import React from 'react';
import { Shield, ChevronRight, Smartphone, Key, Lock, Fingerprint, Globe, Server, Activity, FileCheck, ScanFace, Database, Zap, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';

const Landing = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    return (
        <div className="h-[calc(100vh-64px)] w-full bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center selection:bg-primary selection:text-white">

            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

            <div className="max-w-[1600px] w-full px-6 lg:px-12 h-full grid lg:grid-cols-12 gap-8 lg:gap-16 items-center relative z-10">

                <div className="lg:col-span-7 flex flex-col justify-center space-y-8 animate-in slide-in-from-left duration-700">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full w-fit backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-[10px] font-bold tracking-widest text-text-dim uppercase">System Operational</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl xl:text-8xl font-black text-white leading-[0.9] tracking-tighter">
                            SECURE <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-primary to-purple-500 animate-gradient-x">ACCESS_</span>
                        </h1>

                        <p className="text-lg text-text-dim leading-relaxed max-w-xl font-light">
                            Next-gen identity management. Featuring <span className="text-white font-medium">AI Face ID</span>, <span className="text-white font-medium">FIDO2 Passkeys</span>, <span className="text-white font-medium">Mobile Key Tap</span>, and <span className="text-white font-medium">Immutable Audit Logs</span> for zero-trust environments.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <Link to="/login" className="flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-blue-50 transition-all active:scale-95 group shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                            <Key className="w-5 h-5" />
                            <span>Access Console</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link to="/register" className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-lg hover:bg-white/10 transition-all active:scale-95 backdrop-blur-sm">
                            <Smartphone className="w-5 h-5" />
                            <span>New Device</span>
                        </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-8 pt-6 border-t border-white/5 w-fit">
                        <div>
                            <div className="text-2xl font-bold text-white mb-0.5">99.9%</div>
                            <div className="text-[10px] text-text-dim uppercase tracking-widest font-bold">Accuracy</div>
                        </div>
                        <div className="w-px h-full bg-white/10 mx-auto hidden sm:block"></div>
                        <div>
                            <div className="text-2xl font-bold text-white mb-0.5">AES-256</div>
                            <div className="text-[10px] text-text-dim uppercase tracking-widest font-bold">Encrypted</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white mb-0.5">SHA-256</div>
                            <div className="text-[10px] text-text-dim uppercase tracking-widest font-bold">Hashing</div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 h-[90%] max-h-[800px] grid grid-rows-9 grid-cols-2 gap-3 animate-in slide-in-from-right duration-700 delay-100">

                    <div className="row-span-3 col-span-2 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-primary/50 transition-colors flex flex-col justify-start gap-4">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-colors"></div>
                        <div className="flex justify-between items-start relative z-10">
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                <ScanFace className="w-8 h-8 text-blue-400" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-primary animate-pulse">LIVE FEED</span>
                                <Activity className="w-5 h-5 text-green-400" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-white mb-1">AI Face Recognition</h3>
                            <p className="text-sm text-text-dim">Deep learning anti-spoofing & liveness detection.</p>
                        </div>
                    </div>

                    <div className="row-span-2 bg-surface/50 border border-white/10 p-5 rounded-2xl hover:bg-surface/80 transition-colors group flex flex-col justify-start gap-4 backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                            <Fingerprint className="w-6 h-6 text-yellow-500 group-hover:scale-110 transition-transform" />
                            <div className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 font-mono">FIDO2</div>
                        </div>
                        <div className="w-full h-px bg-white/10 my-auto"></div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Passkeys</h3>
                            <p className="text-[10px] text-text-dim mt-1">Hardware Bound Keys</p>
                        </div>
                    </div>

                    <div className="row-span-2 bg-surface/50 border border-white/10 p-5 rounded-2xl hover:bg-surface/80 transition-colors group flex flex-col justify-start gap-4 backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                            <FileCheck className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                        </div>
                        <div className="w-full h-px bg-white/10 my-auto"></div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Audit Log</h3>
                            <p className="text-[10px] text-text-dim mt-1">Hash-Chained Events</p>
                        </div>
                    </div>

                    {/* NEW: NFC & MAGNETOMETER */}
                    <div className="row-span-2 bg-surface/50 border border-white/10 p-5 rounded-2xl hover:bg-surface/80 transition-colors group flex flex-col justify-start gap-4 backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                            <Smartphone className="w-6 h-6 text-green-400 group-hover:rotate-12 transition-transform" />
                            <div className="text-[10px] bg-green-400/10 text-green-400 px-2 py-0.5 rounded border border-green-400/20 font-mono">NFC</div>
                        </div>
                        <div className="w-full h-px bg-white/10 my-auto"></div>
                        <div>
                            <h3 className="font-bold text-white text-sm">NFC Card Tap</h3>
                            <p className="text-[10px] text-text-dim mt-1">Contactless Auth</p>
                        </div>
                    </div>

                    <div className="row-span-2 bg-surface/50 border border-white/10 p-5 rounded-2xl hover:bg-surface/80 transition-colors group flex flex-col justify-start gap-4 backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                            <Zap className="w-6 h-6 text-blue-400 group-hover:scale-125 transition-transform" />
                            <div className="text-[10px] bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded border border-blue-400/20 font-mono">SENSOR</div>
                        </div>
                        <div className="w-full h-px bg-white/10 my-auto"></div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Magnet Sensor</h3>
                            <p className="text-[10px] text-text-dim mt-1">Hall Effect Radar</p>
                        </div>
                    </div>


                    <div className="row-span-1 col-span-2 bg-white/5 border border-white/10 rounded-2xl flex items-center px-6 gap-4 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-text-dim" />
                            <span className="text-xs font-mono text-text-dim uppercase tracking-widest">MongoDB</span>
                        </div>
                        <div className="w-px h-4 bg-white/10 ml-auto"></div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-text-dim" />
                            <span className="text-xs font-mono text-text-dim uppercase tracking-widest">Zero Trust</span>
                        </div>
                    </div>

                    {isMobile && (
                        <Link to="/mobile-tap" className="col-span-2 bg-blue-600/50 border border-blue-400 p-6 rounded-2xl flex items-center justify-between group hover:bg-blue-600 transition-colors animate-bounce shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-xl"><Zap className="w-6 h-6 text-white" /></div>
                                <div><h3 className="font-bold text-white uppercase tracking-tighter">Mobile Key Active</h3><p className="text-xs text-blue-100">Tap to use NFC / Magnet sensor</p></div>
                            </div>
                            <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-2 transition-transform" />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Landing;
