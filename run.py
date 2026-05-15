#!/usr/bin/env python3
"""
Run script to start both backend and frontend
"""

import subprocess
import sys
import time
import os

print("=" * 70)
print("🚀 ECGenius - AI-Driven ECG Analysis System")
print("=" * 70)

# Start backend
print("\n📊 Starting Backend Server (Port 8000)...")
print("-" * 70)

backend_process = subprocess.Popen(
    [sys.executable, 'backend.py'],
    cwd=os.getcwd()
)

# Wait a bit for backend to start
time.sleep(3)

# Start frontend
print("\n🎨 Starting Frontend Server (Port 3000)...")
print("-" * 70)

frontend_process = subprocess.Popen(
    ['npm', 'run', 'dev'],
    cwd=os.path.join(os.getcwd(), 'frontend'),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

print("\n" + "=" * 70)
print("✨ SYSTEM READY!")
print("=" * 70)
print("\n📱 Frontend:   http://localhost:3000")
print("📊 Backend:    http://localhost:8000")
print("📈 API Docs:   http://localhost:8000/api/models")
print("\n🛑 Press Ctrl+C to stop all services\n")
print("=" * 70)

try:
    while True:
        time.sleep(1)
        # Check if processes are still running
        if backend_process.poll() is not None:
            print("⚠️  Backend process exited!")
            break
        if frontend_process.poll() is not None:
            print("⚠️  Frontend process exited!")
            break
except KeyboardInterrupt:
    print("\n\n🛑 Shutting down services...")
    backend_process.terminate()
    frontend_process.terminate()
    time.sleep(1)
    backend_process.kill()
    frontend_process.kill()
    print("✅ Services stopped.")
