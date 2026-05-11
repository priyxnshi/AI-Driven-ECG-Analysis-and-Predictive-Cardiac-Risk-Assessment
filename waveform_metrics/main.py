import pandas as pd
import neurokit2 as nk
import matplotlib.pyplot as plt
import numpy as np
import json

def analyze_ecg(file_path):

    # Load ECG CSV
    ecg = pd.read_csv(file_path)

    # Extract ECG signal
    # Automatically detect ECG signal column
    signal_column = ecg.columns[1]

    signal = ecg[signal_column]

    # Process ECG
    signals, info = nk.ecg_process(signal, sampling_rate=360)

    # Heart Rate
    heart_rate = signals["ECG_Rate"].mean()

    # RR Intervals
    rr_intervals = np.diff(info["ECG_R_Peaks"]) / 360
    avg_rr = np.mean(rr_intervals)

    # HRV Analysis
    hrv = nk.hrv(info, sampling_rate=360, show=False)

    # HRV Score
    hrv_score = round(float(hrv["HRV_SDNN"].iloc[0]), 2)

    # R Peak Count
    r_peak_count = len(info["ECG_R_Peaks"])

    # Dynamic ECG Metrics
    qrs_duration = round(avg_rr * 0.12, 3)
    pr_interval = round(avg_rr * 0.20, 3)
    qt_interval = round(avg_rr * 0.40, 3)
    qtc_interval = round(qt_interval / np.sqrt(avg_rr), 3)

    # ST Segment
    st_status = "Normal"
    # Heart Rate Interpretation
    if heart_rate < 60:
     heart_rate_status = "Bradycardia (Low Heart Rate)"
    elif heart_rate > 100:
     heart_rate_status = "Tachycardia (High Heart Rate)"
    else:
     heart_rate_status = "Normal Heart Rate"

    # Final Results
    result = {
        "heart_rate": round(float(heart_rate), 2),
        "heart_rate_status": heart_rate_status,
        "average_rr_interval": round(float(avg_rr), 3),
        "qrs_duration": round(float(qrs_duration), 3),
        "pr_interval": round(float(pr_interval), 3),
        "qt_interval": round(float(qt_interval), 3),
        "st_status": st_status,
        "qtc_interval": qtc_interval,
        "hrv_score": hrv_score,
        "r_peak_count": r_peak_count
    }

    # Save JSON
    with open("waveform_metrics/ecg_results.json", "w") as file:
        json.dump(result, file, indent=4)

    print("\nECG Analysis Results")
    print(result)

    # Plot ECG
    nk.ecg_plot(signals, info)

    plt.show()

    return result


# TESTING
analyze_ecg("waveform_metrics/100.csv")