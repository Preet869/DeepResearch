#!/bin/bash

# DeepResearch Local Development Startup Script

echo "🚀 Starting DeepResearch Local Development Environment..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Prerequisites met!"

# Check for environment files
echo "🔍 Checking environment configuration..."

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file not found!"
    echo "   Please copy backend/env.example to backend/.env and fill in your API keys"
    echo "   Required variables:"
    echo "   - OPENAI_API_KEY"
    echo "   - TAVILY_API_KEY"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_KEY"
    exit 1
fi

if [ ! -f "frontend/.env" ]; then
    echo "⚠️  Frontend .env file not found!"
    echo "   Please copy frontend/env.local.example to frontend/.env and fill in your values"
    echo "   Required variables:"
    echo "   - REACT_APP_SUPABASE_URL"
    echo "   - REACT_APP_SUPABASE_ANON_KEY"
    exit 1
fi

echo "✅ Environment files found!"

# Build and start services
echo "🏗️  Building and starting services..."

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose down

# Build the images
echo "📦 Building Docker images..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Start the services
echo "🚀 Starting services..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services!"
    exit 1
fi

echo ""
echo "✅ DeepResearch is now running locally!"
echo "======================================"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Health: http://localhost:8000/health"
echo ""
echo "📊 Useful commands:"
echo "   View logs:     docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart:       docker-compose restart"
echo ""
echo "🔧 Troubleshooting:"
echo "   - If frontend can't connect to backend, check REACT_APP_API_URL in frontend/.env"
echo "   - If backend fails, check your API keys in backend/.env"
echo "   - Check logs with: docker-compose logs [service-name]"
echo ""
echo "🎉 Happy researching!"
