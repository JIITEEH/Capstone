import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import config from '../config/index.js';

// Bump when schema.sql changes so existing databases get rebuilt instead of silently breaking
const SCHEMA_VERSION = 3;

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA foreign_keys = ON;');

const hasTables = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
const { user_version: currentVersion } = db.prepare('PRAGMA user_version').get();
if (hasTables && currentVersion !== SCHEMA_VERSION) {
  throw new Error(
    `The database schema is out of date (version ${currentVersion}, expected ${SCHEMA_VERSION}). ` +
      'Run "npm run db:seed" to rebuild it.',
  );
}

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
db.exec(fs.readFileSync(schemaPath, 'utf8'));
db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export default db;
