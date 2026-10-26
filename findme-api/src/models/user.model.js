// All database access for user accounts.
const db = require('../db');

const toPublic = (u) => (u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null);

const findById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const findByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);

function create({ name, email, passwordHash }) {
  // Role is hard-coded: self-registration can never create an admin.
  const id = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')")
    .run(name, email, passwordHash).lastInsertRowid;
  return findById(id);
}

const list = () =>
  db.prepare('SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY id').all();

const setRole = (id, role) => db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id).changes;

const countAdmins = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;

module.exports = { toPublic, findById, findByEmail, create, list, setRole, countAdmins };
