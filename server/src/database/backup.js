// Copies the database and the uploaded manuscripts into a timestamped folder, and deletes
// backups older than the retention window.
//
// Run with: npm run db:backup          make a backup, then prune old ones
//           npm run db:backup -- --list        show what is stored
//           npm run db:backup -- --restore <folder>   put a backup back
//
// Each backup is one folder holding everything needed to bring the system back:
//
//   server/backups/2026-09-16T17-30-45/
//     app.db          the database, copied with VACUUM INTO
//     uploads/        every manuscript
//     manifest.json   what was in it, for checking a backup before trusting it
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import config from '../config/index.js';

const COUNTED_TABLES = ['users', 'theses', 'submissions', 'reviews', 'comments', 'schedules'];

// Sortable, filename-safe, and readable: 2026-09-16T17-30-45
export function backupName(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/:/g, '-');
}

function folderSize(dir) {
  if (!fs.existsSync(dir)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    files += 1;
    bytes += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return { files, bytes };
}

export function createBackup({
  databasePath = config.databasePath,
  uploadDir = config.uploadDir,
  backupDir = config.backupDir,
  date = new Date(),
} = {}) {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`There is no database at ${databasePath}, so there is nothing to back up.`);
  }

  // Names are second-resolution, so two runs in the same second would collide. Take the next
  // free name instead of failing: someone running the command twice should get two backups.
  const base = path.join(backupDir, backupName(date));
  let folder = base;
  for (let attempt = 2; fs.existsSync(folder); attempt += 1) {
    folder = `${base}-${attempt}`;
  }
  fs.mkdirSync(folder, { recursive: true });

  // VACUUM INTO writes a consistent copy even while the server is using the database.
  // Copying the file directly can catch it mid-write and produce a backup that won't open.
  const source = new DatabaseSync(databasePath);
  let schemaVersion = 0;
  const tables = {};
  try {
    const target = path.join(folder, 'app.db').replace(/'/g, "''");
    source.exec(`VACUUM INTO '${target}'`);
    schemaVersion = source.prepare('PRAGMA user_version').get().user_version;
    for (const table of COUNTED_TABLES) {
      try {
        tables[table] = source.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
      } catch {
        // A table added in a later migration than this database has
      }
    }
  } finally {
    source.close();
  }

  const uploadsTarget = path.join(folder, 'uploads');
  if (fs.existsSync(uploadDir)) {
    fs.cpSync(uploadDir, uploadsTarget, { recursive: true });
  } else {
    fs.mkdirSync(uploadsTarget, { recursive: true });
  }

  const uploads = folderSize(uploadsTarget);
  const manifest = {
    createdAt: date.toISOString(),
    schemaVersion,
    tables,
    uploads,
    databaseBytes: fs.statSync(path.join(folder, 'app.db')).size,
  };
  fs.writeFileSync(path.join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  return { folder, manifest };
}

export function listBackups(backupDir = config.backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(backupDir, entry.name, 'app.db')))
    .map((entry) => {
      const folder = path.join(backupDir, entry.name);
      let manifest = null;
      try {
        manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
      } catch {
        // A backup without a readable manifest is still a backup
      }
      return { name: entry.name, folder, manifest, createdAt: manifest?.createdAt ?? fs.statSync(folder).mtime.toISOString() };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Deletes backups older than the retention window, but never the newest one: an old backup is
// better than none if backups have silently stopped running.
export function pruneBackups({ backupDir = config.backupDir, keepDays = config.backupKeepDays, now = new Date() } = {}) {
  const backups = listBackups(backupDir);
  if (backups.length <= 1) return [];

  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const backup of backups.slice(0, -1)) {
    if (new Date(backup.createdAt).getTime() >= cutoff) continue;
    fs.rmSync(backup.folder, { recursive: true, force: true });
    removed.push(backup.name);
  }
  return removed;
}

// Finds the folder someone typed after --restore. npm runs this script from server/, so a path
// copied from the README (server/backups/...) is relative to where they typed it, which npm passes
// as INIT_CWD. A bare backup name is looked up in the backup directory.
export function resolveBackupFolder(target, {
  typedFrom = process.env.INIT_CWD || process.cwd(),
  scriptCwd = process.cwd(),
  backupDir = config.backupDir,
} = {}) {
  const candidates = [
    path.resolve(typedFrom, target),
    path.resolve(scriptCwd, target),
    path.join(backupDir, path.basename(target)),
  ];
  return candidates.find((folder) => fs.existsSync(path.join(folder, 'app.db'))) ?? candidates[0];
}

// Puts a backup back. The current database and uploads are set aside first, so a restore of the
// wrong backup can itself be undone.
export function restoreBackup(folder, {
  databasePath = config.databasePath,
  uploadDir = config.uploadDir,
  date = new Date(),
} = {}) {
  const backupDb = path.join(folder, 'app.db');
  if (!fs.existsSync(backupDb)) {
    throw new Error(`${folder} does not look like a backup: no app.db inside it.`);
  }

  const stamp = backupName(date);
  const replaced = {};

  if (fs.existsSync(databasePath)) {
    replaced.database = `${databasePath}.replaced-${stamp}`;
    fs.copyFileSync(databasePath, replaced.database);
  }
  if (fs.existsSync(uploadDir)) {
    replaced.uploads = `${uploadDir}-replaced-${stamp}`;
    fs.cpSync(uploadDir, replaced.uploads, { recursive: true });
  }

  // Old write-ahead files would otherwise be replayed over the restored database
  for (const suffix of ['-wal', '-shm', '-journal']) {
    fs.rmSync(databasePath + suffix, { force: true });
  }
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.copyFileSync(backupDb, databasePath);

  fs.rmSync(uploadDir, { recursive: true, force: true });
  const backupUploads = path.join(folder, 'uploads');
  if (fs.existsSync(backupUploads)) {
    fs.cpSync(backupUploads, uploadDir, { recursive: true });
  } else {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return { restoredFrom: folder, replaced };
}

// Copies one backup folder off the machine with rclone, which talks to Google Drive, Backblaze
// B2, Dropbox, and most other storage. Local backups survive a mistake or a corrupted file; only
// an off-machine copy survives losing the machine itself.
//
// `run` is injectable so the tests can check the command without needing rclone installed.
export function syncToRemote({
  folder,
  remote = config.backupRemote,
  run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' }),
} = {}) {
  if (!remote) return { skipped: 'no BACKUP_REMOTE set' };

  const destination = `${remote.replace(/\/+$/, '')}/${path.basename(folder)}`;
  const result = run('rclone', ['copy', folder, destination, '--checksum']);

  if (result.error?.code === 'ENOENT') {
    return { failed: 'rclone is not installed, so the backup stayed on this machine', destination };
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().split('\n').at(-1) ?? `exit code ${result.status}`;
    return { failed: detail, destination };
  }
  return { copiedTo: destination };
}

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log(`No backups yet in ${config.backupDir}. Run "npm run db:backup" to make one.`);
    } else {
      console.log(`${backups.length} backup(s) in ${config.backupDir}:\n`);
      for (const { name, manifest } of backups) {
        const counts = manifest?.tables ?? {};
        console.log(
          `  ${name}  ${mb(manifest?.databaseBytes ?? 0)} database, ${manifest?.uploads?.files ?? '?'} file(s)` +
            `  users:${counts.users ?? '?'} theses:${counts.theses ?? '?'} submissions:${counts.submissions ?? '?'}`,
        );
      }
    }
  } else if (args[0] === '--restore') {
    const target = args[1];
    if (!target) {
      console.error('Which backup? Run "npm run db:backup -- --list" to see them, then');
      console.error('  npm run db:backup -- --restore 2026-09-16T17-30-45');
      process.exit(1);
    }
    const folder = resolveBackupFolder(target);
    const { replaced } = restoreBackup(folder);
    console.log(`Restored from ${folder}`);
    if (replaced.database) console.log(`  The database that was there is kept at ${replaced.database}`);
    if (replaced.uploads) console.log(`  The uploads that were there are kept at ${replaced.uploads}`);
    console.log('  Restart the server so it opens the restored database.');
  } else {
    const { folder, manifest } = createBackup();
    console.log(`Backed up to ${folder}`);
    console.log(
      `  ${mb(manifest.databaseBytes)} database (schema version ${manifest.schemaVersion}), ` +
        `${manifest.uploads.files} uploaded file(s), ${mb(manifest.uploads.bytes)}`,
    );
    console.log(
      `  users: ${manifest.tables.users ?? 0}, theses: ${manifest.tables.theses ?? 0}, ` +
        `submissions: ${manifest.tables.submissions ?? 0}`,
    );

    const removed = pruneBackups();
    if (removed.length > 0) {
      console.log(`  Removed ${removed.length} backup(s) older than ${config.backupKeepDays} days: ${removed.join(', ')}`);
    }

    const sync = syncToRemote({ folder });
    if (sync.copiedTo) {
      console.log(`  Copied off this machine to ${sync.copiedTo}`);
    } else if (sync.failed) {
      // The local backup worked, so this is a warning, not a failure
      console.warn(`  Could not copy off this machine: ${sync.failed}`);
      console.warn('  The backup is safe on this disk, but not if the machine is lost.');
    } else {
      console.log('  Kept on this machine only. Set BACKUP_REMOTE to copy it off (see README).');
    }
  }
}

export const MODULE_PATH = fileURLToPath(import.meta.url);
