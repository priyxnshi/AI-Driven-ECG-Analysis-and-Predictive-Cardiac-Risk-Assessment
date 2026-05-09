# read_dataset.py

import wfdb
import matplotlib.pyplot as plt
import numpy as np

# =========================================================
# RECORD PATH
# =========================================================
# Files are inside dataset folder:
# dataset/100.dat
# dataset/100.hea
# dataset/100.atr

record_name = 'dataset/100'

# =========================================================
# READ ECG RECORD
# =========================================================
record = wfdb.rdrecord(record_name)

# =========================================================
# READ ANNOTATIONS
# =========================================================
annotation = wfdb.rdann(record_name, 'atr')

# =========================================================
# BASIC RECORD INFORMATION
# =========================================================
print("\n================ ECG RECORD INFO ================\n")

print("Record Name:", record.record_name)
print("Number of Signals:", record.n_sig)
print("Sampling Frequency:", record.fs)
print("Signal Length:", record.sig_len)
print("Signal Shape:", record.p_signal.shape)

print("\nSignal Names:")
print(record.sig_name)

print("\nUnits:")
print(record.units)

# =========================================================
# ECG SIGNAL DATA
# =========================================================
signal = record.p_signal

# First ECG channel (MLII)
ecg_signal = signal[:, 0]

print("\n================ ECG SIGNAL ====================\n")

print("First 10 ECG Values:\n")
print(ecg_signal[:10])

print("\nMinimum Value:", np.min(ecg_signal))
print("Maximum Value:", np.max(ecg_signal))
print("Mean Value:", np.mean(ecg_signal))

# =========================================================
# ANNOTATION DETAILS
# =========================================================
print("\n================ ANNOTATIONS ===================\n")

print("Total Annotations:", len(annotation.sample))

print("\nFirst 20 Annotation Samples:")
print(annotation.sample[:20])

print("\nFirst 20 Annotation Symbols:")
print(annotation.symbol[:20])

# =========================================================
# DISPLAY HEARTBEAT TYPES
# =========================================================
unique_symbols = set(annotation.symbol)

print("\nUnique Heartbeat Symbols:")
print(unique_symbols)

heartbeat_types = {
    'N': 'Normal Beat',
    'L': 'Left Bundle Branch Block Beat',
    'R': 'Right Bundle Branch Block Beat',
    'A': 'Atrial Premature Beat',
    'V': 'Premature Ventricular Contraction',
    '/': 'Paced Beat'
}

print("\nHeartbeat Symbol Meanings:\n")

for symbol in unique_symbols:
    meaning = heartbeat_types.get(symbol, "Unknown Type")
    print(f"{symbol} --> {meaning}")

# =========================================================
# PLOT ECG SIGNAL
# =========================================================
print("\nPlotting ECG Signal...\n")

samples_to_plot = 2000

plt.figure(figsize=(15, 5))

plt.plot(ecg_signal[:samples_to_plot])

plt.title("MIT-BIH ECG Signal (Record 100)")
plt.xlabel("Sample Number")
plt.ylabel("Amplitude (mV)")

plt.grid(True)

# =========================================================
# PLOT HEARTBEAT ANNOTATIONS
# =========================================================
ann_samples = annotation.sample

# Only annotations inside plotted range
ann_samples = ann_samples[ann_samples < samples_to_plot]

plt.scatter(
    ann_samples,
    ecg_signal[ann_samples],
    label='Heart Beats'
)

plt.legend()

plt.show()

# =========================================================
# WFDB DETAILED PLOT
# =========================================================
print("\nOpening WFDB detailed plot...\n")

wfdb.plot_wfdb(
    record=record,
    annotation=annotation,
    title='MIT-BIH Record 100'
)