# Sociality Deployment Guide

## Current Issue
Socket.IO doesn't work well with Vercel's serverless functions because they don't maintain persistent connections. The current deployment setup needs to be split into two parts:

1. **Frontend**: Deploy to Vercel (static hosting)
2. **Backend**: Deploy to Railway (persistent server for Socket.IO)

## Solution: Split Deployment

### Step 1: Deploy Backend to Railway

1. **Create Railway Account**: Go to [railway.app](https://railway.app) and sign up

2. **Create New Project**: 
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select this repository

3. **Configure Railway Deployment**:
   - Railway will detect the `railway.json` configuration
   - Set the following environment variables in Railway dashboard:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=your-session-secret
FRONTEND_URL=https://sociality-black.vercel.app
FEDERATION_ENABLED=false
ENABLE_CROSS_PLATFORM=false
LOG_LEVEL=error
ENABLE_SOCKET_LOGS=false
```

4. **Deploy**: Railway will automatically deploy your backend

5. **Get Railway URL**: After deployment, you'll get a URL like `https://sociality-backend-production.up.railway.app`

### Step 2: Update Frontend Configuration

The frontend is already configured to use the Railway backend URL in production:
- `sociality/frontend/src/services/socketService.js` (line 40)
- `sociality/frontend/src/context/SocketContext.jsx` (line 39)

Both are set to: `https://sociality-backend-production.up.railway.app`

**Update this URL** to match your actual Railway deployment URL.

### Step 3: Deploy Frontend to Vercel

1. **Vercel Configuration**: The `vercel.json` is already configured for frontend-only deployment

2. **Deploy**: Push your changes to GitHub, Vercel will automatically redeploy

3. **Environment Variables**: Make sure your Vercel environment variables are set correctly

## Alternative Solutions

### Option A: Use Vercel Edge Functions (Advanced)
- Convert Socket.IO to use Vercel's Edge Functions
- Requires significant code changes
- May have limitations

### Option B: Use Different Real-time Solution
- Replace Socket.IO with Pusher, Ably, or similar service
- Requires code refactoring
- Monthly costs for service

### Option C: Deploy Everything to Railway
- Deploy both frontend and backend to Railway
- Simpler but less optimal for static frontend

## Testing the Fix

1. **Check Backend Health**: Visit `https://your-railway-url.railway.app/api/health`
2. **Check Socket.IO**: Visit `https://your-railway-url.railway.app/socket-debug`
3. **Test Frontend**: Visit your Vercel app and check browser console for Socket.IO connection

## Current Configuration

- **Frontend**: Deployed to Vercel (static hosting)
- **Backend**: Should be deployed to Railway (persistent server)
- **Socket.IO**: Will work properly on Railway
- **Database**: MongoDB Atlas (works with both)
- **File Storage**: Cloudinary (works with both)

## Next Steps

1. Deploy backend to Railway with the provided configuration
2. Update the Railway URL in the frontend code
3. Redeploy frontend to Vercel
4. Test Socket.IO functionality

This split deployment approach will resolve the Socket.IO connection issues while maintaining optimal performance for both frontend and backend components.
