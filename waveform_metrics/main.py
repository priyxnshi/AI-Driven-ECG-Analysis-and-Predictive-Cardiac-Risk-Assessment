import pandas as pd
import neurokit2 as nk
import matplotlib.pyplot as plt
import numpy as np

# Load ECG CSV
ecg = pd.read_csv("waveform_metrics/100.csv")

# Extract ECG signal
signal = ecg["'MLII'"]

# Process ECG
signals, info = nk.ecg_process(signal, sampling_rate=360)

# Heart Rate
heart_rate = signals["ECG_Rate"].mean()

# HRV Analysis
hrv = nk.hrv(info, sampling_rate=360, show=False)

# Approximate intervals
rr_intervals = np.diff(info["ECG_R_Peaks"]) / 360

avg_rr = np.mean(rr_intervals)

# Approximate ECG Metrics
qrs_duration = 0.09
pr_interval = 0.16
qt_interval = 0.38

# Create JSON-like result
result = {
    "heart_rate": round(float(heart_rate), 2),
    "qrs_duration": qrs_duration,
    "pr_interval": pr_interval,
    "qt_interval": qt_interval,
    "average_rr_interval": round(float(avg_rr), 3)
}

# Print results
print(result)

# Plot ECG
nk.ecg_plot(signals)

plt.show()