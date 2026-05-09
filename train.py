import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, confusion_matrix

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

os.makedirs("plots",   exist_ok=True)
os.makedirs("outputs", exist_ok=True)
os.makedirs("models",  exist_ok=True)

# =========================================================
# STEP 1 — LOAD DATASET
# =========================================================

X = np.load("outputs/X.npy")   # Shape: (beats, 256)
y = np.load("outputs/y.npy")   # Shape: (beats,)  labels: N V A L R

print("Dataset Shape :", X.shape)
print("Labels Shape  :", y.shape)

# Label distribution
unique, counts = np.unique(y, return_counts=True)
print("\nLabel Distribution:")
label_names = {'N': 'Normal', 'V': 'Ventricular', 'A': 'Atrial', 'L': 'LBBB', 'R': 'RBBB'}
for lbl, cnt in zip(unique, counts):
    print(f"  {lbl} ({label_names.get(lbl, '?'):<14}) : {cnt}")

# =========================================================
# STEP 2 — ENCODE LABELS
# =========================================================

# Drop classes that have fewer than 2 samples (can't stratify-split them)
MIN_SAMPLES = 2
unique_labels, label_counts = np.unique(y, return_counts=True)
valid_classes = unique_labels[label_counts >= MIN_SAMPLES]

mask = np.isin(y, valid_classes)
X = X[mask]
y = y[mask]

if len(unique_labels) != len(valid_classes):
    dropped = set(unique_labels) - set(valid_classes)
    print(f"\nDropped rare classes (< {MIN_SAMPLES} samples): {dropped}")

encoder = LabelEncoder()
y_encoded = encoder.fit_transform(y)          # N→int, V→int, etc.
y_cat     = to_categorical(y_encoded)         # One-hot for softmax output

num_classes = y_cat.shape[1]
print("\nClasses:", encoder.classes_)
print("Num Classes:", num_classes)

# =========================================================
# STEP 3 — TRAIN / VAL / TEST SPLIT  (70 / 15 / 15)
# =========================================================

X_train, X_temp, y_train, y_temp = train_test_split(
    X, y_cat,
    test_size=0.30,
    random_state=42,
    stratify=y_encoded
)

y_encoded_temp = np.argmax(y_temp, axis=1)

X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp,
    test_size=0.50,
    random_state=42,
    stratify=y_encoded_temp
)

print(f"\nTrain : {X_train.shape[0]} samples")
print(f"Val   : {X_val.shape[0]} samples")
print(f"Test  : {X_test.shape[0]} samples")

# Reshape for Conv1D → (samples, timesteps, channels)
X_train = X_train[..., np.newaxis]
X_val   = X_val[...,   np.newaxis]
X_test  = X_test[...,  np.newaxis]

# =========================================================
# STEP 4 — HANDLE CLASS IMBALANCE (class weights)
# =========================================================

# MIT-BIH has many more Normal (N) beats than others
# Class weights penalize the model more for getting rare classes wrong

y_train_labels = np.argmax(y_train, axis=1)

class_weights_array = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(y_train_labels),
    y=y_train_labels
)

class_weight_dict = dict(enumerate(class_weights_array))

print("\nClass Weights:")
for idx, weight in class_weight_dict.items():
    print(f"  Class {encoder.classes_[idx]} : {weight:.3f}")

# =========================================================
# STEP 5 — BUILD CNN + LSTM MODEL
# =========================================================
#
#  Architecture:
#   Input (256, 1)
#     ↓
#   CNN Block 1 — Conv1D(64)  → BN → ReLU → Pool → Dropout
#   CNN Block 2 — Conv1D(128) → BN → ReLU → Pool → Dropout
#   CNN Block 3 — Conv1D(256) → BN → ReLU → Pool → Dropout
#     ↓  (CNN extracts local wave features: QRS shape, P/T morphology)
#   LSTM(128)    → Dropout
#     ↓  (LSTM captures sequential / temporal dependencies)
#   Dense(64)    → Dropout
#   Dense(num_classes, softmax)
#

def build_model(input_shape, num_classes):

    model = Sequential([

        Input(shape=input_shape),

        # --- CNN Block 1 ---
        Conv1D(filters=64, kernel_size=5, padding='same', activation='relu'),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Dropout(0.2),

        # --- CNN Block 2 ---
        Conv1D(filters=128, kernel_size=5, padding='same', activation='relu'),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Dropout(0.2),

        # --- CNN Block 3 ---
        Conv1D(filters=256, kernel_size=3, padding='same', activation='relu'),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Dropout(0.2),

        # --- LSTM ---
        LSTM(128, return_sequences=False),
        Dropout(0.3),

        # --- Classifier Head ---
        Dense(64, activation='relu'),
        Dropout(0.3),
        Dense(num_classes, activation='softmax'),

    ])

    return model

model = build_model(
    input_shape=(X_train.shape[1], 1),
    num_classes=num_classes
)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

model.summary()

# =========================================================
# STEP 6 — CALLBACKS
# =========================================================

callbacks = [

    # Stop training if val_loss doesn't improve for 10 epochs
    EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),

    # Save best model
    ModelCheckpoint(
        filepath='models/best_model.keras',
        monitor='val_loss',
        save_best_only=True,
        verbose=1
    ),

    # Reduce LR when val_loss plateaus
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-6,
        verbose=1
    ),

]

# =========================================================
# STEP 7 — TRAIN
# =========================================================

history = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=50,
    batch_size=64,
    class_weight=class_weight_dict,
    callbacks=callbacks,
    verbose=1
)

# =========================================================
# STEP 8 — TRAINING CURVES
# =========================================================

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

axes[0].plot(history.history['accuracy'],     label='Train Accuracy')
axes[0].plot(history.history['val_accuracy'], label='Val Accuracy')
axes[0].set_title("Accuracy")
axes[0].set_xlabel("Epoch")
axes[0].set_ylabel("Accuracy")
axes[0].legend()
axes[0].grid(alpha=0.3)

axes[1].plot(history.history['loss'],     label='Train Loss')
axes[1].plot(history.history['val_loss'], label='Val Loss')
axes[1].set_title("Loss")
axes[1].set_xlabel("Epoch")
axes[1].set_ylabel("Loss")
axes[1].legend()
axes[1].grid(alpha=0.3)

plt.suptitle("CNN + LSTM Training Curves", fontsize=14, fontweight='bold')
plt.tight_layout()
plt.savefig("plots/training_curves.png", dpi=150)
plt.show()

# =========================================================
# STEP 9 — EVALUATE ON TEST SET
# =========================================================

test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)

print(f"\nTest Loss     : {test_loss:.4f}")
print(f"Test Accuracy : {test_acc*100:.2f}%")

# =========================================================
# STEP 10 — CONFUSION MATRIX
# =========================================================

y_pred      = model.predict(X_test)
y_pred_labels = np.argmax(y_pred,  axis=1)
y_true_labels = np.argmax(y_test,  axis=1)

cm = confusion_matrix(y_true_labels, y_pred_labels)

plt.figure(figsize=(8, 6))

sns.heatmap(
    cm,
    annot=True,
    fmt='d',
    cmap='Blues',
    xticklabels=encoder.classes_,
    yticklabels=encoder.classes_
)

plt.title("Confusion Matrix", fontsize=14, fontweight='bold')
plt.xlabel("Predicted Label")
plt.ylabel("True Label")
plt.tight_layout()
plt.savefig("plots/confusion_matrix.png", dpi=150)
plt.show()

# =========================================================
# STEP 11 — CLASSIFICATION REPORT
# =========================================================

print("\nClassification Report:")
print(classification_report(
    y_true_labels,
    y_pred_labels,
    target_names=[label_names.get(c, c) for c in encoder.classes_]
))

# =========================================================
# STEP 12 — SAVE FINAL MODEL + ENCODER
# =========================================================

model.save("models/ecg_cnn_lstm.keras")

np.save("models/label_classes.npy", encoder.classes_)

print("\n====================================")
print("TRAINING COMPLETE")
print("====================================")
print("Saved:")
print("  models/ecg_cnn_lstm.keras")
print("  models/label_classes.npy")
print("  models/best_model.keras")
print("Plots:")
print("  plots/training_curves.png")
print("  plots/confusion_matrix.png")
print("====================================")