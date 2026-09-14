import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = process.env.NODE_ENV || 'development';

if (env === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const config = {
  port: Number(process.env.PORT) || 3001,
  env,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Relative paths resolve from the server/ folder, whatever directory you run from
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH || './data/app.db'),
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads'),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: '7d',
  maxUploadBytes: 20 * 1024 * 1024,
};

export default config;
