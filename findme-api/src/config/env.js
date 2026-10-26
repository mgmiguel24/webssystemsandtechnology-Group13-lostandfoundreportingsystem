// Central configuration. Every setting can be changed in the .env file.
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ quiet: true });

const root = path.resolve(__dirname, '..', '..');
const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET must be set in production.');
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET is not set. Using a temporary secret; everyone is signed out when the server restarts.');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  jwtSecret,
  sessionHours: Number(process.env.SESSION_HOURS) || 24,
  dbPath: path.resolve(root, process.env.DB_PATH || 'data/findme.db'),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || 'uploads'),
  publicDir: path.join(root, 'public'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  reportRateLimit: Number(process.env.REPORT_RATE_LIMIT) || 10,
  cspEnabled: process.env.CSP !== 'off',
  admin: {
    name: process.env.ADMIN_NAME || 'System Admin',
    email: (process.env.ADMIN_EMAIL || 'admin@findme.local').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
  },
};
