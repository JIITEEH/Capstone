import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// TRUST_PROXY tells Express how far to believe X-Forwarded-For. Unset is safest when the app faces
// the internet directly; behind nginx or a hosting platform, set it to the number of proxies (1).
function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // 'loopback', a subnet, or a comma-separated list of addresses
}
const env = process.env.NODE_ENV || 'development';

if (env === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const config = {
  port: Number(process.env.PORT) || 3001,
  env,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Relative paths resolve from the server/ folder, whatever directory you run from
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH || './data/app.db'),
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads'),
  // Where "npm run db:backup" writes, and how long a backup is kept
  backupDir: path.resolve(serverRoot, process.env.BACKUP_DIR || './backups'),
  backupKeepDays: Number(process.env.BACKUP_KEEP_DAYS) || 14,
  // An rclone destination such as "gdrive:thesistrack-backups". Empty means local backups only,
  // which do not survive losing the machine.
  backupRemote: process.env.BACKUP_REMOTE || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  // "Keep me signed in" gets the longer session
  jwtExpiresIn: '12h',
  jwtRememberExpiresIn: '30d',
  // Leaves room for image-heavy final manuscripts and scanned pages
  maxUploadBytes: 50 * 1024 * 1024,
};

export default config;
