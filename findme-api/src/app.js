// Builds the Express application: security headers, API routes, then the web page.
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
require('./db'); // creates tables and seeds on first run

const authRoutes = require('./routes/auth.routes');
const reportRoutes = require('./routes/reports.routes');
const adminRoutes = require('./routes/admin.routes');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Security headers. The page loads Tailwind and Phosphor Icons from CDNs and uses
  // inline onclick handlers, so those sources are allowed explicitly and nothing else.
  app.use(
    helmet({
      contentSecurityPolicy: config.cspEnabled
        ? {
            useDefaults: true,
            directives: {
              'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://unpkg.com'],
              'script-src-attr': ["'unsafe-inline'"],
              'style-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
              'font-src': ["'self'", 'data:', 'https://unpkg.com'],
              'img-src': ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
              'connect-src': ["'self'"],
              'upgrade-insecure-requests': null, // keeps http://localhost working
            },
          }
        : false,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));
  app.use(express.static(config.publicDir));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
