import os
import json
import ast
import zipfile
import h5py
import numpy as np
import pandas as pd
import wfdb
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.signal import resample, butter, filtfilt, iirnotch, find_peaks
import pywt
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

print("="*80)
print("PTB-XL ECG Dataset Model Evaluation Pipeline (Test Split)")
print("="*80 + "\n")

# Path Configuration
METADATA_DIR = 'ptb_xl_temp'
RECORDS_DIR = os.path.join(METADATA_DIR, 'records100')
OUTPUTS_DIR = 'outputs'
PLOTS_DIR = 'plots'
MODELS_DIR = 'models'

os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(PLOTS_DIR, exist_ok=True)

# 1. Load Model Programmatically
def load_model():
    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import Conv1D, BatchNormalization, MaxPooling1D, Dropout, LSTM, Dense, Input
    except ImportError:
        print("[ERROR] TensorFlow not installed!")
        return None

    num_classes = 5
    
    print("[INFO] Rebuilding sequential CNN-LSTM model...")
    model = Sequential([
        Input(shape=(256, 1)),
        Conv1D(64, kernel_size=5, activation='relu', padding='same', name='conv1d'),
        BatchNormalization(name='batch_normalization'),
        MaxPooling1D(pool_size=2, name='max_pooling1d'),
        Dropout(0.2, name='dropout'),
        Conv1D(128, kernel_size=5, activation='relu', padding='same', name='conv1d_1'),
        BatchNormalization(name='batch_normalization_1'),
        MaxPooling1D(pool_size=2, name='max_pooling1d_1'),
        Dropout(0.2, name='dropout_1'),
        Conv1D(256, kernel_size=3, activation='relu', padding='same', name='conv1d_2'),
        BatchNormalization(name='batch_normalization_2'),
        MaxPooling1D(pool_size=2, name='max_pooling1d_2'),
        Dropout(0.2, name='dropout_2'),
        LSTM(128, return_sequences=False, name='lstm'),
        Dropout(0.3, name='dropout_3'),
        Dense(64, activation='relu', name='dense'),
        Dropout(0.3, name='dropout_4'),
        Dense(num_classes, activation='softmax', name='dense_1')
    ])
    
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    
    # Load weights
    model_keras_path = os.path.join(MODELS_DIR, 'ecg_cnn_lstm.keras')
    if not os.path.exists(model_keras_path):
        model_keras_path = os.path.join(MODELS_DIR, 'best_model.keras')
        
    if os.path.exists(model_keras_path):
        print(f"[INFO] Extracting weights from {model_keras_path}...")
        temp_weights = os.path.join(MODELS_DIR, 'temp_eval_weights.h5')
        if os.path.exists(temp_weights):
            os.remove(temp_weights)
            
        with zipfile.ZipFile(model_keras_path, 'r') as z:
            z.extract('model.weights.h5', MODELS_DIR)
            os.rename(os.path.join(MODELS_DIR, 'model.weights.h5'), temp_weights)
            
        f = h5py.File(temp_weights, 'r')
        def set_layer_weights(layer_name, weight_dataset_names):
            layer = model.get_layer(layer_name)
            w_list = []
            for dname in weight_dataset_names:
                dataset_path = f"layers/{layer_name}/vars/{dname}"
                if layer_name == 'lstm':
                    dataset_path = f"layers/lstm/cell/vars/{dname}"
                w_list.append(np.array(f[dataset_path]))
            layer.set_weights(w_list)
            
        set_layer_weights('conv1d', ['0', '1'])
        set_layer_weights('batch_normalization', ['0', '1', '2', '3'])
        set_layer_weights('conv1d_1', ['0', '1'])
        set_layer_weights('batch_normalization_1', ['0', '1', '2', '3'])
        set_layer_weights('conv1d_2', ['0', '1'])
        set_layer_weights('batch_normalization_2', ['0', '1', '2', '3'])
        set_layer_weights('lstm', ['0', '1', '2'])
        set_layer_weights('dense', ['0', '1'])
        set_layer_weights('dense_1', ['0', '1'])
        
        f.close()
        if os.path.exists(temp_weights):
            os.remove(temp_weights)
            
        print("[SUCCESS] Loaded model weights successfully.")
        return model
    else:
        print("[ERROR] Model weights file not found!")
        return None

# Preprocessing Helpers (matching main.py)
def bandpass_filter(sig, lowcut=0.5, highcut=40, fs=360, order=4):
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(order, [low, high], btype='band')
    return filtfilt(b, a, sig)

def notch_filter(sig, freq=50, fs=360, Q=30):
    b, a = iirnotch(freq, Q, fs)
    return filtfilt(b, a, sig)

def wavelet_denoise(sig, wavelet='db4', level=4):
    coeffs = pywt.wavedec(sig, wavelet, level=level)
    sigma = np.median(np.abs(coeffs[-1])) / 0.6745
    threshold = sigma * np.sqrt(2 * len(sig))
    denoised_coeffs = [pywt.threshold(c, threshold, mode='soft') for c in coeffs]
    return pywt.waverec(denoised_coeffs, wavelet)

def preprocess_signal(lead_ii_signal, fs_original):
    num_samples_360 = int(len(lead_ii_signal) * 360 / fs_original)
    sig_resampled = resample(lead_ii_signal, num_samples_360)
    bp = bandpass_filter(sig_resampled, fs=360)
    notch = notch_filter(bp, fs=360)
    wt = wavelet_denoise(notch)[:len(notch)]
    norm = MinMaxScaler().fit_transform(wt.reshape(-1, 1)).flatten()
    return norm

