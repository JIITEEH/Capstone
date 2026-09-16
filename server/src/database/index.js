import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import config from '../config/index.js';
import { migrate } from './migrate.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA foreign_keys = ON;');

// Upgrades the database in place. Existing accounts, theses, and uploads are kept.
const applied = migrate(db);
if (applied.length > 0 && config.env !== 'test') {
  console.log(`Database upgraded: applied ${applied.map(({ name }) => name).join(', ')}`);
}

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
