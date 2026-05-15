"""
ECG Model Training Script
Trains a CNN-LSTM model for cardiac arrhythmia classification
"""

import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Import TensorFlow (will error if not installed yet)
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import (
        Conv1D, BatchNormalization, MaxPooling1D, Dropout,
        LSTM, Dense, Input
    )
    from tensorflow.keras.callbacks import (
        EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
    )
    from tensorflow.keras.utils import to_categorical
except ImportError as e:
    print("❌ TensorFlow not installed yet!")
    print("   TensorFlow is still downloading (~600MB)")
    print("   Please wait for pip installation to complete")
    print(f"   Error: {e}")
    exit(1)

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, confusion_matrix

print("\n" + "="*70)
print("🧠 ECG Model Training Pipeline")
print("="*70 + "\n")

# Create directories
os.makedirs("plots", exist_ok=True)
os.makedirs("outputs", exist_ok=True)
os.makedirs("models", exist_ok=True)

# =========================================================
# STEP 1 — LOAD DATASET
# =========================================================
print("📦 STEP 1: Loading Dataset...")
print("-" * 70)

try:
    X = np.load("outputs/X.npy")   # Shape: (beats, 256)
    y = np.load("outputs/y.npy")   # Shape: (beats,)  labels: N V A L R
    print(f"✅ Data loaded successfully!")
    print(f"   X shape: {X.shape} (beats, samples)")
    print(f"   y shape: {y.shape} (beats,)")
except FileNotFoundError:
    print("❌ Training data not found!")
    print("   Please run: python main.py")
    print("   to extract ECG features first")
    exit(1)

# Label distribution
unique, counts = np.unique(y, return_counts=True)
print(f"\n📊 Label Distribution:")
label_names = {'N': 'Normal', 'V': 'Ventricular', 'A': 'Atrial', 'L': 'LBBB', 'R': 'RBBB'}
for lbl, cnt in zip(unique, counts):
    print(f"   {lbl} ({label_names.get(lbl, '?'):<14}): {cnt:6d} samples")

# =========================================================
# STEP 2 — ENCODE LABELS
# =========================================================
print(f"\n🔤 STEP 2: Encoding Labels...")
print("-" * 70)

# Drop classes with fewer than 2 samples
MIN_SAMPLES = 2
unique_labels, label_counts = np.unique(y, return_counts=True)
valid_classes = unique_labels[label_counts >= MIN_SAMPLES]

mask = np.isin(y, valid_classes)
X = X[mask]
y = y[mask]

print(f"✅ Filtered to {len(valid_classes)} classes")
print(f"   Total beats: {len(y)}")

# Encode labels
le = LabelEncoder()
y_encoded = le.fit_transform(y)
y_categorical = to_categorical(y_encoded, num_classes=len(le.classes_))

print(f"   Classes: {list(le.classes_)}")

# =========================================================
# STEP 3 — SPLIT DATA
# =========================================================
print(f"\n✂️  STEP 3: Splitting Data...")
print("-" * 70)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_categorical,
    test_size=0.2,
    random_state=42,
    stratify=y_encoded
)

print(f"✅ Data split completed")
print(f"   Training: {X_train.shape[0]} samples")
print(f"   Testing:  {X_test.shape[0]} samples")

# Normalize
X_train = X_train.astype('float32') / np.max(np.abs(X_train))
X_test = X_test.astype('float32') / np.max(np.abs(X_test))

# Reshape for LSTM
X_train = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
X_test = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)

print(f"   X_train shape: {X_train.shape}")
print(f"   X_test shape:  {X_test.shape}")

# =========================================================
# STEP 4 — COMPUTE CLASS WEIGHTS
# =========================================================
print(f"\n⚖️  STEP 4: Computing Class Weights...")
print("-" * 70)

class_weights = compute_class_weight(
    'balanced',
    classes=np.unique(y_encoded),
    y=y_encoded
)
class_weights_dict = dict(enumerate(class_weights))
print(f"✅ Class weights computed")
for cls, weight in class_weights_dict.items():
    print(f"   Class {le.classes_[cls]}: {weight:.4f}")

# =========================================================
# STEP 5 — BUILD MODEL
# =========================================================
print(f"\n🏗️  STEP 5: Building CNN-LSTM Model...")
print("-" * 70)

