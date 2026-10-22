const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const ctrl = require('../controllers/auth.controller');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Slows down password guessing: limited attempts per IP address every 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', optionalAuth, ctrl.me);

module.exports = router;
