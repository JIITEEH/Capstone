import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import multer from 'multer';
import config from '../config/index.js';
import { ALLOWED_UPLOAD_EXTENSIONS } from '../constants.js';
import { detectType, readHeader, TYPE_BY_EXTENSION, TYPE_LABELS } from '../utils/fileSignature.js';
import { HttpError } from '../utils/httpError.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

// What a browser says a manuscript is. The browser is not trusted, so this only turns away the
// obvious cases early; verifyUploadContents below is what actually decides.
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Some browsers send nothing useful for a .doc or .docx
  'application/octet-stream',
];

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // The server names the file, so an uploaded name can never become a path or a script
    cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
  },
});

export const uploadManuscript = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return cb(new HttpError(400, 'Only PDF, DOC, or DOCX files are allowed'));
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new HttpError(400, 'Only PDF, DOC, or DOCX files are allowed'));
    }
    cb(null, true);
  },
}).single('file');

// Reads the first bytes of the file that was just written and refuses anything whose contents
// don't match its extension. Runs after uploadManuscript, before the submission is created.
export async function verifyUploadContents(req, res, next) {
  const file = req.file;
  if (!file) return next();

  try {
    const expected = TYPE_BY_EXTENSION[path.extname(file.originalname).toLowerCase()];
    const actual = detectType(await readHeader(file.path));

    if (!actual) {
      throw new HttpError(
        400,
        "That file isn't a valid PDF, DOC, or DOCX. If you renamed it, export it again from your word processor.",
      );
    }
    if (actual !== expected) {
      throw new HttpError(
        400,
        `This file is named like a ${TYPE_LABELS[expected]} but its contents are a ${TYPE_LABELS[actual]}. ` +
          'Upload it with the matching file type.',
      );
    }
    next();
  } catch (err) {
    // A rejected file never stays on disk
    fs.rmSync(file.path, { force: true });
    req.file = undefined;
    next(err);
  }
}
