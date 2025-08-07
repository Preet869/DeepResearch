#!/bin/bash

# DeepResearch Deployment Script

echo "🚀 Starting DeepResearch Deployment..."

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
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check environment variables
echo "🔍 Checking environment variables..."

required_vars=("OPENAI_API_KEY" "TAVILY_API_KEY" "SUPABASE_URL" "SUPABASE_SERVICE_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo "Please set these variables before running the deployment."
    exit 1
fi

echo "✅ All prerequisites met!"

# Build and deploy
echo "🏗️  Building and deploying..."

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
    echo "❌ Deployment failed!"
    exit 1
fi

echo "✅ Deployment successful!"
echo ""
echo "🌐 Your application is now running at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "📊 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop the application:"
echo "   docker-compose down"
