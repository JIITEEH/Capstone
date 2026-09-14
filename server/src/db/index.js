import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import config from '../config/index.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA foreign_keys = ON;');

// Create tables on startup (schema.sql uses CREATE TABLE IF NOT EXISTS)
const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

export default db;
