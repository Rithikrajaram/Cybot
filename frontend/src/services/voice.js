import api from './api';

class VoiceService {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.isRecording = false;
        this.dataPoints = [];
        this.recordingStartTime = 0;
        this.intervalId = null;

        // Sampling Config
        this.fps = 60;
        this.interval = 1000 / this.fps;

        console.log("RhythmService initialized [v2.0 - Spectral Mode]");
    }

    async startRecording(onDataCallback) {
        try {
            console.log("Requesting microphone access...");
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            source.connect(this.analyser);

            this.analyser.fftSize = 2048;

            // MediaRecorder for Raw Audio (Local Whisper)
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(this.mediaStream);
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };
            this.mediaRecorder.start();

            this.dataPoints = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            const bufferLength = this.analyser.frequencyBinCount;
            const freqDataArray = new Uint8Array(bufferLength);

            this.intervalId = setInterval(() => {
                if (!this.isRecording) return;

                // CRITICAL: Force spectral capture (2D format)
                this.analyser.getByteFrequencyData(freqDataArray);

                // Map first 128 bins to 0..1 range (Higher resolution for timbre capture)
                const voiceBins = Array.from(freqDataArray.slice(0, 128)).map(v => v / 255.0);

                // This makes dataPoints a 2D Array: [[f1,f2...], [f1,f2...], ...]
                this.dataPoints.push(voiceBins);

                if (onDataCallback) {
                    const avgVol = voiceBins.reduce((a, b) => a + b, 0) / voiceBins.length;
                    onDataCallback(avgVol, this.dataPoints.length);
                }
            }, this.interval);

            return true;
        } catch (err) {
            console.error("Error accessing microphone:", err);
            throw err;
        }
    }

    async stopRecording() {
        this.isRecording = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Return a promise that resolves when the audio blob is ready
        const audioBlobPromise = new Promise(resolve => {
            if (!this.mediaRecorder) return resolve(null);
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                resolve(blob);
            };
        });

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        const audioBlob = await audioBlobPromise;
        return {
            spectral: [...this.dataPoints],
            audioBlob: audioBlob
        };
    }

    async registerVoice(userId, data) {
        const { spectral, audioBlob } = data;
        const reader = new FileReader();
        const base64Audio = await new Promise(resolve => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(audioBlob);
        });

        return api.post('/voice/register', {
            user_id: userId,
            audio_data: spectral,
            audio_blob: base64Audio
        });
    }

    async authenticateVoice(userId, data) {
        const { spectral, audioBlob } = data;
        const reader = new FileReader();
        const base64Audio = await new Promise(resolve => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(audioBlob);
        });

        return api.post('/voice/authenticate', {
            user_id: userId,
            audio_data: spectral,
            audio_blob: base64Audio
        });
    }
}

export default new VoiceService();
