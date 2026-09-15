// Imported first by every test file. Points the server at a throwaway database and upload folder
// before the config module reads these settings, so tests never touch real data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thesistrack-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
process.env.JWT_SECRET = 'test-only-secret';
