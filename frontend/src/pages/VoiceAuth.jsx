import React, { useState, useRef, useEffect } from 'react';
import { Mic, CheckCircle, ArrowLeft, Activity, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import voiceService from '../services/voice';

const VoiceAuth = ({ onLoginSuccess }) => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('select'); // select, register, authenticate
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Ready');
    const [pointsCount, setPointsCount] = useState(0);
    const [currentAvgVol, setCurrentAvgVol] = useState(0);
    const [deviceId, setDeviceId] = useState('');
    const [error, setError] = useState('');
    const [recognizedText, setRecognizedText] = useState('');

    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    // Clear error on mode change
    useEffect(() => {
        setError('');
        setRecognizedText('');
        setStatus('Ready');
    }, [mode]);

    // Visualizer effect
    useEffect(() => {
        if (!isRecording) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        const draw = () => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
                const w = canvasRef.current.width;
                const h = canvasRef.current.height;

                // Shift everything left
                const imageData = ctx.getImageData(2, 0, w - 2, h);
                ctx.putImageData(imageData, 0, 0);

                // Clear new strip
                ctx.fillStyle = '#111827'; // Dark background
                ctx.fillRect(w - 2, 0, 2, h);

                // Draw amplitude bar
                const barHeight = currentAvgVol * h;
                const hue = 270 + (currentAvgVol * 60); // Purple/Indigo
                ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                ctx.fillRect(w - 2, h - barHeight, 2, barHeight);
            }
            animationRef.current = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isRecording, currentAvgVol]);

    const handleStartRecording = async () => {
        if (!deviceId) {
            setError("Enter Device ID first!");
            return;
        }
        try {
            setError('');
            setPointsCount(0);
            setRecognizedText('');
            setStatus("Listening...");

            // Start Audio capture (Local Whisper + Spectral)
            await voiceService.startRecording((avgVol, count) => {
                setCurrentAvgVol(avgVol);
                setPointsCount(count);
            });

            setIsRecording(true);
        } catch (err) {
            console.error("Mic access error:", err);
            setError('Microphone access denied.');
            setStatus('Error');
        }
    };

    const handleStopRecording = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        setStatus('Processing Local Whisper Auth...');

        // Stop Audio capture (Now returns { spectral, audioBlob })
        const data = await voiceService.stopRecording();
        setCurrentAvgVol(0);

        if (data.spectral.length < 50) {
            setError("Recording too short. Speak clearly for 2 seconds.");
            setStatus('Error');
            return;
        }

        try {
            let resp;
            if (mode === 'register') {
                resp = await voiceService.registerVoice(deviceId, data);
            } else {
                resp = await voiceService.authenticateVoice(deviceId, data);
            }

            if (resp.data.success) {
                const phrase = resp.data.recognized_text;
                if (phrase) setRecognizedText(phrase);

                setStatus(mode === 'register' ? `Registered! Word: "${phrase}"` : 'Access Granted!');
                if (mode === 'authenticate') {
                    setTimeout(() => onLoginSuccess(resp.data.user), 1000);
                } else {
                    setTimeout(() => setMode('select'), 2000);
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification Failed');
            setStatus('Denied');
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-text relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1),transparent_70%)] pointer-events-none"></div>

            {/* Header */}
            <div className="absolute top-8 left-8">
                <button
                    onClick={() => mode === 'select' ? navigate('/login') : setMode('select')}
                    className="flex items-center gap-2 text-text-dim hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" /> Back
                </button>
            </div>

            <div className="w-full max-w-md bg-surface border border-white/10 rounded-2xl shadow-2xl p-8 z-10 transition-all">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="text-purple-500 w-8 h-8" />
                        Voice Auth
                    </h2>
                    <div className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded font-mono border border-purple-500/30">v2.0 SPECTRAL</div>
                </div>

                {mode === 'select' ? (
                    <div className="space-y-4">
                        <p className="text-text-dim text-sm leading-relaxed mb-6">
                            Identify yourself using your unique vocal fingerprint. Speak naturally for 2 seconds (English only).
                        </p>
                        <button
                            onClick={() => setMode('authenticate')}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20 active:scale-[0.98]"
                        >
                            <CheckCircle className="w-5 h-5" /> Start Authentication
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            <Mic className="w-5 h-5 text-purple-400" /> Register Voice Print
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Device ID / Username</label>
                            <input
                                type="text"
                                value={deviceId}
                                onChange={(e) => setDeviceId(e.target.value)}
                                placeholder="e.g. jdoe_01"
                                className="w-full bg-background border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:border-purple-500 focus:outline-none transition-colors"
                            />
                        </div>

                        {/* Visualizer */}
                        <div className="relative h-32 bg-black/40 rounded-xl overflow-hidden border border-white/5 backdrop-blur-sm">
                            <canvas
                                ref={canvasRef}
                                width={400}
                                height={128}
                                className="w-full h-full opacity-80"
                            />
                            {!isRecording && !error && (
                                <div className="absolute inset-0 flex items-center justify-center text-text-dim/40 font-mono text-[10px] tracking-[4px] uppercase">
                                    Spectral Ready
                                </div>
                            )}
                            {error && (
                                <div className="absolute inset-0 flex items-center justify-center text-red-400 font-mono text-xs px-4 text-center">
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="text-center">
                            <div className="text-sm font-medium text-purple-300 min-h-[20px]">
                                {status}
                            </div>

                            {/* NEW: Explicit Phrase Display */}
                            {(isRecording || recognizedText) && (
                                <div className="mt-4 p-4 bg-white/5 border border-purple-500/30 rounded-xl">
                                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">Secret Phrase</div>
                                    <div className="text-lg text-white font-medium italic">
                                        "{recognizedText || "..."}"
                                    </div>
                                </div>
                            )}

                            {isRecording && (
                                <div className="text-[10px] text-text-dim mt-2 font-mono">
                                    CAPTURING: {pointsCount} FRAMES
                                </div>
                            )}
                        </div>

                        <button
                            onMouseDown={handleStartRecording}
                            onMouseUp={handleStopRecording}
                            onTouchStart={handleStartRecording}
                            onTouchEnd={handleStopRecording}
                            className={`w-full py-10 border-2 rounded-2xl transition-all select-none
                                ${isRecording
                                    ? 'bg-purple-600/20 border-purple-500 text-purple-400 scale-[0.97] shadow-[0_0_40px_rgba(168,85,247,0.2)]'
                                    : 'bg-surface border-white/10 text-white hover:border-purple-500/50 hover:bg-white/5 active:scale-95'
                                }
                            `}
                        >
                            <div className="flex flex-col items-center gap-3">
                                <div className={`p-4 rounded-full ${isRecording ? 'bg-purple-500 text-white animate-pulse' : 'bg-white/5 text-purple-400'}`}>
                                    <Mic className="w-8 h-8" />
                                </div>
                                <span className="font-black text-sm tracking-[0.2em] uppercase">
                                    {isRecording ? 'Release to Verify' : 'Hold to Speak'}
                                </span>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceAuth;