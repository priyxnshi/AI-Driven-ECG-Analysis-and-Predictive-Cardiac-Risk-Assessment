# ECGenius — AI-Driven ECG Analysis & Predictive Cardiac Risk Assessment Platform

ECGenius is a clinical full-stack application designed for ECG waveform ingestion, automated signal metric analysis, deep learning beat classification, and clinical PDF report generation.

## 🚀 Key Features

1. **Strict ECG Validation Ingestion**: Prevents renamed or malicious uploads (rejects executables, PDFs, images, archives) by verifying extension, MIME types, and binary file signatures. Supports `.csv`, `.dat`, `.hea`, `.mat`, and DICOM `.dcm` files.
2. **Multi-File Batch Upload Queue**: Supports uploading multiple waveforms in a batch queue with real-time status and progress indicators.
3. **Doctor & Admin Portals**: Dedicated authentication interfaces with role-based dashboard metrics, clinical timeline history tracker, and side-by-side comparative diagnostics workspace.
4. **AI classification**: Segment-level heartbeat classification using a CNN-LSTM hybrid network predicting Normal, Ventricular (PVC), Atrial (PAC), LBBB, and RBBB states.
5. **PDF Report Exports**: Dynamically generates clinical-grade single and batch PDF analysis summaries.

---

## 🔑 Default Portal Credentials

The database automatically seeds the following credentials for testing local access:

| Role | Username | Password |
|---|---|---|
| **Administrator** | `admin` | `adminpassword` |
| **Medical Practitioner (Doctor)** | `doctor` | `doctorpassword` |

---

## 🛠️ Quick Start Instructions

Ensure you have Python 3.10+ and Node.js 18+ installed on your system.

### Option 1: Automated Full-Stack Start (Recommended)
You can start both the Flask backend and the Next.js frontend concurrently using the wrapper script:
```bash
python run.py
```
* The backend will serve on: `http://localhost:8000`
* The frontend will serve on: `http://localhost:3000` (or `http://localhost:3001`)

### Option 2: Manual Start

**Terminal 1 — Backend API Server:**
```bash
# Activate virtual environment
venv\Scripts\activate # On Windows
source venv/bin/activate # On Unix/Mac

# Start the Flask API
python backend.py
```

**Terminal 2 — Frontend Application:**
```bash
cd frontend
npm run dev
```

---

## 🧪 Testing the Platform

### Run Automated Backend Tests
Run the unit test suite covering validation checks, authentication, content duplicate logs, and audit trails:
```bash
venv\Scripts\python -m unittest test_backend.py
```

---

## 🐳 Docker Deployment

To launch the entire platform in isolated containers:
```bash
docker-compose up --build
```
This binds the Next.js application to port 3000 and the Flask API to port 8000.
