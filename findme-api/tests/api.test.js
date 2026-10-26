// End-to-end API tests. Run with: npm test
// Uses a throwaway database and upload folder, so real data is never touched.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'findme-test-'));
Object.assign(process.env, {
  DB_PATH: path.join(tmp, 'test.db'),
  UPLOAD_DIR: path.join(tmp, 'uploads'),
  JWT_SECRET: 'test-secret',
  ADMIN_EMAIL: 'admin@test.local',
  ADMIN_PASSWORD: 'AdminPass123',
  AUTH_RATE_LIMIT: '1000',
  REPORT_RATE_LIMIT: '10',
});

const { createApp } = require('../src/app');
const adminController = require('../src/controllers/admin.controller');
const db = require('../src/db');

let server;
let base;

// Minimal client that remembers its own session cookie, like a separate browser.
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const headers = cookie ? { cookie } : {};
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, data, headers: res.headers };
  };
}

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function reportForm(overrides = {}, file) {
  const fd = new FormData();
  const fields = {
    type: 'Lost', category: 'Item', title: 'Blue Backpack', location: 'Bacoor Public Market',
    date: '2026-10-01', description: 'Blue backpack with a laptop and school ID inside.', contact: '0917-000-0000',
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append('image', new Blob([file.data], { type: file.type }), file.name);
  return fd;
}

const guest = client();
const alice = client();
const bob = client();
const admin = client();
let aliceReportId;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('security headers are sent', async () => {
  const res = await guest('GET', '/api/reports');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('content-security-policy'));
});

