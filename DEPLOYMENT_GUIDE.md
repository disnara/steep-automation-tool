# Deployment Guide

## Railway Deployment Steps

### 1. Backend Deployment on Railway
1. Fork this repository to your GitHub
2. Sign up at https://railway.app
3. Click "New Project" → "Deploy from GitHub" 
4. Select your forked repository
5. Set environment variables:
   - MONGO_URL: Your MongoDB Atlas connection string
   - DB_NAME: Your database name
   - CORS_ORIGINS: Your frontend URL

### 2. Frontend Deployment on Vercel
1. Sign up at https://vercel.com
2. Import your GitHub repository
3. Set build settings:
   - Framework: Create React App
   - Build Command: `cd frontend && yarn build`
   - Output Directory: `frontend/build`
4. Set environment variable:
   - REACT_APP_BACKEND_URL: Your Railway backend URL

### 3. Database Setup (MongoDB Atlas)
1. Sign up at https://cloud.mongodb.com
2. Create a free cluster
3. Create database user
4. Whitelist IP addresses (or use 0.0.0.0/0 for simplicity)
5. Copy connection string to MONGO_URL

### 4. Test Deployment
1. Visit your Vercel frontend URL
2. Test automation functionality
3. Monitor Railway logs for any issues

## Cost Breakdown
- Railway: ~$0-5/month (free tier with credits)
- Vercel: Free for personal projects
- MongoDB Atlas: Free tier (512MB storage)

Total: ~$0-5/month for 24/7 operation!
