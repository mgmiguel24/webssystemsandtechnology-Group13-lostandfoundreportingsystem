const Reports = require('../models/report.model');
const validators = require('../utils/validators');
const { parse, HttpError } = require('../utils/http');
const { looksLikeImage, removeFile } = require('../middleware/upload');

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80';

function list(req, res) {
  const query = parse(validators.listQuery, req.query);
  const { rows, total } = Reports.list(query);
  res.json({
    items: rows.map((row) => Reports.toDto(row, req.user)),
    total,
    page: query.page,
    pageSize: query.limit,
  });
}

function get(req, res) {
  const id = parse(validators.id, req.params.id);
  const row = Reports.findById(id);
  if (!row) throw new HttpError(404, 'Report not found.');

  const dto = Reports.toDto(row, req.user, { includeContact: Boolean(req.user) });
  dto.contactHidden = !req.user;
  if (req.user && (req.user.role === 'admin' || dto.isOwner)) dto.history = Reports.history(id);
  res.json(dto);
}

function create(req, res) {
  try {
    if (req.file && !looksLikeImage(req.file.path)) {
      throw new HttpError(400, 'The uploaded file is not a valid image.');
    }
    const data = parse(validators.createReport, req.body);
    const row = Reports.create({
      ...data,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : DEFAULT_IMAGE,
      reporterId: req.user.id, // taken from the session, never from the form
    });
    res.status(201).json(Reports.toDto(row, req.user, { includeContact: true }));
  } catch (err) {
    if (req.file) removeFile(req.file.path); // do not keep photos for rejected reports
    throw err;
  }
}

function setStatus(req, res) {
  const { status } = parse(validators.status, req.body);
  const row = Reports.setStatus(req.report.id, status, req.user.id);
  res.json(Reports.toDto(row, req.user, { includeContact: true }));
}

function update(req, res) {
  const data = parse(validators.updateReport, req.body);
  const row = Reports.update(req.report.id, data, req.user.id);
  res.json(Reports.toDto(row, req.user, { includeContact: true }));
}

function remove(req, res) {
  Reports.softDelete(req.report.id, req.user.id);
  res.json({ ok: true });
}

module.exports = { list, get, create, update, setStatus, remove };
