import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, Database, AlertTriangle, Search, Filter, RotateCcw } from 'lucide-react';
import api from '../services/api';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [integrity, setIntegrity] = useState({ valid: true, status: '' });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const resp = await api.get('/logs');
            if (resp.data.success) {
                setLogs(resp.data.logs);
                setIntegrity({ valid: resp.data.is_valid, status: resp.data.integrity_status });
            }
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                        <Database className="w-8 h-8 text-primary" />
                        Audit Chain
                    </h1>
                    <p className="text-text-dim">Immutable records of all security events and authentication attempts</p>
                </div>

                <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border ${integrity.valid ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {integrity.valid ? <CheckCircle className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                    <div>
                        <div className="text-xs uppercase tracking-widest font-bold opacity-70">Integrity Status</div>
                        <div className="font-bold">{integrity.status}</div>
                    </div>
                </div>
            </div>

            <div className="bg-surface/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-xl transition-all shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col md:flex-row gap-4 justify-between lg:items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                        <input
                            type="text"
                            placeholder="Search logs by action or device..."
                            className="w-full bg-background border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchLogs} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option>All Events</option>
                            <option>Login Success</option>
                            <option>Login Failure</option>
                            <option>Registration</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5">
                                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-text-dim border-b border-white/5">Timestamp</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-text-dim border-b border-white/5">Action</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-text-dim border-b border-white/5">Device / User</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-text-dim border-b border-white/5">Merkle Hash</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.map((log, idx) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 text-sm font-mono text-text-dim whitespace-nowrap">{log.timestamp}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${log.event_data.includes('Success') || log.event_data.includes('Registered') ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                                log.event_data.includes('Failed') ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            }`}>
                                            {log.event_data}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-sm">
                                        {log.event_data.split(': ').length > 1 ? log.event_data.split(': ')[1] : 'SYSTEM'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 group-hover:text-primary transition-colors cursor-help" title={log.current_hash}>
                                            <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                            <span className="font-mono text-xs text-text-dim truncate max-w-[150px]">{log.current_hash}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && !loading && (
                        <div className="p-20 text-center text-text-dim">
                            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No audit records found in the chain.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Logs;
