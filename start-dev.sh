#!/bin/bash

# DeepResearch Development Mode Startup Script (without Docker)

echo "🚀 Starting DeepResearch in Development Mode..."

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -f "frontend/package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists python3; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Prerequisites met!"

# Check for environment files
echo "🔍 Checking environment configuration..."

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file not found!"
    echo "   Please copy backend/env.example to backend/.env and fill in your API keys"
    exit 1
fi

if [ ! -f "frontend/.env" ]; then
    echo "⚠️  Frontend .env file not found!"
    echo "   Please copy frontend/env.local.example to frontend/.env and fill in your values"
    exit 1
fi

echo "✅ Environment files found!"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd backend
pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies!"
    exit 1
fi
cd ..

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies!"
    exit 1
fi
cd ..

echo ""
echo "🚀 Starting services in development mode..."
echo "=========================================="
echo ""
echo "Starting backend server on http://localhost:8000"
echo "Starting frontend server on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend server..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ DeepResearch is now running in development mode!"
echo "=================================================="
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Health: http://localhost:8000/health"
echo ""
echo "📊 Development features:"
echo "   - Backend auto-reloads on code changes"
echo "   - Frontend hot-reloads on code changes"
echo "   - Full error logging and debugging"
echo ""
echo "🛑 To stop: Press Ctrl+C"
echo ""

# Wait for processes
wait
