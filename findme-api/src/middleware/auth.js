// Identity and permission checks, run on the server before any protected action.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Users = require('../models/user.model');
const Reports = require('../models/report.model');
const validators = require('../utils/validators');
const { parse, HttpError } = require('../utils/http');

const COOKIE = 'token';

// Reads the signed cookie and loads the user fresh from the database,
// so a role change or a deleted account takes effect immediately.
function readUser(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return Users.toPublic(Users.findById(Number(payload.sub)));
  } catch {
    return null;
  }
}

function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

function requireAuth(req, res, next) {
  req.user = readUser(req);
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

function requireRole(role) {
  return (req, res, next) =>
    req.user && req.user.role === role
      ? next()
      : res.status(403).json({ error: 'You do not have permission to do that.' });
}

function loadReport(req, res, next) {
  const id = parse(validators.id, req.params.id);
  const report = Reports.findById(id);
  if (!report) throw new HttpError(404, 'Report not found.');
  req.report = report;
  next();
}

function ownerOrAdmin(req, res, next) {
  const isOwner = req.report.reporter_id === req.user.id;
  if (isOwner || req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Only the reporter or an administrator can change this report.' });
}

function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true, // JavaScript in the page cannot read it
    sameSite: 'lax', // not sent on cross-site form posts
    secure: config.isProd, // HTTPS only in production
    maxAge: config.sessionHours * 3600 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
}

module.exports = {
  optionalAuth, requireAuth, requireRole, loadReport, ownerOrAdmin, setSessionCookie, clearSessionCookie,
};
