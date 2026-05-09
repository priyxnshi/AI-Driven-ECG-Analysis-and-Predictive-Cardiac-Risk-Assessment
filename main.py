import wfdb
import numpy as np
import matplotlib.pyplot as plt

from scipy.fft import fft, fftfreq
from scipy.signal import butter, filtfilt, iirnotch

import pywt
from sklearn.preprocessing import MinMaxScaler

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

    threshold = np.sqrt(2 * np.log(len(signal)))

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
# STEP 9 — ECG SEGMENTATION
# =========================================================

WINDOW_SIZE = 256

segments = []

for i in range(0, len(normalized_ecg) - WINDOW_SIZE, WINDOW_SIZE):

    segment = normalized_ecg[i:i+WINDOW_SIZE]

    segments.append(segment)

segments = np.array(segments)

print("Segments Shape:", segments.shape)

# =========================================================
# STEP 10 — SAVE SEGMENTS
# =========================================================

np.save("outputs/ecg_segments.npy", segments)

print("ECG Segments Saved!")

# =========================================================
# STEP 11 — COMPARISON PLOT
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
print("1. raw_ecg.png")
print("2. fft_ecg.png")
print("3. bandpass_ecg.png")
print("4. notch_ecg.png")
print("5. wavelet_ecg.png")
print("6. normalized_ecg.png")
print("7. comparison_ecg.png")
print("8. ecg_segments.npy")
print("====================================")