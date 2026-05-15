#!/bin/bash
# Quick Start Guide for ECGenius

echo "================================"
echo "🚀 ECGenius - Quick Start Guide"
echo "================================"
echo ""

echo "✅ CURRENT STATUS:"
echo "   Backend:  http://localhost:8000 (RUNNING)"
echo "   Frontend: http://localhost:3001 (RUNNING)"
echo ""

echo "📱 OPEN IN BROWSER:"
echo "   👉 http://localhost:3001"
echo ""

echo "🎯 NEXT STEPS:"
echo ""
echo "1️⃣  UPLOAD & ANALYZE ECG"
echo "   - Click 'Upload' in the UI"
echo "   - Drag and drop an ECG file"
echo "   - View analysis results"
echo ""

echo "2️⃣  TRAIN PREDICTION MODEL (Optional)"
echo "   When TensorFlow finishes installing:"
echo "   "
echo "   Step 1: Extract ECG data"
echo "   $ python main.py"
echo "   "
echo "   Step 2: Train model"
echo "   $ python train_model.py"
echo "   "
echo "   Step 3: Model automatically loads for predictions"
echo ""

echo "3️⃣  TEST API ENDPOINTS"
echo "   Get health status:"
echo "   $ curl http://localhost:8000/health"
echo "   "
echo "   Get available models:"
echo "   $ curl http://localhost:8000/api/models"
echo ""

echo "⚙️  TROUBLESHOOTING:"
echo ""
echo "Port in use?"
echo "   taskkill /PID <PID> /F"
echo ""

echo "Backend not responding?"
echo "   - Ensure python backend.py is running"
echo "   - Check firewall settings"
echo ""

echo "Frontend errors?"
echo "   - Clear browser cache"
echo "   - Check .env.local for correct API URL"
echo "   - Restart npm: cd frontend && npm run dev"
echo ""

echo "================================"
