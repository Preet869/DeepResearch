#!/bin/bash

# DeepResearch Vercel + Railway Deployment Script

echo "🚀 Starting DeepResearch Vercel + Railway Deployment..."

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

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists vercel; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
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
    echo ""
    echo "Please set these variables before running the deployment:"
    echo "export OPENAI_API_KEY=your_key"
    echo "export TAVILY_API_KEY=your_key"
    echo "export SUPABASE_URL=your_url"
    echo "export SUPABASE_SERVICE_KEY=your_key"
    exit 1
fi

echo "✅ All prerequisites met!"

# Step 1: Deploy Backend to Railway
echo ""
echo "🚂 Step 1: Deploying Backend to Railway"
echo "========================================"
echo ""
echo "1. Go to https://railway.app"
echo "2. Sign in with your GitHub account"
echo "3. Click 'New Project'"
echo "4. Select 'Deploy from GitHub repo'"
echo "5. Select your DeepResearch repository"
echo "6. Set the root directory to 'backend'"
echo "7. Add the following environment variables:"
echo "   - OPENAI_API_KEY: $OPENAI_API_KEY"
echo "   - TAVILY_API_KEY: $TAVILY_API_KEY"
echo "   - SUPABASE_URL: $SUPABASE_URL"
echo "   - SUPABASE_SERVICE_KEY: $SUPABASE_SERVICE_KEY"
echo "   - ALLOWED_ORIGINS: (will be set after frontend deployment)"
echo ""
echo "8. Click 'Deploy Now'"
echo ""
read -p "Press Enter when your Railway backend is deployed and you have the URL..."

# Get Railway URL
echo ""
echo "🔗 Please enter your Railway backend URL (e.g., https://your-app.railway.app):"
read RAILWAY_URL

if [ -z "$RAILWAY_URL" ]; then
    echo "❌ Railway URL is required"
    exit 1
fi

# Step 2: Deploy Frontend to Vercel
echo ""
echo "🎯 Step 2: Deploying Frontend to Vercel"
echo "======================================="
echo ""

# Create production environment file
echo "📝 Creating production environment file..."
cat > frontend/.env.production << EOF
# Production Environment Variables
REACT_APP_API_URL=$RAILWAY_URL
EOF

echo "✅ Created frontend/.env.production with API URL: $RAILWAY_URL"

# Deploy to Vercel
echo ""
echo "🚀 Deploying to Vercel..."
cd frontend

# Check if vercel.json exists, if not create it
if [ ! -f "vercel.json" ]; then
    echo "📝 Creating vercel.json configuration..."
    cat > vercel.json << EOF
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
EOF
fi

# Deploy to Vercel
echo "🎯 Running Vercel deployment..."
vercel --prod

if [ $? -ne 0 ]; then
    echo "❌ Vercel deployment failed!"
    exit 1
fi

echo ""
echo "✅ Frontend deployed successfully!"

# Step 3: Update Railway CORS
echo ""
echo "🔄 Step 3: Updating Railway CORS Configuration"
echo "=============================================="
echo ""
echo "1. Go back to your Railway dashboard"
echo "2. Find your backend service"
echo "3. Go to 'Variables' tab"
echo "4. Add/update the ALLOWED_ORIGINS variable with your Vercel URL"
echo "   (e.g., https://your-app.vercel.app)"
echo ""
echo "5. Redeploy the backend service"
echo ""

# Get Vercel URL
echo "🔗 Please enter your Vercel frontend URL (e.g., https://your-app.vercel.app):"
read VERCEL_URL

if [ -z "$VERCEL_URL" ]; then
    echo "⚠️  Vercel URL not provided. Please update ALLOWED_ORIGINS manually in Railway."
else
    echo ""
    echo "📝 Please update the ALLOWED_ORIGINS variable in Railway with:"
    echo "   $VERCEL_URL"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "🌐 Your application is now live at:"
echo "   Frontend: $VERCEL_URL"
echo "   Backend:  $RAILWAY_URL"
echo ""
echo "📋 Next steps:"
echo "1. Test your application"
echo "2. Verify all functionality works"
echo "3. Set up custom domain (optional)"
echo "4. Configure monitoring and analytics"
echo ""
echo "🔧 Troubleshooting:"
echo "- If you encounter CORS errors, make sure ALLOWED_ORIGINS is set correctly in Railway"
echo "- If API calls fail, verify the REACT_APP_API_URL in Vercel environment variables"
echo "- Check Railway logs for backend issues"
echo "- Check Vercel logs for frontend issues"
