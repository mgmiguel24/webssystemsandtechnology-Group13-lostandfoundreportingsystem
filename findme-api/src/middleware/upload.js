const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config/env');
const { HttpError } = require('../utils/http');

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype]}`),
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype]
      ? cb(null, true)
      : cb(new HttpError(400, 'Photo must be a JPEG, PNG, WebP or GIF image.')),
});

// The browser's stated file type can be faked, so we also check the file's first bytes.
function looksLikeImage(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  return (
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) || // PNG
    b.subarray(0, 4).toString('ascii') === 'GIF8' || // GIF
    (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') // WebP
  );
}

function removeFile(filePath) {
  if (filePath) fs.unlink(filePath, () => {});
}

module.exports = { upload, looksLikeImage, removeFile };
