import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";

const FaceCapture = ({ onCaptureComplete, mode = "register" }) => {
    const webcamRef = useRef(null);
    const [capturing, setCapturing] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [progress, setProgress] = useState(0);

    const captureFrame = useCallback(() => {
        if (webcamRef.current) {
            // lower quality for speed in liveness checks
            return webcamRef.current.getScreenshot({ width: 640, height: 480 });
        }
        return null;
    }, [webcamRef]);

    const startRegistration = async () => {
        setCapturing(true);
        const images = [];

        setInstruction("Calculated 3 snapshots... Stay still.");

        // Capture 3 images with delay
        for (let i = 0; i < 3; i++) {
            setInstruction(`Capturing ${i + 1}/3...`);
            const img = captureFrame();
            if (img) images.push(img);
            setProgress(((i + 1) / 3) * 100);
            await new Promise(r => setTimeout(r, 800)); // 800ms delay
        }

        setInstruction("Processing...");
        onCaptureComplete(images);
        setCapturing(false);
    };

    const startLivenessLogin = async () => {
        setCapturing(true);
        const livenessFrames = [];

        try {
            // 1. Initial Static
            setInstruction("Look at the camera...");
            await new Promise(r => setTimeout(r, 1000));

            // 2. Challenge
            setInstruction("BLINK NOW!");
            // Capture burst for 2 seconds (sufficient for blink)
            const startTime = Date.now();
            while (Date.now() - startTime < 2500) {
                const img = captureFrame();
                if (img) livenessFrames.push(img);
                await new Promise(r => setTimeout(r, 100)); // 10fps
            }

            setInstruction("Analyzing...");
            await new Promise(r => setTimeout(r, 500)); // Small delay for UI update

            if (livenessFrames.length === 0) {
                throw new Error("Camera failed to capture any frames.");
            }

            // Pick the sharpest/clearest frame as the "Match Image" (simplified: first frame)
            const matchImage = livenessFrames[0];

            await onCaptureComplete({ liveness_images: livenessFrames, match_image: matchImage });
        } catch (err) {
            console.error("Face Capture/Login Error:", err);
            setInstruction("Error: " + (err.message || "Failed"));
            // Propagate error to parent so Login.jsx can show the persistent error message
            throw err;
        } finally {
            setCapturing(false);
            setInstruction("");
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="relative border-4 border-blue-500 rounded-lg overflow-hidden w-full max-w-sm aspect-video bg-black shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                    videoConstraints={{
                        width: 640,
                        height: 480,
                        facingMode: "user"
                    }}
                />

                {/* Face Overlay / Guidelines */}
                <div className="absolute inset-0 border-2 border-blue-400/30 rounded-full w-48 h-64 m-auto pointer-events-none"></div>

                {instruction && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                        <span className="bg-black/70 text-white px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                            {instruction}
                        </span>
                    </div>
                )}
            </div>

            {!capturing && (
                <button
                    onClick={mode === "register" ? startRegistration : startLivenessLogin}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    {mode === "register" ? "Start Face Scan" : "Start Face Login"}
                </button>
            )}

            {capturing && (
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
            )}
        </div>
    );
};

export default FaceCapture;
