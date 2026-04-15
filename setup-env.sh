#!/bin/bash

# DeepResearch Environment Setup Script

echo "🔧 DeepResearch Environment Setup"
echo "================================="
echo ""

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend/.env from template..."
    cp backend/env.example backend/.env
fi

if [ ! -f "frontend/.env" ]; then
    echo "📝 Creating frontend/.env from template..."
    cp frontend/env.local.example frontend/.env
fi

echo "✅ Environment files created/verified"
echo ""

echo "🔑 You need to configure the following API keys:"
echo ""
echo "1. SUPABASE PROJECT SETUP:"
echo "   - Go to https://supabase.com/"
echo "   - Create a new project or use an existing one"
echo "   - Get your Project URL and API keys"
echo ""
echo "2. OPENAI API KEY:"
echo "   - Go to https://platform.openai.com/api-keys"
echo "   - Create a new API key"
echo ""
echo "3. TAVILY API KEY:"
echo "   - Go to https://tavily.com/"
echo "   - Sign up and get your API key"
echo ""

echo "📝 Please edit the following files with your actual API keys:"
echo "   - backend/.env"
echo "   - frontend/.env"
echo ""

echo "🔍 Current configuration:"
echo "Backend .env:"
if [ -f "backend/.env" ]; then
    echo "   SUPABASE_URL: $(grep SUPABASE_URL backend/.env | cut -d'=' -f2 | head -c 50)..."
    echo "   OPENAI_API_KEY: $(grep OPENAI_API_KEY backend/.env | cut -d'=' -f2 | head -c 20)..."
    echo "   TAVILY_API_KEY: $(grep TAVILY_API_KEY backend/.env | cut -d'=' -f2 | head -c 20)..."
else
    echo "   ❌ backend/.env not found"
fi

echo ""
echo "Frontend .env:"
if [ -f "frontend/.env" ]; then
    echo "   REACT_APP_SUPABASE_URL: $(grep REACT_APP_SUPABASE_URL frontend/.env | cut -d'=' -f2 | head -c 50)..."
    echo "   REACT_APP_SUPABASE_ANON_KEY: $(grep REACT_APP_SUPABASE_ANON_KEY frontend/.env | cut -d'=' -f2 | head -c 20)..."
else
    echo "   ❌ frontend/.env not found"
fi

echo ""
echo "🚀 After updating the API keys, you can start the application with:"
echo "   ./start-local.sh  (Docker)"
echo "   ./start-dev.sh    (Development mode)"
echo ""

echo "❓ Need help? Check LOCAL_SETUP.md for detailed instructions"




