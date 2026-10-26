const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL CHECK (type IN ('Lost', 'Found')),
    category    TEXT NOT NULL CHECK (category IN ('Person', 'Pet', 'Item')),
    title       TEXT NOT NULL,
    location    TEXT NOT NULL,
    date        TEXT NOT NULL,
    description TEXT NOT NULL,
    contact     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Resolved')),
    image_url   TEXT,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT,
    deleted_by  INTEGER REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_filters ON reports (deleted_at, status, type, category, date);

  CREATE TABLE IF NOT EXISTS report_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id  INTEGER NOT NULL REFERENCES reports(id),
    user_id    INTEGER REFERENCES users(id),
    action     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_report ON report_events (report_id);
`);

function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;

  let password = config.admin.password;
  const generated = !password;
  if (generated) password = crypto.randomBytes(9).toString('base64url');

  const adminId = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(config.admin.name, config.admin.email, bcrypt.hashSync(password, 12)).lastInsertRowid;

  const insertReport = db.prepare(`
    INSERT INTO reports (type, category, title, location, date, description, contact, image_url, reporter_id)
    VALUES (@type, @category, @title, @location, @date, @description, @contact, @image_url, @reporter_id)`);
  const insertEvent = db.prepare("INSERT INTO report_events (report_id, user_id, action) VALUES (?, ?, 'Created')");

   const samples = [
  {
    type: 'Lost', category: 'Pet', title: 'Bella (Golden Retriever)', location: 'Greenwood Park Area', date: '2026-08-28',
    description: 'Friendly golden retriever, wearing a red leather collar with brass tags. Missing since late evening.',
    contact: '555-0199 / owner@example.com',
    image_url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
  },
  {
    type: 'Found', category: 'Item', title: 'Leather Wallet & Keys', location: 'Central Metro Station', date: '2026-08-30',
    description: 'Found brown leather wallet containing travel pass and a set of three silver keys.',
    contact: '555-0182 / finder@example.com',
    image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
  },
  {
    type: 'Found', category: 'Pet', title: 'Orange Tabby Cat', location: 'Barangay Tala, Caloocan', date: '2026-09-10',
    description: 'Found a friendly orange tabby cat near the basketball court, no collar. Appears well-fed and used to people.',
    contact: '555-0163 / finder2@example.com',
    image_url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=600&q=80',
  },
  {
    type: 'Lost', category: 'Item', title: 'Black Samsung Phone', location: 'SM North EDSA, near Cinema entrance', date: '2026-09-18',
    description: 'Black Samsung phone in a clear case with a cracked corner. Lock screen shows a dog photo.',
    contact: '555-0128 / owner2@example.com',
    image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
  },
  {
    type: 'Found', category: 'Person', title: 'Lost Child Found Near Plaza', location: 'Bagumbong Plaza', date: '2026-09-22',
    description: 'A young child, approximately 6-8 years old, found wandering alone near the plaza. Currently with barangay officials.',
    contact: '555-0199 / barangay@example.com',
    image_url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=600&q=80',
  },
];
  db.transaction(() => {
    for (const s of samples) {
      const id = insertReport.run({ ...s, reporter_id: adminId }).lastInsertRowid;
      insertEvent.run(id, adminId);
    }
  })();

  console.log(`[seed] Admin account created: ${config.admin.email}`);
  if (generated) {
    console.log(`[seed] Temporary admin password: ${password}`);
    console.log('[seed] Set ADMIN_PASSWORD in .env before first start to choose your own.');
  }
}
seed();

module.exports = db;
