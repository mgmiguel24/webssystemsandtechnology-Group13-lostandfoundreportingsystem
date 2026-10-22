const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const ctrl = require('../controllers/reports.controller');
const { upload } = require('../middleware/upload');
const { optionalAuth, requireAuth, requireRole, loadReport, ownerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Limits report submissions from one IP address every 15 minutes.
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.reportRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reports submitted. Please wait a few minutes and try again.' },
});

router.get('/', optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.get);
router.post('/', requireAuth, reportLimiter, upload.single('image'), ctrl.create);
router.patch('/:id', requireAuth, loadReport, ownerOrAdmin, ctrl.update);
router.patch('/:id/status', requireAuth, loadReport, ownerOrAdmin, ctrl.setStatus);
router.delete('/:id', requireAuth, requireRole('admin'), loadReport, ctrl.remove);

module.exports = router;