def run_evaluation():
    csv_path = os.path.join(METADATA_DIR, 'ptbxl_database.csv')
    if not os.path.exists(csv_path):
        print(f"[ERROR] PTB-XL database CSV not found at {csv_path}!")
        return
        
    df = pd.read_csv(csv_path)
    
    def parse_scp(val):
        try:
            return ast.literal_eval(val)
        except:
            return {}
            
    df['scp_dict'] = df['scp_codes'].apply(parse_scp)
    
    targets = {
        'N': 'NORM',
        'L': 'CLBBB',
        'R': 'CRBBB',
        'V': 'PVC',
        'A': 'PAC'
    }
    
    selected_records = []
    
    # 1. Select the same 100/37 records per class
    for label, code in targets.items():
        matching = df[df['scp_dict'].apply(lambda d: d.get(code, 0.0) == 100.0)]
        limit = 30
        sampled = matching.head(limit).copy()
        sampled['ground_truth'] = label
        selected_records.append(sampled)
        
    eval_df = pd.concat(selected_records).reset_index(drop=True)
    
    # 2. Extract beats
    X_list = []
    y_list = []
    
    for idx, row in eval_df.iterrows():
        local_path = os.path.join(METADATA_DIR, row['filename_lr'])
        if not os.path.exists(f"{local_path}.dat"):
            continue
            
        record = wfdb.rdrecord(local_path)
        lead_ii = record.p_signal[:, 1]
        
        norm_sig = preprocess_signal(lead_ii, record.fs)
        
        # Locate R-peaks
        height_thresh = max(0.4, 0.5 * np.max(norm_sig))
        r_peaks, _ = find_peaks(norm_sig, distance=150, height=height_thresh)
        if len(r_peaks) == 0:
            r_peaks, _ = find_peaks(norm_sig, distance=150, height=0.25)
            
        for r_peak in r_peaks:
            start = r_peak - 128
            end = r_peak + 128
            if start >= 0 and end <= len(norm_sig):
                beat = norm_sig[start:end]
                beat = beat.astype('float32') / np.max(np.abs(beat))
                X_list.append(beat)
                y_list.append(row['ground_truth'])
                
    X_all = np.array(X_list)[..., np.newaxis]
    y_all = np.array(y_list)
    
    # Encode classes
    class_map = {'A': 0, 'L': 1, 'N': 2, 'R': 3, 'V': 4}
    y_encoded = np.array([class_map[lbl] for lbl in y_all])
    
    import tensorflow as tf
    y_categorical = tf.keras.utils.to_categorical(y_encoded, num_classes=5)
    
    # 3. Stratified Split (80% Train, 20% Test)
    # We evaluate only on the test split
    _, X_test, _, y_test = train_test_split(
        X_all, y_categorical,
        test_size=0.20,
        random_state=42,
        stratify=y_encoded
    )
    
    # Load ML Model
    model = load_model()
    if model is None:
        print("[ERROR] Cannot load fine-tuned model!")
        return

    # 4. Evaluate on the Test Split
    print("\n[INFO] Evaluating model on PTB-XL unseen test beats...")
    test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
    print(f"[RESULT] Test Accuracy: {test_acc*100:.2f}%")
    
    y_pred_probs = model.predict(X_test, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)
    y_true_indices = np.argmax(y_test, axis=1)
    
    classes_labels = ['A', 'L', 'N', 'R', 'V']
    class_names = ['PAC (Atrial)', 'LBBB', 'Normal', 'RBBB', 'PVC (Ventricular)']
    
    cm = confusion_matrix(y_true_indices, y_pred, labels=[0, 1, 2, 3, 4])
    report = classification_report(y_true_indices, y_pred, labels=[0, 1, 2, 3, 4], target_names=class_names, output_dict=True)
    
    # Plot and save confusion matrix
    plt.figure(figsize=(7, 5.5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=classes_labels, yticklabels=classes_labels)
    plt.title(f'PTB-XL Test Split Confusion Matrix (Accuracy: {test_acc*100:.2f}%)')
    plt.ylabel('True Class')
    plt.xlabel('Predicted Class')
    
    cm_path = os.path.join(OUTPUTS_DIR, 'ptbxl_confusion_matrix.png')
    plt.savefig(cm_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    # Save to plots directory too
    plt.figure(figsize=(7, 5.5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=classes_labels, yticklabels=classes_labels)
    plt.title(f'PTB-XL Test Split Confusion Matrix (Accuracy: {test_acc*100:.2f}%)')
    plt.ylabel('True Class')
    plt.xlabel('Predicted Class')
    plt.savefig(os.path.join(PLOTS_DIR, 'ptbxl_confusion_matrix.png'), dpi=300, bbox_inches='tight')
    plt.close()
    
    # Format and save metrics to JSON
    metrics = {
        'overallAccuracy': float(test_acc),
        'totalTestRecords': len(y_test),
        'perClassMetrics': {},
        'confusionMatrix': cm.tolist()
    }
    
    for idx, c in enumerate(classes_labels):
        name = class_names[idx]
        metrics['perClassMetrics'][c] = {
            'className': name,
            'precision': float(report[name]['precision']),
            'recall': float(report[name]['recall']),
            'f1Score': float(report[name]['f1-score']),
            'support': int(report[name]['support'])
        }
        
    metrics_path = os.path.join(OUTPUTS_DIR, 'ptbxl_metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)
        
    print(f"[SUCCESS] Metrics and plots updated at {metrics_path}.")
    print("\n" + "="*80 + "\n")

if __name__ == '__main__':
    run_evaluation()
