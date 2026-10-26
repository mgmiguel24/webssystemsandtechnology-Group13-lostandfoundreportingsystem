const bcrypt = require('bcryptjs');
const Users = require('../models/user.model');
const validators = require('../utils/validators');
const { parse, HttpError } = require('../utils/http');
const { setSessionCookie, clearSessionCookie } = require('../middleware/auth');

// Used when an email is unknown, so a wrong email and a wrong password take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

async function register(req, res) {
  // Any "role" field the browser sends is ignored; only name, email and password are read.
  const { name, email, password } = parse(validators.register, req.body);
  if (Users.findByEmail(email)) throw new HttpError(409, 'An account with this email already exists. Please sign in instead.');

  // Store a one-way hash so a database leak does not expose account passwords.
  const passwordHash = await bcrypt.hash(password, 12);
  const user = Users.create({ name, email, passwordHash });
  setSessionCookie(res, user);
  res.status(201).json({ user: Users.toPublic(user) });
}

async function login(req, res) {
  const { email, password } = parse(validators.login, req.body);
  const user = Users.findByEmail(email);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password.');

  setSessionCookie(res, user);
  res.json({ user: Users.toPublic(user) });
}

function logout(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}

function me(req, res) {
  res.json({ user: req.user || null });
}

module.exports = { register, login, logout, me };
