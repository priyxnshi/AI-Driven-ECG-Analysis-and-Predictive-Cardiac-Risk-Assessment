import pandas as pd
import neurokit2 as nk
import matplotlib.pyplot as plt

# Load ECG CSV
ecg = pd.read_csv("waveform_metrics/100.csv")

# Print column names
print(ecg.columns)

# Extract ECG signal
signal = ecg["'MLII'"]

# Process ECG
signals, info = nk.ecg_process(signal, sampling_rate=360)

# Calculate heart rate
heart_rate = signals["ECG_Rate"].mean()

# Print result
print("Heart Rate:", heart_rate)

# Plot ECG
nk.ecg_plot(signals)

plt.show()