#!/usr/bin/env node

/**
 * Script to update backend URL after Railway deployment
 * Usage: node update-backend-url.js <your-railway-url>
 * Example: node update-backend-url.js https://sociality-backend-abc123.up.railway.app
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Please provide your Railway backend URL');
  console.log('Usage: node update-backend-url.js <your-railway-url>');
  console.log('Example: node update-backend-url.js https://sociality-backend-abc123.up.railway.app');
  process.exit(1);
}

const newBackendUrl = args[0];

// Validate URL
try {
  new URL(newBackendUrl);
} catch (error) {
  console.error('❌ Invalid URL provided:', newBackendUrl);
  process.exit(1);
}

console.log('🔄 Updating backend URL to:', newBackendUrl);

// Update frontend .env.production
const frontendEnvPath = './frontend/.env.production';
const frontendEnvContent = `# Frontend Production Environment Variables
# Updated automatically by update-backend-url.js

VITE_SOCKET_URL=${newBackendUrl}`;

fs.writeFileSync(frontendEnvPath, frontendEnvContent);
console.log('✅ Updated frontend/.env.production');

// Update railway.json if needed
const railwayJsonPath = './railway.json';
if (fs.existsSync(railwayJsonPath)) {
  const railwayConfig = JSON.parse(fs.readFileSync(railwayJsonPath, 'utf8'));
  // Railway config doesn't need URL updates, but we can add health check
  console.log('✅ Railway configuration is ready');
}

console.log('\n🚀 Next steps:');
console.log('1. Deploy your backend to Railway using the railway.json configuration');
console.log('2. Set the environment variables in Railway dashboard (see DEPLOYMENT.md)');
console.log('3. Redeploy your frontend to Vercel');
console.log('4. Test Socket.IO connection');
console.log('\n📖 See DEPLOYMENT.md for detailed instructions');
