import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import xss from 'xss';

// Rate limiting configurations
export const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
	message: {
		error: 'Too many requests from this IP, please try again later.'
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Limit each IP to 5 login attempts per windowMs
	message: {
		error: 'Too many login attempts from this IP, please try again later.'
	},
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: true, // Don't count successful requests
});

export const messageLimiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 30, // Limit each IP to 30 messages per minute
	message: {
		error: 'Too many messages sent, please slow down.'
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const postLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 10, // Limit each IP to 10 posts per 5 minutes
	message: {
		error: 'Too many posts created, please wait before posting again.'
	},
	standardHeaders: true,
	legacyHeaders: false,
});

// Helmet configuration for security headers
export const helmetConfig = helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
			fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
			imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com", "https://cdn.jsdelivr.net"],
			scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for popup communication
			connectSrc: ["'self'", "wss:", "ws:", "https://accounts.google.com", "https://oauth2.googleapis.com"],
			mediaSrc: ["'self'", "https://res.cloudinary.com"],
			objectSrc: ["'none'"],
			frameSrc: ["'self'", "https://accounts.google.com"], // Allow Google OAuth frames
			frameAncestors: ["'self'"], // Prevent clickjacking
			upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
		},
	},
	crossOriginEmbedderPolicy: false, // Disable for Socket.IO compatibility
	crossOriginOpenerPolicy: false, // Disable for popup communication
	hsts: {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true
	}
});

// XSS sanitization middleware
export const sanitizeInput = (req, res, next) => {
	// Sanitize request body
	if (req.body) {
		for (const key in req.body) {
			if (typeof req.body[key] === 'string') {
				req.body[key] = xss(req.body[key], {
					whiteList: {}, // No HTML tags allowed
					stripIgnoreTag: true,
					stripIgnoreTagBody: ['script']
				});
			}
		}
	}

	// Sanitize query parameters
	if (req.query) {
		for (const key in req.query) {
			if (typeof req.query[key] === 'string') {
				req.query[key] = xss(req.query[key], {
					whiteList: {},
					stripIgnoreTag: true,
					stripIgnoreTagBody: ['script']
				});
			}
		}
	}

	next();
};

// Input validation middleware
export const validateInput = (req, res, next) => {
	// Check for common injection patterns
	const dangerousPatterns = [
		/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
		/javascript:/gi,
		/on\w+\s*=/gi,
		/eval\s*\(/gi,
		/expression\s*\(/gi
	];

	const checkString = (str) => {
		return dangerousPatterns.some(pattern => pattern.test(str));
	};

	const validateObject = (obj) => {
		for (const key in obj) {
			if (typeof obj[key] === 'string' && checkString(obj[key])) {
				return false;
			} else if (typeof obj[key] === 'object' && obj[key] !== null) {
				if (!validateObject(obj[key])) {
					return false;
				}
			}
		}
		return true;
	};

	if (req.body && !validateObject(req.body)) {
		return res.status(400).json({ error: 'Invalid input detected' });
	}

	if (req.query && !validateObject(req.query)) {
		return res.status(400).json({ error: 'Invalid query parameters detected' });
	}

	next();
};

// File upload security
export const validateFileUpload = (req, res, next) => {
	if (req.body.profilePic || req.body.img) {
		const imageData = req.body.profilePic || req.body.img;
		
		// Check if it's a valid base64 image
		if (imageData && typeof imageData === 'string') {
			const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
			if (!base64Pattern.test(imageData)) {
				return res.status(400).json({ error: 'Invalid image format' });
			}

			// Check file size (approximate, base64 is ~33% larger than binary)
			const sizeInBytes = (imageData.length * 3) / 4;
			const maxSize = 5 * 1024 * 1024; // 5MB
			
			if (sizeInBytes > maxSize) {
				return res.status(400).json({ error: 'Image too large. Maximum size is 5MB' });
			}
		}
	}

	next();
};
