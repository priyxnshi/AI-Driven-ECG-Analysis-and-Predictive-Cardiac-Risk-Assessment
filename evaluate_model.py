"""
ECG Model Evaluation Script
Loads weights manually from ecg_cnn_lstm.keras (Keras 3) into a Keras 2 model
"""

import os
import zipfile
import h5py
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# Import TensorFlow
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import (
        Conv1D, BatchNormalization, MaxPooling1D, Dropout,
        LSTM, Dense, Input
    )
except ImportError:
    print("[ERROR] TensorFlow not installed in this environment!")
    exit(1)

print("\n" + "="*70)
print("ECG Model Evaluation Pipeline (Manual Weight Mapping)")
print("="*70 + "\n")

# Path variables
model_zip_path = 'models/ecg_cnn_lstm.keras'
weights_temp_path = 'model.weights.temp.h5'
classes_path = 'models/label_classes.npy'

# Load labels
if os.path.exists(classes_path):
    le_classes = np.load(classes_path)
    num_classes = len(le_classes)
    print(f"[INFO] Loaded classes: {le_classes}")
else:
    le_classes = np.array(['A', 'L', 'N', 'R', 'V'])
    num_classes = 5
    print(f"[WARNING] Class labels file not found, defaulting to {le_classes}")

# 1. Define model architecture programmatically based on config.json
print("[INFO] Building model architecture...")
model = Sequential([
    Input(shape=(256, 1)),
    
    # First Conv Block
    Conv1D(64, kernel_size=5, activation='relu', padding='same', name='conv1d'),
    BatchNormalization(name='batch_normalization'),
    MaxPooling1D(pool_size=2, name='max_pooling1d'),
    Dropout(0.2, name='dropout'),
    
    # Second Conv Block
    Conv1D(128, kernel_size=5, activation='relu', padding='same', name='conv1d_1'),
    BatchNormalization(name='batch_normalization_1'),
    MaxPooling1D(pool_size=2, name='max_pooling1d_1'),
    Dropout(0.2, name='dropout_1'),
    
    # Third Conv Block
    Conv1D(256, kernel_size=3, activation='relu', padding='same', name='conv1d_2'),
    BatchNormalization(name='batch_normalization_2'),
    MaxPooling1D(pool_size=2, name='max_pooling1d_2'),
    Dropout(0.2, name='dropout_2'),
    
    # LSTM Block
    LSTM(128, return_sequences=False, name='lstm'),
    Dropout(0.3, name='dropout_3'),
    
    # Dense Layers
    Dense(64, activation='relu', name='dense'),
    Dropout(0.3, name='dropout_4'),
    
    # Output
    Dense(num_classes, activation='softmax', name='dense_1')
])

model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# 2. Extract and Map weights manually from the ZIP's model.weights.h5 file
if os.path.exists(model_zip_path):
    try:
        print(f"[INFO] Extracting weights file from {model_zip_path}...")
        with zipfile.ZipFile(model_zip_path, 'r') as z:
            z.extract('model.weights.h5', '.')
            if os.path.exists(weights_temp_path):
                os.remove(weights_temp_path)
            os.rename('model.weights.h5', weights_temp_path)
            
        print("[INFO] Mapping weights to layers...")
        f = h5py.File(weights_temp_path, 'r')
        
        # Helper to set layer weights
        def set_layer_weights(layer_name, weight_dataset_names):
            layer = model.get_layer(layer_name)
            weights_list = []
            for dname in weight_dataset_names:
                dataset_path = f"layers/{layer_name}/vars/{dname}"
                if layer_name == 'lstm':
                    dataset_path = f"layers/lstm/cell/vars/{dname}"
                weights_list.append(np.array(f[dataset_path]))
            layer.set_weights(weights_list)
            print(f"   Mapped weights for layer: {layer_name}")

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
        print("[SUCCESS] Weights mapped successfully!")
    except Exception as e:
        print(f"[ERROR] Failed to map weights: {e}")
        if os.path.exists(weights_temp_path):
            os.remove(weights_temp_path)
        exit(1)
    finally:
        if os.path.exists(weights_temp_path):
            os.remove(weights_temp_path)
else:
    print(f"[ERROR] Model file not found at {model_zip_path}")
    exit(1)

# 3. Load dataset
try:
    print("[INFO] Loading dataset files...")
    X = np.load("outputs/X.npy")
    y = np.load("outputs/y.npy")
    print(f"[SUCCESS] Data loaded. X shape: {X.shape}, y shape: {y.shape}")
except FileNotFoundError:
    print("[ERROR] Dataset files outputs/X.npy or outputs/y.npy not found!")
    exit(1)

# 4. Preprocess and Split
print("[INFO] Splitting data to test set...")
# Encode labels
le = LabelEncoder()
le.fit(y)
y_encoded = le.transform(y)
y_categorical = tf.keras.utils.to_categorical(y_encoded, num_classes=num_classes)

# Replicate split used in train.py (70/30 split, with test being half of the 30% split = 15%)
X_train, X_temp, y_train, y_temp = train_test_split(
    X, y_categorical,
    test_size=0.30,
    random_state=42,
    stratify=y_encoded
)
y_encoded_temp = np.argmax(y_temp, axis=1)

# Correctly split indices matching train.py logic
indices = np.arange(len(X_temp))
_, test_idx = train_test_split(
    indices,
    test_size=0.50,
    random_state=42,
    stratify=y_encoded_temp
)

X_test_data = X_temp[test_idx]
y_test_data = y_temp[test_idx]

# Normalize test data
X_test_data = X_test_data.astype('float32') / np.max(np.abs(X_test_data))

# Reshape for input format (Conv1D/LSTM)
if len(model.input_shape) == 3:
    X_test_data = X_test_data[..., np.newaxis]

print(f"[SUCCESS] Test set size: {X_test_data.shape[0]} samples")

# 5. Evaluate
print("\n[INFO] Running Evaluation...")
test_loss, test_accuracy = model.evaluate(X_test_data, y_test_data, verbose=0)
print(f"[RESULT] Test Accuracy : {test_accuracy*100:.2f}%")
print(f"[RESULT] Test Loss     : {test_loss:.4f}")

# 6. Generate predictions
y_pred_probs = model.predict(X_test_data, verbose=0)
y_pred = np.argmax(y_pred_probs, axis=1)
y_test_labels = np.argmax(y_test_data, axis=1)

# Class mappings
label_names = {'N': 'Normal', 'V': 'Ventricular (PVC)', 'A': 'Atrial (PAC)', 'L': 'LBBB', 'R': 'RBBB'}
target_names = [f"{lbl} ({label_names.get(lbl, lbl)})" for lbl in le.classes_]

print(f"\n[REPORT] Classification Report:")
print(classification_report(
    y_test_labels, y_pred,
    target_names=target_names
))

# Save confusion matrix plot
os.makedirs("plots", exist_ok=True)
cm = confusion_matrix(y_test_labels, y_pred)
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=le.classes_, yticklabels=le.classes_)
plt.title(f'Confusion Matrix (Accuracy: {test_accuracy*100:.2f}%)')
plt.ylabel('True Class')
plt.xlabel('Predicted Class')
plot_path = 'plots/evaluation_confusion_matrix.png'
plt.savefig(plot_path, dpi=300, bbox_inches='tight')
print(f"[INFO] Confusion matrix plot saved to: {plot_path}")
print("\n" + "="*70 + "\n")
