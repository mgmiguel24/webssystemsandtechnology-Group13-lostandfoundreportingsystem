const Users = require('../models/user.model');
const validators = require('../utils/validators');
const { parse, HttpError } = require('../utils/http');

// GET /api/admin/users
function listUsers(req, res) {
  res.json({ items: Users.list() });
}

// PATCH /api/admin/users/:id/role   body: { "role": "admin" | "user" }
function setRole(req, res) {
  const id = parse(validators.id, req.params.id);
  const { role } = parse(validators.role, req.body);
  const target = Users.findById(id);
  if (!target) throw new HttpError(404, 'User not found.');
  if (target.id === req.user.id) throw new HttpError(400, 'You cannot change your own role.');
  if (target.role === 'admin' && role === 'user' && Users.countAdmins() === 1) {
    throw new HttpError(400, 'Cannot remove the last administrator.');
  }
  Users.setRole(id, role);
  res.json({ user: Users.toPublic(Users.findById(id)) });
}

module.exports = { listUsers, setRole };
