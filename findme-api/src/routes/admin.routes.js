const express = require('express');
const ctrl = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));
router.get('/users', ctrl.listUsers);
router.patch('/users/:id/role', ctrl.setRole);

module.exports = router;
