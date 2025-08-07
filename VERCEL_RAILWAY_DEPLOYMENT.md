# Vercel + Railway Deployment Guide

This guide will walk you through deploying your DeepResearch application using Vercel for the frontend and Railway for the backend.

## Prerequisites

1. **GitHub Account**: Your code should be in a GitHub repository
2. **Environment Variables**: You need these API keys:
   - `OPENAI_API_KEY`
   - `TAVILY_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign in with your GitHub account
3. Click "New Project"

### 1.2 Connect Repository
1. Select "Deploy from GitHub repo"
2. Choose your DeepResearch repository
3. Set the root directory to `backend/` (with the trailing slash)
4. Click "Deploy Now"

### 1.3 Configure Environment Variables
In your Railway project dashboard:

1. Go to the "Variables" tab
2. Add these environment variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   TAVILY_API_KEY=your_tavily_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
   ```

**Note**: Set `ALLOWED_ORIGINS` after you deploy the frontend.

### 1.4 Deploy Backend
1. Railway will automatically detect the Python app
2. Wait for the deployment to complete
3. Copy the generated URL (e.g., `https://your-app.railway.app`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 2.2 Configure Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Create production environment file:
   ```bash
   echo "REACT_APP_API_URL=https://your-backend-url.railway.app" > .env.production
   ```
   Replace `your-backend-url.railway.app` with your actual Railway URL.

### 2.3 Deploy to Vercel
1. Run the deployment:
   ```bash
   vercel --prod
   ```

2. Follow the prompts:
   - Link to existing project: `N`
   - Project name: `deepresearch-frontend` (or your preferred name)
   - Directory: `./` (current directory)
   - Override settings: `N`

3. Vercel will build and deploy your app
4. Copy the generated URL (e.g., `https://your-app.vercel.app`)

## Step 3: Configure CORS

### 3.1 Update Railway CORS
1. Go back to your Railway dashboard
2. Find your backend service
3. Go to "Variables" tab
4. Update `ALLOWED_ORIGINS` with your Vercel URL:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
5. Redeploy the backend service

## Step 4: Test Your Application

### 4.1 Verify Frontend
1. Visit your Vercel URL
2. Test the login functionality
3. Verify API calls work

### 4.2 Verify Backend
1. Test the API endpoints directly
2. Check Railway logs for any errors

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `ALLOWED_ORIGINS` includes your Vercel URL
   - Check that the URL format is correct (https://...)

2. **API Connection Errors**
   - Verify `REACT_APP_API_URL` is set correctly in Vercel
   - Check that the Railway backend is running

3. **Environment Variables**
   - Double-check all required variables are set in Railway
   - Ensure variable names match exactly

4. **Build Errors**
   - Check Vercel build logs
   - Ensure all dependencies are in `package.json`

### Debugging Steps

1. **Check Railway Logs**:
   - Go to Railway dashboard
   - Click on your service
   - Go to "Deployments" tab
   - Click on latest deployment
   - Check logs for errors

2. **Check Vercel Logs**:
   - Go to Vercel dashboard
   - Click on your project
   - Go to "Deployments" tab
   - Click on latest deployment
   - Check build logs

3. **Test API Endpoints**:
   - Use tools like Postman or curl
   - Test endpoints directly with your Railway URL

## Environment Variables Reference

### Frontend (Vercel)
```
REACT_APP_API_URL=https://your-backend-url.railway.app
```

### Backend (Railway)
```
OPENAI_API_KEY=your_openai_api_key
TAVILY_API_KEY=your_tavily_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
```

## Post-Deployment Checklist

- [ ] Frontend loads without errors
- [ ] User authentication works
- [ ] Research functionality works
- [ ] API calls succeed
- [ ] CORS errors resolved
- [ ] Environment variables configured
- [ ] Monitoring set up (optional)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review platform-specific documentation:
   - [Vercel Docs](https://vercel.com/docs)
   - [Railway Docs](https://docs.railway.app)
3. Check application logs
4. Verify environment variable configuration
