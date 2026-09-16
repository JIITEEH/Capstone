// Starts ThesisTrack for the browser smoke tests: a production server on its own port, serving the
// built client, over a freshly seeded database in a temporary folder. The real database, uploads, and
// server/.env are never touched. Playwright starts this before the tests and stops it afterwards.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, PORT } from './settings.mjs';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../server');
// One fixed folder, emptied at the start of every run. Playwright may stop this script too abruptly
// to clean up after itself, so the next run does it instead.
const tempDir = path.join(os.tmpdir(), 'thesistrack-e2e');
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

// No --env-file here on purpose: server/.env holds real settings (mail, backups) the tests must not use
const env = {
  ...process.env,
  NODE_ENV: 'production',
  JWT_SECRET: 'e2e-only-secret',
  PORT: String(PORT),
  CLIENT_ORIGIN: `http://localhost:${PORT}`,
  DATABASE_PATH: path.join(tempDir, 'app.db'),
  UPLOAD_DIR: path.join(tempDir, 'uploads'),
  BACKUP_REMOTE: '',
  SMTP_HOST: '',
  SEED_ALLOW_PRODUCTION: 'yes',
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
};

const seed = spawnSync(process.execPath, ['src/database/seed.js'], { cwd: serverDir, env, stdio: 'inherit' });
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env, stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
server.on('exit', (code) => process.exit(code ?? 0));
