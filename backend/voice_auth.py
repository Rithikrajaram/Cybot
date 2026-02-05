import numpy as np
from typing import List, Tuple, Union

class VoiceAuthenticator:
    def __init__(self, threshold: float = 0.4, n_mels: int = 40):
        """
        Initialize Voice Authenticator.
        
        Args:
            threshold (float): Lower threshold for the new Mel-spectral features.
            n_mels (int): Number of Mel bands for processing.
        """
        self.threshold = threshold
        self.n_mels = n_mels

    def _get_mel_filterbank(self, n_fft_bins: int) -> np.ndarray:
        """Simple Mel Filterbank implementation."""
        # Focus on voice range (roughly 0 - 3000Hz)
        # 128 bins from FFT 2048 at 44.1kHz covers ~2.7kHz
        mel_filters = np.zeros((self.n_mels, n_fft_bins))
        
        # Triangular filters across the 128 bins
        bin_indices = np.linspace(0, n_fft_bins - 1, self.n_mels + 2).astype(int)
        
        for i in range(self.n_mels):
            left, center, right = bin_indices[i:i+3]
            mel_filters[i, left:center] = np.linspace(0, 1, center - left)
            mel_filters[i, center:right] = np.linspace(1, 0, right - center)
            
        return mel_filters

    def _process_mel_spectrogram(self, spec: np.ndarray) -> np.ndarray:
        """Converts raw FFT bins to Mel-scaled power spectrogram."""
        # 1. Apply Filterbank
        filters = self._get_mel_filterbank(spec.shape[1])
        mel_spec = np.dot(spec, filters.T)
        
        # 2. Log compression (human ear is logarithmic)
        mel_spec = np.log10(mel_spec + 1e-6)
        
        # 3. Per-frame normalization (Standardization)
        # Makes it volume and environment independent
        mel_spec = (mel_spec - np.mean(mel_spec, axis=1, keepdims=True)) / (np.std(mel_spec, axis=1, keepdims=True) + 1e-6)
        
        return mel_spec

    def _compute_dtw_spectral_distance(self, spec1: np.ndarray, spec2: np.ndarray) -> float:
        """
        Compute DTW distance between two 2D Mel-Spectrograms.
        """
        # Convert raw bins to Mel features
        m1 = self._process_mel_spectrogram(spec1)
        m2 = self._process_mel_spectrogram(spec2)
        
        n, m = len(m1), len(m2)
        dtw_matrix = np.full((n + 1, m + 1), np.inf)
        dtw_matrix[0, 0] = 0

        # Cosine distance is often better for spectral vectors than Euclidean
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                # Cosine distance = 1 - (A.B / (|A||B|))
                v1, v2 = m1[i-1], m2[j-1]
                denom = (np.linalg.norm(v1) * np.linalg.norm(v2)) + 1e-9
                cost = 1 - (np.dot(v1, v2) / denom)
                
                last_min = min(dtw_matrix[i-1, j], 
                               dtw_matrix[i, j-1], 
                               dtw_matrix[i-1, j-1])
                dtw_matrix[i, j] = cost + last_min

        return dtw_matrix[n, m] / max(n, m)

    def extract_voice_print(self, spectrogram_data: List[List[float]]) -> np.ndarray:
        """
        Cleans and prepares spectrogram data for verification.
        """
        spec = np.array(spectrogram_data)
        if spec.size == 0 or len(spec.shape) < 2: return np.array([])
        
        # Energy threshold lowered to 0.005 to capture very faint voice tails
        energy = np.mean(spec, axis=1)
        active_frames = np.where(energy > 0.005)[0]
        
        if len(active_frames) == 0:
            return np.array([])
            
        return spec[active_frames[0]:active_frames[-1]+1]

    def verify_voice(self, stored_print: List[List[float]], input_print: List[List[float]]) -> Tuple[bool, str, float]:
        """
        Compares two spectral voice prints.
        Returns: (is_match, message, distance)
        """
        s1 = self.extract_voice_print(stored_print)
        s2 = self.extract_voice_print(input_print)

        if len(s1) == 0 or len(s2) == 0:
            return False, "Insufficient audio signal detected.", 1.0

        distance = self._compute_dtw_spectral_distance(s1, s2)
        similarity = max(0, (1 - distance / self.threshold) * 100)
        
        print(f"DEBUG VOICE VERIFY: Distance = {distance:.4f} (Threshold: {self.threshold}) | Similarity: {similarity:.1f}%")

        is_match = distance <= self.threshold

        if is_match:
            return True, f"Voice Match! Similarity: {similarity:.1f}%", distance
        else:
            return False, f"Voice mismatch (Dist: {distance:.3f} > {self.threshold}). Profile too different.", distance

# Testing Block
if __name__ == "__main__":
    # Simulate two similar voices
    v1 = np.random.rand(100, 32) * 0.5
    v2 = v1 + np.random.normal(0, 0.05, (100, 32)) # v2 is v1 with noise
    
    auth = VoiceAuthenticator(threshold=0.8)
    success, msg = auth.verify_voice(v1.tolist(), v2.tolist())
    print(f"Test match: {success} - {msg}")
    
    # Simulate a different voice
    v3 = np.random.rand(100, 32) * 0.5
    success, msg = auth.verify_voice(v1.tolist(), v3.tolist())
    print(f"Test mismatch: {success} - {msg}")