test('registration ignores a requested admin role', async () => {
  const res = await alice('POST', '/api/auth/register', { name: 'Alice', email: 'alice@test.local', password: 'password123', role: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, 'user');
  await bob('POST', '/api/auth/register', { name: 'Bob', email: 'bob@test.local', password: 'password123' });
});

test('duplicate email and weak password are rejected', async () => {
  assert.equal((await guest('POST', '/api/auth/register', { name: 'Alice 2', email: 'ALICE@test.local', password: 'password123' })).status, 409);
  assert.equal((await guest('POST', '/api/auth/register', { name: 'Shorty', email: 's@test.local', password: '123' })).status, 400);
});

test('wrong password returns 401; correct one signs in', async () => {
  assert.equal((await admin('POST', '/api/auth/login', { email: 'admin@test.local', password: 'wrong' })).status, 401);
  const ok = await admin('POST', '/api/auth/login', { email: 'admin@test.local', password: 'AdminPass123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
});

test('passwords are stored hashed, never as plain text', () => {
  const db = require('../src/db');
  const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('alice@test.local');
  assert.notEqual(row.password_hash, 'password123');
  assert.match(row.password_hash, /^\$2[aby]\$/);
});

test('guests cannot create reports', async () => {
  assert.equal((await guest('POST', '/api/reports', reportForm())).status, 401);
});

test('signed-in user creates a report with a photo', async () => {
  const res = await alice('POST', '/api/reports', reportForm({}, { data: PNG, type: 'image/png', name: 'bag.png' }));
  assert.equal(res.status, 201);
  assert.match(res.data.imageUrl, /^\/uploads\/[0-9a-f-]+\.png$/);
  assert.equal(res.data.isOwner, true);
  aliceReportId = res.data.id;
  const img = await fetch(base + res.data.imageUrl);
  assert.equal(img.status, 200);
});

test('invalid reports are rejected', async () => {
  assert.equal((await alice('POST', '/api/reports', reportForm({ date: '2999-01-01' }))).status, 400);
  assert.equal((await alice('POST', '/api/reports', reportForm({ category: 'Car' }))).status, 400);
  assert.equal((await alice('POST', '/api/reports', reportForm({}, { data: Buffer.from('not an image'), type: 'image/png', name: 'fake.png' }))).status, 400);
  assert.equal((await alice('POST', '/api/reports', reportForm({}, { data: Buffer.from('hello'), type: 'text/plain', name: 'a.txt' }))).status, 400);
});

test('contact details are hidden from guests and shown to members', async () => {
  const list = await guest('GET', '/api/reports');
  assert.ok(list.data.items.length >= 3);
  assert.ok(list.data.items.every((r) => !('contact' in r)));

  const asGuest = await guest('GET', `/api/reports/${aliceReportId}`);
  assert.equal(asGuest.data.contactHidden, true);
  assert.equal(asGuest.data.contact, undefined);

  const asBob = await bob('GET', `/api/reports/${aliceReportId}`);
  assert.equal(asBob.data.contact, '0917-000-0000');
  assert.equal(asBob.data.history, undefined); // history is for owner/admin only
});

test('search and filters run on the server', async () => {
  const found = await guest('GET', '/api/reports?type=Found');
  assert.ok(found.data.items.length > 0 && found.data.items.every((r) => r.type === 'Found'));
  const search = await guest('GET', '/api/reports?q=backpack');
  assert.equal(search.data.items.length, 1);
  const percent = await guest('GET', '/api/reports?q=%25'); // a literal "%" must not match everything
  assert.equal(percent.data.items.length, 0);
  assert.equal((await guest('GET', '/api/reports?status=Closed')).status, 400);
});

test('date range filters include only reports within the requested bounds', async () => {
  const res = await guest('GET', '/api/reports?dateFrom=2026-08-29&dateTo=2026-10-01');
  assert.ok(res.data.items.length > 0);
  assert.ok(res.data.items.every((report) => report.date >= '2026-08-29' && report.date <= '2026-10-01'));
});

test('exact date filter remains supported', async () => {
  const res = await guest('GET', '/api/reports?date=2026-10-01');
  assert.ok(res.data.items.length > 0);
  assert.ok(res.data.items.every((report) => report.date === '2026-10-01'));
});

test('only the owner or an admin can change status', async () => {
  assert.equal((await bob('PATCH', `/api/reports/${aliceReportId}/status`, { status: 'Resolved' })).status, 403);
  const res = await alice('PATCH', `/api/reports/${aliceReportId}/status`, { status: 'Resolved' });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'Resolved');
  const detail = await alice('GET', `/api/reports/${aliceReportId}`);
  assert.deepEqual(detail.data.history.map((h) => h.action), ['Created', 'Marked Resolved']);
});

test('non-owner cannot edit a report; owner edits persist in history', async () => {
  const denied = await bob('PATCH', `/api/reports/${aliceReportId}`, { title: 'Changed Backpack' });
  assert.equal(denied.status, 403);
  const edited = await alice('PATCH', `/api/reports/${aliceReportId}`, { title: 'Updated Blue Backpack', location: 'New Market' });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.title, 'Updated Blue Backpack');
  assert.equal(edited.data.location, 'New Market');
  const detail = await alice('GET', `/api/reports/${aliceReportId}`);
  assert.equal(detail.data.title, 'Updated Blue Backpack');
  assert.equal(detail.data.location, 'New Market');
  assert.ok(detail.data.history.some((event) => event.action === 'Edited'));
});

test('only an admin can delete, and deleted reports disappear', async () => {
  assert.equal((await alice('DELETE', `/api/reports/${aliceReportId}`)).status, 403);
  assert.equal((await admin('DELETE', `/api/reports/${aliceReportId}`)).status, 200);
  assert.equal((await guest('GET', `/api/reports/${aliceReportId}`)).status, 404);
});

test('admin can promote a user; regular users cannot see the user list', async () => {
  assert.equal((await alice('GET', '/api/admin/users')).status, 403);
  const users = await admin('GET', '/api/admin/users');
  const bobRow = users.data.items.find((u) => u.email === 'bob@test.local');
  const res = await admin('PATCH', `/api/admin/users/${bobRow.id}/role`, { role: 'admin' });
  assert.equal(res.data.user.role, 'admin');
  const me = await bob('GET', '/api/auth/me'); // takes effect without signing in again
  assert.equal(me.data.user.role, 'admin');
});

test('logout ends the session', async () => {
  await alice('POST', '/api/auth/logout');
  assert.equal((await alice('GET', '/api/auth/me')).data.user, null);
});

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function callController(req, res) {
  try {
    adminController.setRole(req, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

test('controller allows demotion when multiple administrators exist', () => {
  const adminRows = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 2").all();
  const targetId = adminRows[0].id;
  const actorId = adminRows[1].id;
  const res = mockResponse();
  callController({ user: { id: actorId }, params: { id: String(targetId) }, body: { role: 'user' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.id, targetId);
  assert.equal(res.body.user.role, 'user');
});

test('controller rejects demoting the sole administrator', () => {
  const adminRow = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  const actorRow = db.prepare("SELECT id FROM users WHERE role = 'user' LIMIT 1").get();
  db.prepare("UPDATE users SET role = 'user' WHERE role = 'admin'").run();
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(adminRow.id);
  const res = mockResponse();
  callController({ user: { id: actorRow.id }, params: { id: String(adminRow.id) }, body: { role: 'user' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /cannot remove the last administrator/i);
});

test('report creation is rate limited', async () => {
  // Five authorized POSTs above were counted; these five complete the allowance.
  for (let i = 0; i < 5; i += 1) {
    const res = await alice('POST', '/api/reports', reportForm({ title: `Rate Limited Test ${i}` }));
    assert.equal(res.status, 201);
  }
  const limited = await alice('POST', '/api/reports', reportForm({ title: 'Rate Limited Test Final' }));
  assert.equal(limited.status, 429);
  assert.match(limited.data.error, /too many reports submitted/i);
});
