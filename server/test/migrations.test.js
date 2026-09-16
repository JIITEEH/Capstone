import './setup.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { currentVersion, listMigrations, migrate, MIGRATIONS_DIR } from '../src/db/migrate.js';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'thesistrack-migrations-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
function freshDb() {
  const db = new DatabaseSync(path.join(scratch, `db-${++counter}.sqlite`));
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

// Writes migration files into their own folder so tests don't depend on the real ones
function fakeMigrations(files) {
  const dir = fs.mkdtempSync(path.join(scratch, 'set-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

describe('the project migrations', () => {
  it('are numbered, unique, and start at the 004 baseline', () => {
    const migrations = listMigrations();
    assert.ok(migrations.length > 0);
    assert.equal(migrations[0].version, 4, 'the baseline matches databases built by the old scheme');
    const versions = migrations.map((m) => m.version);
    assert.deepEqual(versions, [...new Set(versions)].sort((a, b) => a - b));
  });

  it('build a complete database from empty', () => {
    const db = freshDb();
    migrate(db, MIGRATIONS_DIR);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    for (const table of ['users', 'theses', 'thesis_members', 'submissions', 'reviews', 'schedules']) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }
    assert.equal(currentVersion(db), listMigrations().at(-1).version);
  });

  it('do nothing the second time they run', () => {
    const db = freshDb();
    const first = migrate(db, MIGRATIONS_DIR);
    const second = migrate(db, MIGRATIONS_DIR);
    assert.ok(first.length > 0);
    assert.deepEqual(second, [], 'an up-to-date database is left alone');
  });

  it('leave a database already at version 4 untouched, with its rows intact', () => {
    // Stands in for a database created by the old rebuild-on-every-change scheme
    const db = freshDb();
    migrate(db, MIGRATIONS_DIR);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Ana', 'ana@tms.edu', 'x', 'student')").run();

    const applied = migrate(db, MIGRATIONS_DIR);
    assert.deepEqual(applied, []);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
  });
});

describe('the migration runner', () => {
  it('applies files in order and keeps existing rows', () => {
    const dir = fakeMigrations({
      '001_people.sql': 'CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL);',
      '002_add_email.sql': "ALTER TABLE people ADD COLUMN email TEXT NOT NULL DEFAULT '';",
    });
    const db = freshDb();

    // Stop after the first migration, add a row, then let the second one run
    migrate(db, fakeMigrations({ '001_people.sql': fs.readFileSync(path.join(dir, '001_people.sql'), 'utf8') }));
    db.prepare("INSERT INTO people (name) VALUES ('Ana')").run();

    const applied = migrate(db, dir);
    assert.deepEqual(applied.map((m) => m.version), [2], 'only the new migration runs');

    const row = db.prepare('SELECT name, email FROM people').get();
    assert.equal(row.name, 'Ana', 'the row survived the schema change');
    assert.equal(row.email, '');
    assert.equal(currentVersion(db), 2);
  });

  it('rolls a failed migration back and leaves the version alone', () => {
    const dir = fakeMigrations({
      '001_people.sql': 'CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL);',
      '002_broken.sql': "CREATE TABLE pets (id INTEGER PRIMARY KEY);\nTHIS IS NOT SQL;",
    });
    const db = freshDb();

    assert.throws(() => migrate(db, dir), /002_broken\.sql failed and was rolled back/);
    assert.equal(currentVersion(db), 1, 'the database stays on the last good version');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
    assert.ok(!tables.includes('pets'), 'nothing from the failed migration was kept');
  });

  it('refuses a database newer than the code', () => {
    const dir = fakeMigrations({ '001_people.sql': 'CREATE TABLE people (id INTEGER PRIMARY KEY);' });
    const db = freshDb();
    db.exec('PRAGMA user_version = 99');

    assert.throws(() => migrate(db, dir), /only knows up to 1/);
  });

  it('rejects a badly named migration file', () => {
    const dir = fakeMigrations({ 'add-notifications.sql': 'SELECT 1;' });
    assert.throws(() => listMigrations(dir), /must be named like/);
  });

  it('refuses two migrations with the same number', () => {
    const dir = fakeMigrations({ '001_a.sql': 'SELECT 1;', '001_b.sql': 'SELECT 1;' });
    assert.throws(() => listMigrations(dir), /share version 1/);
  });
});
