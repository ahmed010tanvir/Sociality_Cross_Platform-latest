import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userModel.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure environment variables are loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.PLATFORM_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    // Force account selection and offline access
    prompt: 'select_account',
    accessType: 'offline'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists with this Google ID
        let existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
            // Existing Google OAuth user - they've already registered, so skip profile setup
            // Mark as complete since they're a returning user
            if (!existingUser.isProfileComplete) {
                existingUser.isProfileComplete = true;
                await existingUser.save();
            }

            return done(null, existingUser);
        }

        // Check if user exists with the same email (account linking)
        existingUser = await User.findOne({ email: profile.emails[0].value });

        if (existingUser) {
            // Account linking - logs removed

            // Link Google account to existing user
            existingUser.googleId = profile.id;
            existingUser.isGoogleUser = true;

            // If user doesn't have a profile picture, use Google's
            if (!existingUser.profilePic && profile.photos[0]?.value) {
                existingUser.profilePic = profile.photos[0].value;
            }

            // For existing users, check if they already have a complete profile
            // If they have name, username, and email, consider profile complete
            const hasRequiredFields = existingUser.name && existingUser.username && existingUser.email;
            if (hasRequiredFields && !existingUser.isProfileComplete) {
                existingUser.isProfileComplete = true;
            }

            await existingUser.save();
            return done(null, existingUser);
        }

        // Create new Google OAuth user

        const newUser = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            username: profile.emails[0].value.split('@')[0] + '_' + Date.now(), // Temporary username
            profilePic: profile.photos[0]?.value || '',
            isGoogleUser: true,
            isProfileComplete: false // New Google users must complete profile setup
        });

        await newUser.save();
        return done(null, newUser);
    } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error, null);
    }
}));

// Configure Google OAuth Strategy for Popup
passport.use('google-popup', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.PLATFORM_URL || 'http://localhost:5000'}/api/auth/google/popup/callback`,
    // Force account selection and offline access
    prompt: 'select_account',
    accessType: 'offline'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists with this Google ID
        let existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
            // Existing Google OAuth user - they've already registered, so skip profile setup
            // Mark as complete since they're a returning user
            if (!existingUser.isProfileComplete) {
                existingUser.isProfileComplete = true;
                await existingUser.save();
            }

            return done(null, existingUser);
        }

        // Check if user exists with the same email (account linking)
        existingUser = await User.findOne({ email: profile.emails[0].value });

        if (existingUser) {
            // Link Google account to existing user
            existingUser.googleId = profile.id;
            existingUser.isGoogleUser = true;

            // If user doesn't have a profile picture, use Google's
            if (!existingUser.profilePic && profile.photos[0]?.value) {
                existingUser.profilePic = profile.photos[0].value;
            }

            // For existing users, check if they already have a complete profile
            // If they have name, username, and email, consider profile complete
            const hasRequiredFields = existingUser.name && existingUser.username && existingUser.email;
            if (hasRequiredFields && !existingUser.isProfileComplete) {
                existingUser.isProfileComplete = true;
            }

            await existingUser.save();
            return done(null, existingUser);
        }

        // Create new Google OAuth user (Popup)

        const newUser = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            username: profile.emails[0].value.split('@')[0] + '_' + Date.now(), // Temporary username
            profilePic: profile.photos[0]?.value || '',
            isGoogleUser: true,
            isProfileComplete: false // New Google users must complete profile setup
        });

        await newUser.save();
        return done(null, newUser);
    } catch (error) {
        console.error('Error in Google OAuth popup strategy:', error);
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password');
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
