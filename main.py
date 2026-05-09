import os
import wfdb
import numpy as np
import matplotlib.pyplot as plt

from scipy.fft import fft, fftfreq
from scipy.signal import butter, filtfilt, iirnotch, find_peaks

import pywt
from sklearn.preprocessing import MinMaxScaler

# Create output folders if they don't exist
os.makedirs("plots", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

# =========================================================
# STEP 1 — READ MIT-BIH ECG DATASET
# =========================================================

record = wfdb.rdrecord('dataset/100')

# First ECG channel
signal = record.p_signal[:, 0]

# Sampling frequency
fs = record.fs

print("Sampling Frequency:", fs)
print("Signal Length:", len(signal))
print("Signal Shape:", signal.shape)

# =========================================================
# STEP 2 — READ ECG ANNOTATIONS
# =========================================================

annotation = wfdb.rdann('dataset/100', 'atr')

print("First 10 Beat Labels:")
print(annotation.symbol[:10])

print("First 10 Beat Locations:")
print(annotation.sample[:10])

# =========================================================
# STEP 3 — PLOT RAW ECG
# =========================================================

plt.figure(figsize=(15,4))

plt.plot(signal[1000:3000])

plt.title("Raw ECG Signal")
plt.xlabel("Samples")
plt.ylabel("Amplitude")

plt.grid()

plt.savefig("plots/raw_ecg.png")

plt.show()

# =========================================================
# STEP 4 — FFT ANALYSIS
# =========================================================

N = len(signal)

# Compute FFT
yf = fft(signal)

# Frequency axis
xf = fftfreq(N, 1 / fs)

# Plot FFT Spectrum
plt.figure(figsize=(15,4))

plt.plot(xf[:N//2], np.abs(yf[:N//2]))

plt.title("FFT Spectrum of ECG")
plt.xlabel("Frequency (Hz)")
plt.ylabel("Magnitude")

plt.grid()

plt.savefig("plots/fft_ecg.png")

plt.show()

# =========================================================
# STEP 5 — BANDPASS FILTER
# =========================================================

def bandpass_filter(signal, lowcut=0.5, highcut=40, fs=360, order=4):

    nyquist = 0.5 * fs

    low = lowcut / nyquist
    high = highcut / nyquist

    b, a = butter(order, [low, high], btype='band')

    filtered_signal = filtfilt(b, a, signal)

    return filtered_signal

bandpass_ecg = bandpass_filter(signal)

# Plot Bandpass Filtered ECG
plt.figure(figsize=(15,4))

plt.plot(bandpass_ecg[1000:3000])

plt.title("Bandpass Filtered ECG")
plt.xlabel("Samples")
plt.ylabel("Amplitude")

plt.grid()

plt.savefig("plots/bandpass_ecg.png")

plt.show()

# =========================================================
# STEP 6 — NOTCH FILTER (50 Hz)
# =========================================================

def notch_filter(signal, freq=50, fs=360, Q=30):

    b, a = iirnotch(freq, Q, fs)

    filtered_signal = filtfilt(b, a, signal)

    return filtered_signal

notch_ecg = notch_filter(bandpass_ecg)

# Plot Notch Filtered ECG
plt.figure(figsize=(15,4))

plt.plot(notch_ecg[1000:3000])

plt.title("Notch Filtered ECG")
plt.xlabel("Samples")
plt.ylabel("Amplitude")

plt.grid()

plt.savefig("plots/notch_ecg.png")

plt.show()

# =========================================================
# STEP 7 — WAVELET DENOISING
# =========================================================

def wavelet_denoise(signal, wavelet='db4', level=4):

    coeffs = pywt.wavedec(signal, wavelet, level=level)

    # MAD-based noise estimate from finest detail coefficients
    sigma     = np.median(np.abs(coeffs[-1])) / 0.6745
    threshold = sigma * np.sqrt(2 * np.log(len(signal)))

    denoised_coeffs = []

    for coeff in coeffs:

        denoised_coeff = pywt.threshold(coeff, threshold, mode='soft')

        denoised_coeffs.append(denoised_coeff)

    reconstructed_signal = pywt.waverec(denoised_coeffs, wavelet)

    return reconstructed_signal

wavelet_ecg = wavelet_denoise(notch_ecg)

# Match original signal length
wavelet_ecg = wavelet_ecg[:len(notch_ecg)]

# Plot Wavelet ECG
plt.figure(figsize=(15,4))

plt.plot(wavelet_ecg[1000:3000])

plt.title("Wavelet Denoised ECG")
plt.xlabel("Samples")
plt.ylabel("Amplitude")

plt.grid()

plt.savefig("plots/wavelet_ecg.png")

plt.show()

# =========================================================
# STEP 8 — NORMALIZATION
# =========================================================

scaler = MinMaxScaler()

normalized_ecg = scaler.fit_transform(
    wavelet_ecg.reshape(-1,1)
).flatten()

# Plot Normalized ECG
plt.figure(figsize=(15,4))

plt.plot(normalized_ecg[1000:3000])

plt.title("Normalized ECG")
plt.xlabel("Samples")
plt.ylabel("Normalized Amplitude")

plt.grid()

plt.savefig("plots/normalized_ecg.png")

plt.show()

# =========================================================
# STEP 9 — R PEAK DETECTION
# =========================================================

r_peaks, properties = find_peaks(
    normalized_ecg,
    distance=150,
    height=0.6
)

print("Number of R Peaks:", len(r_peaks))

# Plot R Peaks
plt.figure(figsize=(15,4))

# Use range(1000,3000) so signal x and peak x are in the same coordinate space
plt.plot(range(1000, 3000), normalized_ecg[1000:3000])

# Show peaks only in displayed region
visible_peaks = r_peaks[
    (r_peaks >= 1000) & (r_peaks <= 3000)
]

plt.plot(
    visible_peaks,
    normalized_ecg[visible_peaks],
    "ro"
)

plt.title("R Peak Detection")
plt.xlabel("Samples")
plt.ylabel("Amplitude")

plt.grid()

plt.savefig("plots/r_peaks.png")

plt.show()

# =========================================================
# STEP 10 — Q, S, P, T DETECTION
# =========================================================

# Physiologically correct search windows (in ms → samples at fs Hz)
# Q wave  : 5–50 ms before R        (sits just left of R peak)
# S wave  : 5–80 ms after R         (sits just right of R peak)
# P wave  : 80–220 ms before R      (small bump before QRS)
# T wave  : 100–400 ms after R      (broad bump after QRS)

Q_START_MS  = 50  ;  Q_END_MS  = 5
S_START_MS  = 5   ;  S_END_MS  = 80
P_START_MS  = 220 ;  P_END_MS  = 80
T_START_MS  = 100 ;  T_END_MS  = 400

def ms(milliseconds):
    return max(1, int(milliseconds * fs / 1000))

q_peaks = []
s_peaks = []
p_peaks = []
t_peaks = []

for r in r_peaks:

    # --- Q wave: minimum just before R ---
    q_start = max(0, r - ms(Q_START_MS))
    q_end   = max(0, r - ms(Q_END_MS))
    if q_end > q_start:
        q = np.argmin(normalized_ecg[q_start:q_end]) + q_start
        q_peaks.append(q)

    # --- S wave: minimum just after R ---
    s_start = min(len(normalized_ecg), r + ms(S_START_MS))
    s_end   = min(len(normalized_ecg), r + ms(S_END_MS))
    if s_end > s_start:
        s = np.argmin(normalized_ecg[s_start:s_end]) + s_start
        s_peaks.append(s)

    # --- P wave: largest peak in pre-QRS window ---
    p_start = max(0, r - ms(P_START_MS))
    p_end   = max(0, r - ms(P_END_MS))
    if p_end > p_start:
        p = np.argmax(normalized_ecg[p_start:p_end]) + p_start
        p_peaks.append(p)

    # --- T wave: largest peak in post-QRS window ---
    t_start = min(len(normalized_ecg), r + ms(T_START_MS))
    t_end   = min(len(normalized_ecg), r + ms(T_END_MS))
    if t_end > t_start:
        t = np.argmax(normalized_ecg[t_start:t_end]) + t_start
        t_peaks.append(t)

# =========================================================
# STEP 11 — VISUALIZE PQRST WAVES (with proper labels)
# =========================================================

START = 1000
END   = 3000

def get_visible(peaks, start, end):
    arr = np.array(peaks)
    return arr[(arr >= start) & (arr < end)]

visible_r = get_visible(r_peaks, START, END)
visible_q = get_visible(q_peaks, START, END)
visible_s = get_visible(s_peaks, START, END)
visible_p = get_visible(p_peaks, START, END)
visible_t = get_visible(t_peaks, START, END)

plt.figure(figsize=(15, 6))

plt.plot(
    range(START, END),
    normalized_ecg[START:END],
    color='black',
    linewidth=0.8,
    label='ECG'
)

# Wave markers + text annotations on the graph
wave_config = [
    (visible_p, 'P', 'blue',   '^',  0.08),
    (visible_q, 'Q', 'green',  'v', -0.09),
    (visible_r, 'R', 'red',    '^',  0.08),
    (visible_s, 'S', 'purple', 'v', -0.09),
    (visible_t, 'T', 'orange', '^',  0.08),
]

for peaks, label, color, marker, offset in wave_config:

    if len(peaks) == 0:
        continue

    yvals = normalized_ecg[peaks]

    plt.scatter(
        peaks, yvals,
        color=color, s=60, marker=marker,
        zorder=5, label=f'{label} Wave'
    )

    # Annotate every other beat to avoid clutter
    for i, (px, py) in enumerate(zip(peaks, yvals)):
        if i % 2 == 0:
            plt.annotate(
                label,
                xy=(px, py),
                xytext=(px, py + offset),
                ha='center',
                fontsize=9,
                fontweight='bold',
                color=color,
                arrowprops=dict(arrowstyle='-', color=color, lw=0.8)
            )

plt.title("PQRST Wave Detection")
plt.xlabel("Samples")
plt.ylabel("Normalized Amplitude")
plt.legend()
plt.grid(alpha=0.3)

plt.savefig("plots/pqrst_detection.png")

plt.show()

# =========================================================
# STEP 12 — SINGLE BEAT ZOOM (one clean PQRST complex)
# =========================================================

# Pick the 3rd R peak for a clean example
BEAT_IDX = 2

r_center = r_peaks[BEAT_IDX]
zoom_s   = max(0, r_center - int(0.3 * fs))
zoom_e   = min(len(normalized_ecg), r_center + int(0.4 * fs))

plt.figure(figsize=(10, 5))

plt.plot(
    range(zoom_s, zoom_e),
    normalized_ecg[zoom_s:zoom_e],
    color='black',
    linewidth=1.5
)

# Label each wave for this beat
single_waves = {
    'P': (p_peaks[BEAT_IDX] if BEAT_IDX < len(p_peaks) else None, 'blue'),
    'Q': (q_peaks[BEAT_IDX] if BEAT_IDX < len(q_peaks) else None, 'green'),
    'R': (r_peaks[BEAT_IDX],                                       'red'),
    'S': (s_peaks[BEAT_IDX] if BEAT_IDX < len(s_peaks) else None, 'purple'),
    'T': (t_peaks[BEAT_IDX] if BEAT_IDX < len(t_peaks) else None, 'orange'),
}

for name, (idx, color) in single_waves.items():

    if idx is None:
        continue

    yval   = normalized_ecg[idx]
    offset = 0.12 if name in ('P', 'R', 'T') else -0.12

    plt.scatter([idx], [yval], color=color, s=100, zorder=5)

    plt.annotate(
        name,
        xy=(idx, yval),
        xytext=(idx, yval + offset),
        ha='center',
        fontsize=13,
        fontweight='bold',
        color=color,
        arrowprops=dict(arrowstyle='->', color=color, lw=1.2)
    )

plt.title("Single Beat — PQRST Complex")
plt.xlabel("Samples")
plt.ylabel("Normalized Amplitude")
plt.grid(alpha=0.3)

plt.savefig("plots/single_beat_pqrst.png")

plt.show()

# =========================================================
# STEP 13 — HEARTBEAT SEGMENTATION
# =========================================================

WINDOW_BEFORE = 128
WINDOW_AFTER  = 128
WINDOW_SIZE   = WINDOW_BEFORE + WINDOW_AFTER   # FIX: was undefined before

X = []
y = []

valid_labels = ['N', 'V', 'A', 'L', 'R']

for i in range(len(annotation.sample)):

    r_peak = annotation.sample[i]
    label = annotation.symbol[i]

    if label not in valid_labels:
        continue

    start = r_peak - WINDOW_BEFORE
    end = r_peak + WINDOW_AFTER

    if start < 0 or end > len(normalized_ecg):
        continue

    beat = normalized_ecg[start:end]

    X.append(beat)
    y.append(label)

X = np.array(X)
y = np.array(y)

print("Dataset Shape:", X.shape)
print("Labels Shape:", y.shape)

# =========================================================
# STEP 14 — SAVE DATASET
# =========================================================

np.save("outputs/X.npy", X)
np.save("outputs/y.npy", y)

print("Dataset Saved!")

# =========================================================
# STEP 15 — ECG SEGMENTATION
# =========================================================

segments = []

for i in range(0, len(normalized_ecg) - WINDOW_SIZE, WINDOW_SIZE):

    segment = normalized_ecg[i:i+WINDOW_SIZE]

    segments.append(segment)

segments = np.array(segments)

print("Segments Shape:", segments.shape)

# =========================================================
# STEP 16 — SAVE SEGMENTS
# =========================================================

np.save("outputs/ecg_segments.npy", segments)

print("ECG Segments Saved!")

# =========================================================
# STEP 17 — COMPARISON PLOT
# =========================================================

plt.figure(figsize=(15,10))

plt.subplot(4,1,1)
plt.plot(signal[1000:3000])
plt.title("Raw ECG")

plt.subplot(4,1,2)
plt.plot(bandpass_ecg[1000:3000])
plt.title("Bandpass Filtered ECG")

plt.subplot(4,1,3)
plt.plot(notch_ecg[1000:3000])
plt.title("Notch Filtered ECG")

plt.subplot(4,1,4)
plt.plot(wavelet_ecg[1000:3000])
plt.title("Wavelet Denoised ECG")

plt.tight_layout()

plt.savefig("plots/comparison_ecg.png")

plt.show()

# =========================================================
# FINAL MESSAGE
# =========================================================

print("\n====================================")
print("ECG PREPROCESSING COMPLETE")
print("====================================")
print("Generated Files:")
print("1.  raw_ecg.png")
print("2.  fft_ecg.png")
print("3.  bandpass_ecg.png")
print("4.  notch_ecg.png")
print("5.  wavelet_ecg.png")
print("6.  normalized_ecg.png")
print("7.  r_peaks.png")
print("8.  pqrst_detection.png")
print("9.  single_beat_pqrst.png")
print("10. comparison_ecg.png")
print("====================================")
print("Saved Arrays:")
print("1. outputs/X.npy")
print("2. outputs/y.npy")
print("3. outputs/ecg_segments.npy")
print("====================================")