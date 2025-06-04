# Serverless Deployment Guide - Fixed

This guide covers deploying Sociality as a serverless application using Vercel with the corrected configuration.

## 🚀 Quick Deploy to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier available)
- MongoDB Atlas database (or any MongoDB instance)
- Cloudinary account for image storage

### Step 1: Prepare Your Repository

1. **Fork or clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Sociality_Cross_Platform-latest/sociality
   ```

2. **Push to your GitHub repository**
   ```bash
   git add .
   git commit -m "Initial commit for serverless deployment"
   git push origin main
   ```

### Step 2: Deploy to Vercel

1. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your Sociality repository

2. **Configure Build Settings**
   - Framework Preset: `Other`
   - Root Directory: `sociality`
   - Build Command: `npm run vercel-build`
   - Output Directory: Leave empty (handled by vercel.json)
   - Install Command: `npm install`

### Step 3: Environment Variables

Configure these environment variables in Vercel dashboard:

#### Required Variables
```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/sociality

# JWT Security
JWT_SECRET=your-super-secret-jwt-key-here

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret

# Session Security
SESSION_SECRET=your-session-secret-key

# Frontend URL
FRONTEND_URL=https://your-app.vercel.app

# Deployment Settings
SERVE_FRONTEND=true
NODE_ENV=production
```

#### Optional Variables (for OAuth)
```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Optional Variables (for Cross-Platform Messaging)
```env
# Discord Bot
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-client-id

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=your-bot-username

# Federation (Serverless)
FEDERATION_ENABLED=true
ENABLE_CROSS_PLATFORM=true
FEDERATION_REGISTRY_URL=https://your-app.vercel.app
PLATFORM_URL=https://your-app.vercel.app
PLATFORM_NAME=Sociality
```

### Step 4: Deploy

1. **Trigger Deployment**
   - Click "Deploy" in Vercel
   - Wait for build to complete
   - Your app will be available at `https://your-app.vercel.app`

2. **Verify Deployment**
   - Check that the frontend loads at your domain
   - Test API health endpoint: `https://your-app.vercel.app/api/health`
   - Verify basic functionality

## 🔧 Troubleshooting Common Issues

### 404 NOT_FOUND Error

If you're getting a 404 error, try these solutions:

1. **Check Build Logs**
   - Go to Vercel dashboard → Your project → Functions tab
   - Look for build errors or missing files

2. **Verify File Structure**
   - Ensure `api/index.js` exists in your repository
   - Check that `vercel.json` is in the root of the `sociality` folder

3. **Environment Variables**
   - Verify all required environment variables are set
   - Check for typos in variable names
   - Ensure `SERVE_FRONTEND=true` is set

4. **Redeploy**
   - Go to Vercel dashboard → Deployments
   - Click "Redeploy" on the latest deployment

### Build Failures

1. **Dependencies**
   - Check that all dependencies are in package.json
   - Verify Node.js version compatibility (18+)

2. **Frontend Build**
   - Ensure frontend builds successfully locally
   - Check for missing environment variables

### Database Connection Issues

1. **MongoDB Atlas**
   - Whitelist Vercel IP addresses (or use 0.0.0.0/0)
   - Verify connection string format
   - Test connection locally first

### Cross-Platform Features Not Working

1. **Bot Configuration**
   - Verify bot tokens are correct
   - Check bot permissions in Discord/Telegram
   - Ensure webhook URLs point to your Vercel domain

## 📊 Monitoring

1. **Vercel Analytics**
   - Enable analytics in Vercel dashboard
   - Monitor function execution times
   - Track error rates

2. **Application Health**
   - Use `/api/health` endpoint for monitoring
   - Set up uptime monitoring (e.g., UptimeRobot)

## 🔄 Updates

- Push to main branch triggers automatic deployment
- Preview deployments for pull requests
- Rollback capability in Vercel dashboard

## 📞 Support

For deployment issues:
1. Check Vercel function logs
2. Review build logs for errors
3. Test API endpoints individually
4. Open GitHub issue with specific error details

---

**Note**: The new `api/index.js` entry point is optimized for Vercel serverless functions and eliminates the 404 errors from the previous configuration.
