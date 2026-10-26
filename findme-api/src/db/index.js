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
