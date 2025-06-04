import path from "path";
import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env file, but don't fail if it doesn't exist (for production)
try {
	const envPath = path.resolve(__dirname, '../.env');
	dotenv.config({ path: envPath });
} catch (error) {
	console.log('No .env file found, using environment variables');
}

// Import all the necessary modules
import connectDB from "../backend/db/connectDB.js";
import cookieParser from "cookie-parser";
import userRoutes from "../backend/routes/userRoutes.js";
import postRoutes from "../backend/routes/postRoutes.js";
import messageRoutes from "../backend/routes/messageRoutes.js";
import notificationRoutes from "../backend/routes/notificationRoutes.js";
import authRoutes from "../backend/routes/authRoutes.js";
import federationRoutes from "../backend/routes/federationRoutes.js";
import crossPlatformRoutes from "../backend/routes/crossPlatformRoutes.js";

// Import middleware
import {
	helmetConfig,
	generalLimiter,
	authLimiter,
	postLimiter,
	messageLimiter,
	sanitizeInput,
	validateInput,
	validateFileUpload,
} from "../backend/middlewares/index.js";

import passport from "../backend/config/passport.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import logger from "../backend/utils/logger.js";

// Initialize Express app
const app = express();

// Connect to database with error handling
connectDB()
	.then(() => console.log('Database connected successfully'))
	.catch((error) => {
		console.error('Database connection failed:', error.message);
		// Don't exit in serverless environment, let individual requests handle DB errors
	});

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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
	secret: process.env.SESSION_SECRET || 'fallback-secret-key',
	resave: false,
	saveUninitialized: false,
	store: MongoStore.create({
		mongoUrl: process.env.MONGO_URI,
		touchAfter: 24 * 3600 // lazy session update
	}),
	cookie: {
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
		sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
	}
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get("/api/health", (req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV,
		version: "1.0.0"
	});
});

// Test endpoint
app.get("/api/test", (req, res) => {
	res.json({
		message: "Sociality API is working!",
		timestamp: new Date().toISOString(),
		path: req.path,
		method: req.method
	});
});

// Routes with specific rate limiting
app.use("/api/users", userRoutes);
app.use("/api/posts", postLimiter, validateFileUpload, postRoutes);
app.use("/api/messages", messageLimiter, messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/federation", federationRoutes);
app.use("/api/cross-platform", crossPlatformRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production" && process.env.SERVE_FRONTEND === "true") {
	const frontendDistPath = path.join(__dirname, "../frontend/dist");
	app.use(express.static(frontendDistPath));

	// Catch-all handler for React app
	app.get("*", (req, res) => {
		res.sendFile(path.resolve(frontendDistPath, "index.html"));
	});
} else {
	// API-only mode
	app.get("/", (req, res) => {
		res.json({
			message: "Sociality Backend API",
			version: "1.0.0",
			status: "running",
			environment: process.env.NODE_ENV
		});
	});
}

// Error handling middleware
app.use((err, req, res, next) => {
	logger.error('Unhandled error:', err);
	res.status(500).json({
		error: 'Internal server error',
		message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
	});
});

// Export the Express app for Vercel
export default app;
