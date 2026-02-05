import React, { useEffect, useState } from 'react';
import { ShieldCheck, Server, Lock, Cpu, WifiOff, Terminal, Activity } from 'lucide-react';
import api from '../services/api';

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState({
        cpu: '12%',
        memory: '2.4GB / 16GB',
        network: 'Off-Grid (Encrypted)',
        uptime: '14d 2h 44m'
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="animate-in slide-in-from-left duration-700">
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">COMMAND CENTER</h1>
                    <p className="text-text-dim flex items-center gap-2 text-sm">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        SESSION: <span className="text-white font-mono font-bold tracking-wider">{user}</span>
                    </p>
                </div>
                <div className="flex gap-4 animate-in slide-in-from-right duration-700">
                    <div className="flex flex-col items-end px-4 py-2 bg-background border border-white/10 rounded-lg">
                        <span className="text-[10px] uppercase tracking-widest text-text-dim font-bold">Security Level</span>
                        <span className="text-xs font-bold text-green-400 flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Maximum
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'System Load', value: stats.cpu, icon: Cpu, color: 'text-blue-500' },
                    { label: 'Memory', value: stats.memory, icon: Server, color: 'text-purple-500' },
                    { label: 'Network', value: stats.network, icon: WifiOff, color: 'text-orange-500' },
                    { label: 'Uptime', value: stats.uptime, icon: Activity, color: 'text-green-500' },
                ].map((item, idx) => (
                    <div key={idx} className="bg-surface border border-white/10 p-6 rounded-xl hover:border-primary/50 transition-all group animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-text-dim text-xs font-bold uppercase tracking-widest">{item.label}</p>
                            <item.icon className={`w-5 h-5 ${item.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                        </div>
                        <p className="text-xl font-bold font-mono text-white">{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-surface border border-white/10 rounded-xl p-8 space-y-6 overflow-hidden relative group animate-in slide-in-from-bottom duration-700">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Terminal className="w-32 h-32" />
                        </div>

                        <div className="flex items-center justify-between mb-2 relative z-10">
                            <h2 className="text-lg font-bold flex items-center gap-3 uppercase tracking-wider text-white">
                                <Terminal className="w-5 h-5 text-primary" />
                                Live Environment
                            </h2>
                            <span className="px-2 py-1 rounded bg-background border border-white/10 text-primary text-[10px] font-mono font-bold uppercase">Safe Mode</span>
                        </div>

                        <div className="space-y-3 font-mono text-sm leading-relaxed p-6 bg-background rounded-lg border border-white/5 relative z-10">
                            <div className="flex gap-2">
                                <span className="text-green-500">$</span>
                                <span className="text-white">init_secure_protocol --force</span>
                            </div>
                            <div className="text-text-dim pl-4 border-l border-white/10 ml-1">
                                [KERNEL] Loading cryptographic drivers... OK<br />
                                [KERNEL] Verifying hardware signatures... OK<br />
                                [AUTH] User session token valid.<br />
                                <span className="text-green-500">[SUCCESS] Environment isolated.</span>
                            </div>
                            <div className="pt-2">
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-2/3" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-surface border border-primary/20 rounded-xl p-8 animate-in zoom-in duration-700 delay-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none"></div>

                        <Lock className="w-8 h-8 text-primary mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Enclave Active</h3>
                        <p className="text-text-dim text-sm leading-relaxed mb-6">
                            Immutable audit logging is engaged. All session activity is cryptographically signed and stored.
                        </p>
                        <a href="/logs" className="block text-center py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold text-white transition-all border border-white/10 uppercase tracking-wider">
                            Access Logs
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
