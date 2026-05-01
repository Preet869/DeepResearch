# 🚀 Quick Start: Deploy DeepResearch to Vercel + Railway

## ✅ What's Ready

Your DeepResearch application has been configured for deployment with:

- ✅ **Frontend**: React app configured for Vercel deployment
- ✅ **Backend**: FastAPI app configured for Railway deployment
- ✅ **Environment Variables**: Centralized configuration system
- ✅ **CORS**: Production-ready CORS configuration
- ✅ **Docker**: Container configurations for both services
- ✅ **Deployment Scripts**: Automated deployment scripts

## 🎯 Next Steps

### 1. Prepare Your Environment Variables

Make sure you have these API keys ready:
```bash
export OPENAI_API_KEY=your_openai_api_key
export TAVILY_API_KEY=your_tavily_api_key
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### 2. Deploy Backend to Railway

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Create new project → Deploy from GitHub repo
4. Select your repository and set root directory to `backend`
5. Add environment variables in Railway dashboard
6. Deploy and copy the URL

### 3. Deploy Frontend to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to frontend: `cd frontend`
3. Create `.env.production` with your Railway URL
4. Deploy: `vercel --prod`
5. Copy the Vercel URL

### 4. Configure CORS

1. Go back to Railway dashboard
2. Update `ALLOWED_ORIGINS` with your Vercel URL
3. Redeploy the backend

## 📁 Key Files Created

- `frontend/config.js` - Centralized API configuration
- `frontend/vercel.json` - Vercel deployment config
- `backend/railway.json` - Railway deployment config
- `deploy-vercel-railway.sh` - Automated deployment script
- `VERCEL_RAILWAY_DEPLOYMENT.md` - Detailed deployment guide

## 🔧 Quick Commands

```bash
# Run automated deployment script
./deploy-vercel-railway.sh

# Or deploy manually
cd frontend && vercel --prod
```

## 🆘 Need Help?

1. Check `VERCEL_RAILWAY_DEPLOYMENT.md` for detailed steps
2. Review troubleshooting section in the deployment guide
3. Check platform-specific documentation:
   - [Vercel Docs](https://vercel.com/docs)
   - [Railway Docs](https://docs.railway.app)

## 🎉 Success!

Once deployed, your DeepResearch application will be live at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-app.railway.app`

Happy deploying! 🚀
