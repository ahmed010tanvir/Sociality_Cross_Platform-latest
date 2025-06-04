import jwt from "jsonwebtoken";

const generateTokenAndSetCookie = (userId, res, sessionPath = '') => {
	const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: "30d",
	});

	// Create a unique cookie name for each session to enable multi-tab support
	const cookieName = sessionPath ? `jwt-sociality${sessionPath.replace(/\//g, '-')}` : 'jwt-sociality';

	res.cookie(cookieName, token, {
		httpOnly: true, // more secure
		maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		// Use root path so cookie is available for all API requests
		path: '/',
	});

	return token;
};

export default generateTokenAndSetCookie;
