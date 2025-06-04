import path from "path";
import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from 'url'; // Import necessary function

// Explicitly load .env using import.meta.url for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Define __dirname based on current file location
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Import other modules after environment variables are loaded
import connectDB from "./db/connectDB.js";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js"; // Import notification routes
import authRoutes from "./routes/authRoutes.js"; // Import OAuth routes
import federationRoutes from "./routes/federationRoutes.js"; // Import federation routes
import crossPlatformRoutes from "./routes/crossPlatformRoutes.js"; // Import cross-platform routes

import passport from "./config/passport.js"; // Import passport configuration

// Import security middleware
import {
	helmetConfig,
	generalLimiter,
	authLimiter,
	messageLimiter,
	postLimiter,
	sanitizeInput,
	validateInput,
	validateFileUpload
} from "./middlewares/security.js";

import { v2 as cloudinary } from "cloudinary";
import { app, server } from "./socket/socket.js";
import job from "./cron/cron.js";
import logger from "./utils/logger.js";
import axios from "axios";

// Import cross-platform services
import { startFederationRegistry } from "./services/federationRegistry.js";
import { startTelegramService } from "./services/telegramService.js";
import { startDiscordService } from "./services/discordService.js";


connectDB();
job.start();

const PORT = process.env.PORT || 5000;

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// CORS configuration
const corsOptions = {
	origin: process.env.NODE_ENV === "production"
		? ["https://sociality-black.vercel.app", process.env.FRONTEND_URL].filter(Boolean)
		: ["http://localhost:7100", "http://localhost:7101", "http://localhost:7300", "http://localhost:7301", "http://localhost:7302"],
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};

// Security middlewares
app.use(helmetConfig);
app.use(generalLimiter);
app.use(sanitizeInput);
app.use(validateInput);

// Basic middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Reduced from 50mb for security
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware for OAuth with MongoDB store
app.use(session({
	secret: process.env.SESSION_SECRET || 'fallback-secret-key',
	resave: false,
	saveUninitialized: false,
	store: MongoStore.create({
		mongoUrl: process.env.MONGO_URI,
		touchAfter: 24 * 3600, // lazy session update
		collectionName: 'sessions'
	}),
	cookie: {
		secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
		maxAge: 24 * 60 * 60 * 1000 // 24 hours
	}
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Debug middleware removed to reduce console output

// Routes with specific rate limiting
app.use("/api/users", userRoutes);
app.use("/api/posts", postLimiter, validateFileUpload, postRoutes);
app.use("/api/messages", messageLimiter, messageRoutes);
app.use("/api/notifications", notificationRoutes); // Mount notification routes
app.use("/api/auth", authLimiter, authRoutes); // Mount OAuth routes with auth rate limiting
app.use("/api/federation", federationRoutes); // Mount federation routes
app.use("/api/cross-platform", crossPlatformRoutes); // Mount cross-platform routes

// Health check endpoint for federation registry
app.get("/health", (req, res) => {
	res.json({
		status: 'ok',
		platform: 'sociality',
		timestamp: new Date().toISOString(),
		federationEnabled: process.env.FEDERATION_ENABLED === 'true'
	});
});

// Health check endpoint for Railway
app.get("/api/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV,
		uptime: process.uptime()
	});
});

// Socket.IO debug endpoint
app.get("/socket-debug", (req, res) => {
	const io = app.get('io');
	res.json({
		socketIOStatus: 'configured',
		environment: process.env.NODE_ENV,
		connectedSockets: io ? io.sockets.sockets.size : 0,
		timestamp: new Date().toISOString(),
		corsOrigin: process.env.NODE_ENV === "production"
			? ["https://sociality-black.vercel.app", process.env.FRONTEND_URL].filter(Boolean)
			: ["http://localhost:7100", "http://localhost:7101"],
		transports: process.env.NODE_ENV === "production" ? ['polling'] : ['websocket', 'polling']
	});
});



// http://localhost:5000 => backend, http://localhost:4000 => frontend

// Only serve static files if SERVE_FRONTEND is true (for Vercel deployment)
if (process.env.NODE_ENV === "production" && process.env.SERVE_FRONTEND === "true") {
	const frontendDistPath = path.join(__dirname, "../frontend/dist"); // Correct path to frontend build
	app.use(express.static(frontendDistPath));

	// react app
	app.get("*", (req, res) => {
		res.sendFile(path.resolve(frontendDistPath, "index.html")); // Serve index.html from correct path
	});
} else if (process.env.NODE_ENV === "production") {
	// Backend-only mode for separate deployment
	app.get("/", (req, res) => {
		res.json({
			message: "Sociality Backend API",
			version: "1.0.0",
			status: "running",
			socketIO: "enabled"
		});
	});
}

server.listen(PORT, () => {
	logger.info(`Server started at http://localhost:${PORT}`);

	// Start cross-platform services (enabled by default)
	logger.info('🚀 Starting cross-platform services...');

	// Start federation registry
	setTimeout(() => {
		startFederationRegistry();
	}, 1000);

	// Start Telegram service
	setTimeout(() => {
		startTelegramService();
	}, 2000);

	// Start Discord service
	setTimeout(() => {
		startDiscordService();
	}, 3000);

	logger.info('✅ Cross-platform services initialization scheduled');

	// Register with federation registry
	setTimeout(registerWithFederation, 4000); // Wait for federation registry to start
});

// Function to register with federation registry
async function registerWithFederation() {
	try {
		const federationRegistryUrl = process.env.FEDERATION_REGISTRY_URL || 'https://sociality-black.vercel.app';
		const platformUrl = process.env.PLATFORM_URL || 'https://sociality-black.vercel.app';
		const platformName = process.env.PLATFORM_NAME || 'sociality';

		await axios.post(`${federationRegistryUrl}/federation/peers`, {
			name: platformName,
			url: platformUrl
		});

		logger.info(`✅ Successfully registered with federation registry at ${federationRegistryUrl}`);

		// Re-register all existing rooms after peer registration
		await reRegisterExistingRooms(federationRegistryUrl, platformUrl);
	} catch (error) {
		logger.warn(`⚠️ Failed to register with federation registry: ${error.message}`);
		logger.info('Federation features may not work properly until registry is available');
	}
}

// Re-register all existing rooms with federation registry
async function reRegisterExistingRooms(federationRegistryUrl, platformUrl) {
	try {
		// Import Room model dynamically to avoid circular dependencies
		const { default: Room } = await import('./models/roomModel.js');
		const rooms = await Room.find({});

		logger.info(`🔄 Re-registering ${rooms.length} existing Sociality rooms with federation registry`);

		for (const room of rooms) {
			try {
				await axios.post(`${federationRegistryUrl}/federation/rooms`, {
					roomId: room.roomId,
					name: room.name || `Sociality Room ${room.roomId}`,
					peerUrl: platformUrl
				});
				logger.info(`✅ Re-registered room ${room.roomId} with federation registry`);
			} catch (error) {
				logger.warn(`⚠️ Failed to re-register room ${room.roomId}: ${error.message}`);
			}
		}

		logger.info(`🎯 Completed re-registration of ${rooms.length} Sociality rooms`);
	} catch (error) {
		logger.warn(`⚠️ Failed to re-register existing rooms: ${error.message}`);
	}
}
