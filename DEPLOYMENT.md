# Deployment Guide for DeepResearch

This guide covers multiple deployment options for your DeepResearch application.

## Prerequisites

1. **Environment Variables**: Ensure you have all required environment variables:
   - `OPENAI_API_KEY`
   - `TAVILY_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

2. **Domain/URL**: Decide on your production domain

## Option 1: Vercel (Frontend) + Railway/Render (Backend) - Recommended

### Frontend Deployment (Vercel)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   cd frontend
   vercel
   ```

3. **Configure Environment Variables** in Vercel dashboard:
   - `REACT_APP_API_URL`: Your backend URL (e.g., `https://your-backend.railway.app`)

### Backend Deployment (Railway)

1. **Connect to Railway**:
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository
   - Select the `backend` directory

2. **Configure Environment Variables**:
   - `OPENAI_API_KEY`
   - `TAVILY_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `ALLOWED_ORIGINS`: Your frontend URL (e.g., `https://your-app.vercel.app`)

3. **Deploy**:
   - Railway will automatically detect the Python app and deploy

## Option 2: Netlify (Frontend) + Heroku (Backend)

### Frontend Deployment (Netlify)

1. **Build the app**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Netlify**:
   - Drag and drop the `build` folder to Netlify
   - Or connect your GitHub repository

3. **Configure Environment Variables**:
   - `REACT_APP_API_URL`: Your backend URL

### Backend Deployment (Heroku)

1. **Create Heroku app**:
   ```bash
   heroku create your-app-name
   ```

2. **Add buildpacks**:
   ```bash
   heroku buildpacks:add heroku/python
   ```

3. **Configure environment variables**:
   ```bash
   heroku config:set OPENAI_API_KEY=your_key
   heroku config:set TAVILY_API_KEY=your_key
   heroku config:set SUPABASE_URL=your_url
   heroku config:set SUPABASE_SERVICE_KEY=your_key
   heroku config:set ALLOWED_ORIGINS=https://your-app.netlify.app
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

## Option 3: Docker Deployment

### Using Docker Compose

1. **Build and run**:
   ```bash
   docker-compose up --build
   ```

### Using Docker Swarm or Kubernetes

1. **Build images**:
   ```bash
   docker build -t deepresearch-backend ./backend
   docker build -t deepresearch-frontend ./frontend
   ```

2. **Deploy to your preferred container orchestration platform**

## Option 4: AWS/GCP/Azure

### AWS Deployment

1. **Frontend (S3 + CloudFront)**:
   - Upload built files to S3 bucket
   - Configure CloudFront for CDN

2. **Backend (ECS/Fargate)**:
   - Use the provided Dockerfile
   - Deploy to ECS with Fargate

### GCP Deployment

1. **Frontend (Firebase Hosting)**:
   ```bash
   npm install -g firebase-tools
   firebase init hosting
   firebase deploy
   ```

2. **Backend (Cloud Run)**:
   - Use the provided Dockerfile
   - Deploy to Cloud Run

## Environment Configuration

### Frontend Environment Variables

Create `.env.production` in the frontend directory:
```
REACT_APP_API_URL=https://your-backend-url.com
```

### Backend Environment Variables

Ensure these are set in your deployment platform:
```
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
ALLOWED_ORIGINS=https://your-frontend-url.com
```

## Post-Deployment Checklist

1. ✅ Test all API endpoints
2. ✅ Verify authentication works
3. ✅ Test research functionality
4. ✅ Check CORS configuration
5. ✅ Verify environment variables
6. ✅ Test file uploads/exports
7. ✅ Monitor error logs
8. ✅ Set up monitoring/analytics

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `ALLOWED_ORIGINS` includes your frontend URL
2. **Environment Variables**: Double-check all required variables are set
3. **Build Errors**: Ensure all dependencies are in `package.json`
4. **API Errors**: Check backend logs for detailed error messages

### Support

For deployment issues, check:
- Platform-specific documentation
- Application logs
- Environment variable configuration
- Network connectivity between frontend and backend
