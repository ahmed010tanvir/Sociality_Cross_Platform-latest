#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Run with: node generate-secrets.js
 */

const crypto = require('crypto');

console.log('🔐 Generating Secure Secrets for Production\n');
console.log('Copy these values to your Vercel Environment Variables:\n');

// Generate JWT Secret (64 bytes = 128 hex characters)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET=' + jwtSecret);

// Generate Session Secret (32 bytes = 64 hex characters)  
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('SESSION_SECRET=' + sessionSecret);

// Generate a strong MongoDB password suggestion
const mongoPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + '!@#';
console.log('\n📝 Suggested MongoDB Password:');
console.log(mongoPassword);

console.log('\n🚀 Next Steps:');
console.log('1. Create new MongoDB user with the suggested password');
console.log('2. Add these secrets to Vercel Environment Variables');
console.log('3. Update your MongoDB connection string');
console.log('4. Deploy with: vercel --prod');

console.log('\n⚠️  IMPORTANT:');
console.log('- Never commit these secrets to Git');
console.log('- Store them only in Vercel Dashboard');
console.log('- Keep a secure backup (password manager)');