model = Sequential([
    Input(shape=(256, 1)),
    
    # First Conv Block
    Conv1D(32, kernel_size=3, activation='relu', padding='same'),
    BatchNormalization(),
    MaxPooling1D(pool_size=2),
    Dropout(0.3),
    
    # Second Conv Block
    Conv1D(64, kernel_size=3, activation='relu', padding='same'),
    BatchNormalization(),
    MaxPooling1D(pool_size=2),
    Dropout(0.3),
    
    # LSTM Block
    LSTM(64, return_sequences=True),
    Dropout(0.3),
    LSTM(32),
    Dropout(0.3),
    
    # Dense Layers
    Dense(128, activation='relu'),
    Dropout(0.3),
    Dense(64, activation='relu'),
    Dropout(0.2),
    
    # Output
    Dense(len(le.classes_), activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print("✅ Model created!")
print(model.summary())

# =========================================================
# STEP 6 — TRAIN MODEL
# =========================================================
print(f"\n🚂 STEP 6: Training Model...")
print("-" * 70)

callbacks = [
    EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
    ModelCheckpoint('models/best_model.keras', monitor='val_accuracy', save_best_only=True),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-6)
]

history = model.fit(
    X_train, y_train,
    batch_size=32,
    epochs=50,
    validation_split=0.2,
    class_weight=class_weights_dict,
    callbacks=callbacks,
    verbose=1
)

print("✅ Training completed!")

# =========================================================
# STEP 7 — EVALUATE MODEL
# =========================================================
print(f"\n📊 STEP 7: Evaluating Model...")
print("-" * 70)

# Evaluate on test set
test_loss, test_accuracy = model.evaluate(X_test, y_test, verbose=0)
print(f"✅ Test Accuracy: {test_accuracy*100:.2f}%")
print(f"   Test Loss:     {test_loss:.4f}")

# Predictions
y_pred_probs = model.predict(X_test)
y_pred = np.argmax(y_pred_probs, axis=1)
y_test_labels = np.argmax(y_test, axis=1)

# Classification report
print(f"\n📋 Classification Report:")
print(classification_report(
    y_test_labels, y_pred,
    target_names=le.classes_
))

# =========================================================
# STEP 8 — SAVE RESULTS
# =========================================================
print(f"\n💾 STEP 8: Saving Results...")
print("-" * 70)

# Save label classes
np.save('models/label_classes.npy', le.classes_)
print(f"✅ Label classes saved")

# Save model architecture
model_json = model.to_json()
with open('models/model_architecture.json', 'w') as f:
    f.write(model_json)
print(f"✅ Model saved to: models/best_model.keras")

# =========================================================
# STEP 9 — GENERATE PLOTS
# =========================================================
print(f"\n📈 STEP 9: Generating Plots...")
print("-" * 70)

fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Training history
axes[0, 0].plot(history.history['accuracy'], label='Train Accuracy')
axes[0, 0].plot(history.history['val_accuracy'], label='Val Accuracy')
axes[0, 0].set_title('Model Accuracy')
axes[0, 0].set_xlabel('Epoch')
axes[0, 0].set_ylabel('Accuracy')
axes[0, 0].legend()
axes[0, 0].grid(True)

axes[0, 1].plot(history.history['loss'], label='Train Loss')
axes[0, 1].plot(history.history['val_loss'], label='Val Loss')
axes[0, 1].set_title('Model Loss')
axes[0, 1].set_xlabel('Epoch')
axes[0, 1].set_ylabel('Loss')
axes[0, 1].legend()
axes[0, 1].grid(True)

# Confusion Matrix
cm = confusion_matrix(y_test_labels, y_pred)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=le.classes_, yticklabels=le.classes_,
            ax=axes[1, 0])
axes[1, 0].set_title('Confusion Matrix')
axes[1, 0].set_ylabel('True Label')
axes[1, 0].set_xlabel('Predicted Label')

# Class distribution
axes[1, 1].bar(le.classes_, [np.sum(y_encoded == i) for i in range(len(le.classes_))])
axes[1, 1].set_title('Class Distribution')
axes[1, 1].set_xlabel('Class')
axes[1, 1].set_ylabel('Number of Samples')
axes[1, 1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('plots/training_results.png', dpi=300, bbox_inches='tight')
print(f"✅ Plot saved to: plots/training_results.png")

print("\n" + "="*70)
print("✨ TRAINING COMPLETE!")
print("="*70)
print(f"\n📊 Summary:")
print(f"   Model:     CNN-LSTM")
print(f"   Accuracy:  {test_accuracy*100:.2f}%")
print(f"   Classes:   {', '.join(le.classes_)}")
print(f"   Best Model: models/best_model.keras")
print(f"\n🚀 Model is ready for predictions!")
print(f"   Use API: POST http://localhost:8000/api/predict")
print("\n" + "="*70 + "\n")
