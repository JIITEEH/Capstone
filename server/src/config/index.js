import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const config = {
  port: Number(process.env.PORT) || 3001,
  env: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Relative paths resolve from the server/ folder, whatever directory you run from
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH || './data/app.db'),
};

export default config;
