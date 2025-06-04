# Sociality - Cross-Platform Messaging Solution

<div align="center">

![Sociality Logo](https://img.shields.io/badge/Sociality-Cross--Platform%20Messaging-blue?style=for-the-badge)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-green?style=flat-square&logo=mongodb)](https://mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-black?style=flat-square&logo=socket.io)](https://socket.io/)
[![Discord](https://img.shields.io/badge/Discord-Integration-7289da?style=flat-square&logo=discord)](https://discord.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Integration-0088cc?style=flat-square&logo=telegram)](https://telegram.org/)

*A modern social media platform with revolutionary cross-platform messaging capabilities*

</div>

## 🌟 Overview

Sociality is a comprehensive social media platform that breaks down communication barriers by enabling seamless messaging across multiple platforms. Users can create posts, follow each other, and participate in cross-platform chat rooms that bridge Sociality, Discord, and Telegram communities.

## ✨ Key Features

### 🔗 Cross-Platform Messaging
- **Universal Chat Rooms**: Create rooms that connect users across Sociality, Discord, and Telegram
- **Real-time Message Relay**: Messages sent on any platform are instantly delivered to all connected platforms
- **Federation Registry**: Intelligent message routing system that ensures reliable cross-platform delivery
- **Platform-Aware UI**: Messages display the originating platform for clear communication context

### 📱 Social Media Core
- **User Profiles**: Customizable profiles with bio, profile pictures, and follower/following system
- **Post Creation**: Share text posts with single or multiple image uploads
- **Interactive Engagement**: Like, comment, and reply to posts with real-time updates
- **Follow System**: Build your network by following other users and discovering suggested connections
- **Real-time Notifications**: Stay updated with instant notifications for interactions

### 🔐 Authentication & Security
- **Multiple Auth Methods**: Traditional email/password and Google OAuth2 integration
- **Secure Sessions**: JWT-based authentication with secure cookie management
- **Profile Setup**: Guided onboarding for new users
- **Rate Limiting**: Built-in protection against spam and abuse
- **Input Sanitization**: XSS protection and secure data handling

### 🚀 Real-time Features
- **Socket.IO Integration**: Instant message delivery and live updates
- **Live Chat**: Real-time messaging with typing indicators and delivery status
- **Cross-Platform Sync**: Messages appear instantly across all connected platforms
- **Online Status**: See who's active in real-time

## 🏗️ Serverless Architecture

Sociality is built with a modern serverless-first approach, providing scalability, cost-effectiveness, and zero server maintenance.

### 🌐 Serverless Benefits
- **Auto-scaling**: Handles traffic spikes automatically
- **Cost-effective**: Pay only for actual usage
- **Zero maintenance**: No server management required
- **Global distribution**: Edge deployment for low latency
- **Built-in redundancy**: High availability by design

## 🏗️ Architecture

### Backend (Node.js/Express)
```
sociality/backend/
├── controllers/          # Business logic handlers
├── models/              # MongoDB schemas
├── routes/              # API endpoints
├── services/            # Cross-platform integrations
├── platforms/           # Discord & Telegram bot services
├── socket/              # Real-time communication
├── middlewares/         # Authentication & validation
└── utils/               # Helper functions
```

### Frontend (React/Vite)
```
sociality/frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Application pages
│   ├── hooks/          # Custom React hooks
│   ├── context/        # React context providers
│   ├── atoms/          # Recoil state management
│   └── services/       # API communication
```

### Cross-Platform Services
```
sociality/backend/platforms/
├── discord/            # Discord bot integration
├── telegram/           # Telegram bot integration
└── federation-registry/ # Message routing service
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: Passport.js (Google OAuth2), JWT
- **File Storage**: Cloudinary
- **Security**: Helmet, CORS, Rate Limiting
- **Bots**: Discord.js, node-telegram-bot-api

### Frontend
- **Framework**: React 18 with Vite
- **UI Library**: Chakra UI
- **State Management**: Recoil
- **Routing**: React Router
- **Real-time**: Socket.IO Client
- **Styling**: Emotion, CSS Modules

### DevOps & Deployment
- **Process Management**: Nodemon (development)
- **Environment**: dotenv configuration
- **Deployment**: Vercel serverless functions
- **Logging**: Custom logging system

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- MongoDB database
- Cloudinary account (for image uploads)
- Discord Bot Token (optional, for Discord integration)
- Telegram Bot Token (optional, for Telegram integration)

###🐧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Sociality_Cross_Platform-latest/sociality
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   npm install --prefix frontend
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

4. **Configure Environment Variables**
   ```env
   # Required
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   
   # Optional (for OAuth)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Optional (for cross-platform messaging)
   DISCORD_BOT_TOKEN=your_discord_bot_token
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   ```

5. **Start the application**
   ```bash
   # Development mode (backend + frontend)
   npm run dev

   # Build for serverless deployment
   npm run build
   ```

6. **Access the application**
   - Development Frontend: http://localhost:7100
   - Development Backend API: http://localhost:5000
   - Production: Deploy to Vercel for serverless hosting

### 🚀 Production Deployment

**Quick Deploy to Vercel:**
1. Fork this repository
2. Connect to Vercel
3. Configure environment variables
4. Deploy automatically

## 📖 API Documentation

### Authentication Endpoints
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/user` - Get current user
- `POST /api/users/signup` - User registration
- `POST /api/users/login` - User login

### Social Features
- `GET /api/posts` - Get posts feed
- `POST /api/posts` - Create new post
- `POST /api/posts/:id/like` - Like/unlike post
- `POST /api/posts/:id/reply` - Reply to post

### Cross-Platform Messaging
- `POST /api/cross-platform/rooms` - Create cross-platform room
- `POST /api/cross-platform/rooms/:id/messages` - Send message
- `GET /api/cross-platform/status` - Get platform status

## 🔧 Configuration

### Serverless Deployment

1. **Vercel Deployment**
   - Connect your GitHub repository to Vercel
   - Configure environment variables in Vercel dashboard
   - The `vercel.json` configuration handles serverless functions automatically
   - Both frontend and backend deploy as a single serverless application

### Cross-Platform Setup

1. **Discord Bot Setup**
   - Create a Discord application at https://discord.com/developers/applications
   - Create a bot and copy the token
   - Add bot to your Discord server with appropriate permissions

2. **Telegram Bot Setup**
   - Message @BotFather on Telegram
   - Create a new bot and copy the token
   - Serverless functions handle webhook endpoints automatically

3. **Federation Registry**
   - Built-in serverless federation system
   - No external services required
   - Automatic message routing between platforms

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by the need for unified communication
- Community-driven development

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

<div align="center">
Made with ❤️ by the Sociality Team :-_-:
</div>
