// All database access for reports and their history.
const db = require('../db');

const SELECT = `
  SELECT r.*, u.name AS reporter_name
  FROM reports r JOIN users u ON u.id = r.reporter_id`;

// Shapes a database row for the browser. Contact is included only when asked.
function toDto(row, viewer, { includeContact = false } = {}) {
  const dto = {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    location: row.location,
    date: row.date,
    description: row.description,
    status: row.status,
    imageUrl: row.image_url,
    reporterName: row.reporter_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner: Boolean(viewer && viewer.id === row.reporter_id),
  };
  if (includeContact) dto.contact = row.contact;
  return dto;
}

function list({ q, type, category, status, date, dateFrom, dateTo, page, limit }) {
  const where = ['r.deleted_at IS NULL'];
  const params = {};

  if (q) {
    where.push("(r.title LIKE @q ESCAPE '\\' OR r.description LIKE @q ESCAPE '\\' OR r.location LIKE @q ESCAPE '\\')");
    params.q = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  }
  if (type) { where.push('r.type = @type'); params.type = type; }
  if (category) { where.push('r.category = @category'); params.category = category; }
  if (status) { where.push('r.status = @status'); params.status = status; }
  if (date) { where.push('r.date = @date'); params.date = date; }
  if (dateFrom) { where.push('r.date >= @dateFrom'); params.dateFrom = dateFrom; }
  if (dateTo) { where.push('r.date <= @dateTo'); params.dateTo = dateTo; }

  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n FROM reports r WHERE ${whereSql}`).get(params).n;
  const rows = db
    .prepare(`${SELECT} WHERE ${whereSql} ORDER BY r.created_at DESC, r.id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset: (page - 1) * limit });
  return { rows, total };
}

const findById = (id) => db.prepare(`${SELECT} WHERE r.id = ? AND r.deleted_at IS NULL`).get(id);

const addEvent = db.prepare('INSERT INTO report_events (report_id, user_id, action) VALUES (?, ?, ?)');

const create = db.transaction((data) => {
  const id = db.prepare(`
    INSERT INTO reports (type, category, title, location, date, description, contact, image_url, reporter_id)
    VALUES (@type, @category, @title, @location, @date, @description, @contact, @imageUrl, @reporterId)`).run(data).lastInsertRowid;
  addEvent.run(id, data.reporterId, 'Created');
  return findById(id);
});

const setStatus = db.transaction((id, status, userId) => {
  db.prepare("UPDATE reports SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  addEvent.run(id, userId, status === 'Resolved' ? 'Marked Resolved' : 'Reopened');
  return findById(id);
});

const update = db.transaction((id, data, userId) => {
  const fields = ['title', 'location', 'date', 'description', 'contact'].filter((field) => data[field] !== undefined);
  if (fields.length) {
    const assignments = fields.map((field) => `${field} = @${field}`).join(', ');
    db.prepare(`UPDATE reports SET ${assignments}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id });
  }
  addEvent.run(id, userId, 'Edited');
  return findById(id);
});

// Soft delete: the row stays for the audit trail but disappears from every listing.
const softDelete = db.transaction((id, userId) => {
  db.prepare("UPDATE reports SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?").run(userId, id);
  addEvent.run(id, userId, 'Deleted');
});

const history = (id) =>
  db.prepare(`
    SELECT e.action, e.created_at AS at, u.name AS byName
    FROM report_events e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.report_id = ? ORDER BY e.id`).all(id);

module.exports = { toDto, list, findById, create, update, setStatus, softDelete, history };
