import './setup.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { backupName, createBackup, listBackups, pruneBackups, restoreBackup, syncToRemote } from '../src/database/backup.js';
import { migrate } from '../src/database/migrate.js';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'thesistrack-backup-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

let counter = 0;

// A working system to back up: a database with rows, and an uploads folder with a manuscript
function makeSystem({ students = ['Ana Cruz'] } = {}) {
  const root = path.join(scratch, `system-${++counter}`);
  const databasePath = path.join(root, 'data', 'app.db');
  const uploadDir = path.join(root, 'uploads');
  const backupDir = path.join(root, 'backups');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  const insert = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'x', 'student')");
  students.forEach((name, i) => insert.run(name, `student${i}-${counter}@tms.edu`));
  db.close();

  fs.writeFileSync(path.join(uploadDir, 'manuscript.pdf'), '%PDF-1.7\nchapter one');
  return { root, databasePath, uploadDir, backupDir };
}

function userNames(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return db.prepare('SELECT name FROM users ORDER BY id').all().map((r) => r.name);
  } finally {
    db.close();
  }
}

describe('making a backup', () => {
  it('copies the database and the uploaded manuscripts', () => {
    const system = makeSystem();
    const { folder, manifest } = createBackup(system);

    assert.ok(fs.existsSync(path.join(folder, 'app.db')), 'the database was copied');
    assert.ok(fs.existsSync(path.join(folder, 'uploads', 'manuscript.pdf')), 'the uploads were copied');
    assert.equal(manifest.tables.users, 1);
    assert.equal(manifest.uploads.files, 1);
    assert.ok(manifest.schemaVersion > 0, 'the schema version is recorded');
  });

  it('writes a database that opens and holds the same rows', () => {
    const system = makeSystem({ students: ['Ana Cruz', 'Ben Reyes'] });
    const { folder } = createBackup(system);

    assert.deepEqual(userNames(path.join(folder, 'app.db')), ['Ana Cruz', 'Ben Reyes']);
  });

  it('refuses when there is no database to back up', () => {
    const system = makeSystem();
    fs.rmSync(system.databasePath);
    assert.throws(() => createBackup(system), /no database at/i);
  });

  it('keeps each backup separate', () => {
    const system = makeSystem();
    createBackup({ ...system, date: new Date('2026-09-01T10:00:00Z') });
    createBackup({ ...system, date: new Date('2026-09-02T10:00:00Z') });

    assert.equal(listBackups(system.backupDir).length, 2);
  });
});

describe('pruning old backups', () => {
  it('removes backups past the retention window', () => {
    const system = makeSystem();
    // Keeping 14 days from 16 September puts the cutoff at 2 September
    for (const day of ['2026-08-01', '2026-08-20', '2026-09-10', '2026-09-15']) {
      createBackup({ ...system, date: new Date(`${day}T10:00:00Z`) });
    }

    const removed = pruneBackups({ backupDir: system.backupDir, keepDays: 14, now: new Date('2026-09-16T10:00:00Z') });
    assert.deepEqual(
      removed,
      ['2026-08-01T10-00-00', '2026-08-20T10-00-00'],
      'both August backups are older than the cutoff',
    );
    assert.deepEqual(
      listBackups(system.backupDir).map((b) => b.name),
      ['2026-09-10T10-00-00', '2026-09-15T10-00-00'],
      'September backups stay',
    );
  });

  it('never deletes the newest backup, however old it is', () => {
    const system = makeSystem();
    createBackup({ ...system, date: new Date('2020-01-01T10:00:00Z') });

    const removed = pruneBackups({ backupDir: system.backupDir, keepDays: 14, now: new Date('2026-09-16T10:00:00Z') });
    assert.deepEqual(removed, [], 'an old backup still beats no backup');
    assert.equal(listBackups(system.backupDir).length, 1);
  });
});

