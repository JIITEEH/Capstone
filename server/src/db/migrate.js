// Applies numbered migration files in order, so a schema change upgrades an existing database
// instead of requiring it to be wiped and rebuilt.
//
// Each file in migrations/ is named NNN_description.sql. The number is the schema version it
// produces. SQLite stores the version a database has reached in PRAGMA user_version, so the runner
// applies only the files numbered above it, each inside its own transaction: a migration either
// lands completely or not at all.
//
// The baseline is numbered 004 because databases built by the old "rebuild on every change" scheme
// already report user_version = 4. They skip the baseline and keep their data; a fresh database
// applies it and arrives at the same place.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const FILE_PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;

// Every migration file, oldest first
export function listMigrations(dir = MIGRATIONS_DIR) {
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql'));

  const migrations = files.map((name) => {
    const match = FILE_PATTERN.exec(name);
    if (!match) {
      throw new Error(`Migration "${name}" must be named like 005_add_notifications.sql`);
    }
    return { version: Number(match[1]), name, file: path.join(dir, name) };
  });

  migrations.sort((a, b) => a.version - b.version);

  migrations.forEach((migration, index) => {
    if (index > 0 && migration.version === migrations[index - 1].version) {
      throw new Error(`Two migrations share version ${migration.version}: ${migrations[index - 1].name} and ${migration.name}`);
    }
  });

  return migrations;
}

export function currentVersion(db) {
  return db.prepare('PRAGMA user_version').get().user_version;
}

// Brings the database up to the newest migration. Returns the ones it applied.
export function migrate(db, dir = MIGRATIONS_DIR) {
  const migrations = listMigrations(dir);
  const latest = migrations.at(-1)?.version ?? 0;
  const startingVersion = currentVersion(db);

  // A database from a newer checkout has tables this code doesn't know about. Stop rather than
  // run against a shape we can't reason about.
  if (startingVersion > latest) {
    throw new Error(
      `This database is at schema version ${startingVersion}, but the code only knows up to ${latest}. ` +
        'Update the code, or restore a backup taken before the upgrade.',
    );
  }

  const applied = [];
  for (const migration of migrations) {
    if (migration.version <= startingVersion) continue;

    const sql = fs.readFileSync(migration.file, 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      // user_version lives in the database header and is part of the transaction
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${migration.name} failed and was rolled back: ${err.message}`);
    }
    applied.push(migration);
  }

  return applied;
}
