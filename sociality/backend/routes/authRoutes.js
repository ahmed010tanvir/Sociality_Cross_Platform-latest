import express from 'express';
import passport from '../config/passport.js';
import generateTokenAndSetCookie from '../utils/helpers/generateTokenAndSetCookie.js';
import { findDuplicateUsers, findAllDuplicateEmails } from '../utils/userDebug.js';

const router = express.Router();

// Google OAuth routes
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account', // Force account selection
        accessType: 'offline'
    })
);

// Google OAuth popup route (for popup-based authentication)
router.get('/google/popup',
    passport.authenticate('google-popup', {
        scope: ['profile', 'email'],
        prompt: 'select_account', // Force account selection
        accessType: 'offline'
    })
);

router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/auth?error=oauth_failed'
    }),
    async (req, res) => {
        try {
            // Generate unique session path
            const sessionPath = `/session-${Date.now()}`;
            
            // Generate JWT token and set cookie with session path
            generateTokenAndSetCookie(req.user._id, res, sessionPath);

            // OAuth authentication successful - logs removed

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4000';

            if (!req.user.isProfileComplete) {
                // Redirect to profile setup for NEW Google OAuth users only
                res.redirect(`${frontendUrl}/?oauth=success&setup=required&session=${sessionPath}`);
            } else {
                // Redirect to main app for EXISTING Google OAuth users
                res.redirect(`${frontendUrl}/?oauth=success&session=${sessionPath}`);
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4000';
            res.redirect(`${frontendUrl}/auth?error=oauth_callback_failed`);
        }
    }
);

// Google OAuth popup callback route
router.get('/google/popup/callback',
    passport.authenticate('google-popup', {
        failureRedirect: '/oauth-popup-callback?error=oauth_failed'
    }),
    async (req, res) => {
        try {
            // Generate unique session path
            const sessionPath = `/session-${Date.now()}`;

            // Generate JWT token and set cookie with session path
            generateTokenAndSetCookie(req.user._id, res, sessionPath);

            // OAuth popup authentication successful - logs removed

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4000';
            const tabId = req.query.tabId || '';

            if (!req.user.isProfileComplete) {
                // Redirect to popup callback page for NEW Google OAuth users
                const redirectUrl = `${frontendUrl}/oauth-popup-callback?oauth=success&setup=required&session=${sessionPath}&tabId=${tabId}`;
                res.redirect(redirectUrl);
            } else {
                // Redirect to popup callback page for EXISTING Google OAuth users
                const redirectUrl = `${frontendUrl}/oauth-popup-callback?oauth=success&session=${sessionPath}&tabId=${tabId}`;
                res.redirect(redirectUrl);
            }
        } catch (error) {
            console.error('OAuth popup callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4000';
            res.redirect(`${frontendUrl}/oauth-popup-callback?error=oauth_callback_failed`);
        }
    }
);

// OAuth success endpoint for frontend to get user data
router.get('/oauth/user', async (req, res) => {
    try {
        // Get session path from query parameter
        const sessionPath = req.query.session || '';

        // Get token from session-specific cookie (same logic as protectRoute)
        const cookieName = sessionPath ? `jwt-sociality${sessionPath.replace(/\//g, '-')}` : 'jwt-sociality';
        let token = req.cookies[cookieName] || req.cookies.jwt || req.cookies['jwt-sociality'];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token and get user (reuse existing JWT verification logic)
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        const user = await import('../models/userModel.js');
        const userData = await user.default.findById(decoded.userId).select('-password');

        if (!userData) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.status(200).json({
            _id: userData._id,
            name: userData.name,
            email: userData.email,
            username: userData.username,
            bio: userData.bio,
            profilePic: userData.profilePic,
            isGoogleUser: userData.isGoogleUser,
            isProfileComplete: userData.isProfileComplete,
            sessionPath: sessionPath // Include session path in response
        });
    } catch (error) {
        console.error('OAuth user fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Debug routes (remove in production)
router.get('/debug/cookies', (req, res) => {
    const sessionPath = req.query.session || '';
    const cookieName = sessionPath ? `jwt-sociality${sessionPath.replace(/\//g, '-')}` : 'jwt-sociality';
    const token = req.cookies[cookieName] || req.cookies.jwt || req.cookies['jwt-sociality'];

    res.json({
        sessionPath,
        cookieName,
        hasToken: !!token,
        allCookies: Object.keys(req.cookies),
        cookieValues: req.cookies
    });
});

router.get('/debug/duplicates/:email', async (req, res) => {
    try {
        const users = await findDuplicateUsers(req.params.email);
        res.json({ email: req.params.email, users, count: users.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/debug/all-duplicates', async (req, res) => {
    try {
        const duplicates = await findAllDuplicateEmails();
        res.json({ duplicates, count: duplicates.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