describe('restoring a backup', () => {
  it('brings back the rows and the files that were lost', () => {
    const system = makeSystem({ students: ['Ana Cruz', 'Ben Reyes'] });
    const { folder } = createBackup(system);

    // The disaster: the database is wiped and the manuscripts are deleted
    const db = new DatabaseSync(system.databasePath);
    db.exec('DELETE FROM users');
    db.close();
    fs.rmSync(system.uploadDir, { recursive: true, force: true });

    restoreBackup(folder, system);

    assert.deepEqual(userNames(system.databasePath), ['Ana Cruz', 'Ben Reyes'], 'the accounts came back');
    assert.ok(fs.existsSync(path.join(system.uploadDir, 'manuscript.pdf')), 'the manuscript came back');
  });

  it('sets the replaced database aside, so a wrong restore can be undone', () => {
    const system = makeSystem({ students: ['Ana Cruz'] });
    const { folder } = createBackup(system);

    const db = new DatabaseSync(system.databasePath);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Later Student', 'later@tms.edu', 'x', 'student')").run();
    db.close();

    const { replaced } = restoreBackup(folder, { ...system, date: new Date('2026-09-16T12:00:00Z') });

    assert.ok(replaced.database && fs.existsSync(replaced.database), 'the replaced database was kept');
    assert.deepEqual(userNames(replaced.database), ['Ana Cruz', 'Later Student'], 'nothing was lost by restoring');
    assert.deepEqual(userNames(system.databasePath), ['Ana Cruz'], 'and the backup is now live');
  });

  it('refuses a folder that is not a backup', () => {
    const system = makeSystem();
    const notABackup = path.join(scratch, 'not-a-backup');
    fs.mkdirSync(notABackup, { recursive: true });
    assert.throws(() => restoreBackup(notABackup, system), /does not look like a backup/);
  });
});

describe('copying a backup off the machine', () => {
  it('calls rclone with the backup folder and a matching destination', () => {
    const calls = [];
    const result = syncToRemote({
      folder: '/var/app/backups/2026-09-16T02-30-00',
      remote: 'gdrive:thesistrack-backups',
      run: (cmd, args) => {
        calls.push([cmd, args]);
        return { status: 0 };
      },
    });

    assert.deepEqual(calls, [
      [
        'rclone',
        ['copy', '/var/app/backups/2026-09-16T02-30-00', 'gdrive:thesistrack-backups/2026-09-16T02-30-00', '--checksum'],
      ],
    ]);
    assert.equal(result.copiedTo, 'gdrive:thesistrack-backups/2026-09-16T02-30-00');
  });

  it('does nothing when no remote is configured', () => {
    let ran = false;
    const result = syncToRemote({ folder: '/tmp/backup', remote: '', run: () => { ran = true; return { status: 0 }; } });

    assert.equal(ran, false, 'rclone is never called without a destination');
    assert.match(result.skipped, /BACKUP_REMOTE/);
  });

  it('says so plainly when rclone is missing, without failing the local backup', () => {
    const result = syncToRemote({
      folder: '/tmp/backup',
      remote: 'gdrive:backups',
      run: () => ({ error: Object.assign(new Error('spawn rclone ENOENT'), { code: 'ENOENT' }) }),
    });

    assert.match(result.failed, /not installed/);
    assert.ok(!result.copiedTo);
  });

  it('reports what rclone complained about', () => {
    const result = syncToRemote({
      folder: '/tmp/backup',
      remote: 'gdrive:backups',
      run: () => ({ status: 1, stderr: 'ERROR: didn\'t find section in config file\n' }),
    });

    assert.match(result.failed, /didn't find section in config file/);
  });

  it('tolerates a trailing slash on the destination', () => {
    const calls = [];
    syncToRemote({
      folder: '/var/backups/2026-09-16T02-30-00',
      remote: 'b2:thesis-backups/',
      run: (cmd, args) => { calls.push(args[2]); return { status: 0 }; },
    });

    assert.equal(calls[0], 'b2:thesis-backups/2026-09-16T02-30-00', 'no doubled slash');
  });
});

describe('backup names', () => {
  it('sort oldest to newest and are safe as folder names', () => {
    const names = [
      backupName(new Date('2026-09-16T17:30:45Z')),
      backupName(new Date('2026-01-02T03:04:05Z')),
    ].sort();
    assert.deepEqual(names, ['2026-01-02T03-04-05', '2026-09-16T17-30-45']);
    assert.ok(!names.some((n) => n.includes(':')), 'no colons: Windows cannot use them in a path');
  });
});
