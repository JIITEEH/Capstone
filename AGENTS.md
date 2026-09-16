# AGENTS.md

Instructions for AI coding agents working in this repository.

## Git and GitHub rules (mandatory)

### 1. Always confirm before pushing

- **Never run `git push` without explicit confirmation from the user in the current conversation.**
- This applies even when the user asks you to push. Before pushing, tell the user:
  - the exact command you will run (for example, `git push origin development`),
  - the branch you will push to,
  - the commits that will be pushed (`git log origin/<branch>..<branch> --oneline`).
- Then wait for the user to reply with a clear "yes" before running it.
- Approval covers one push only. Every later push needs a fresh confirmation.

### 2. Never push to `main`

- **Do not push to the `main` branch under any circumstances**, even if the user confirms or asks you to.
- This includes `git push origin main`, `git push` while on `main`, `git push origin HEAD:main`, force pushes, and any refspec that updates `main` on the remote.
- Do not merge into `main` locally and push it, and do not change branch protection or the default branch to get around this rule.
- All work goes to `development` (or a feature branch created from it). Changes reach `main` only through a pull request that the user reviews and merges on GitHub.
- If the user asks you to push to `main`, refuse. Explain this rule and offer to push to `development` instead (with confirmation) and open a pull request.

### 3. Before any push, check the current branch

Run `git branch --show-current`. If the result is `main`, stop. Do not push. Switch to `development` first, or ask the user how to proceed.

## Project overview

A Thesis Management System with three roles: Student, Adviser, and Admin.

- `client/`: React frontend (Vite, react-router, lucide-react icons, plain CSS in `src/styles/index.css`)
- `server/`: Express API with SQLite (Node's built-in `node:sqlite`), JWT auth, and multer uploads
- Folder names say what they hold: `api-endpoints/`, `request-handlers/`, `database-queries/`, `database/`, `permission-rules/`, `request-filters/`, `helpers/`. On the client: `screens/`, `ui-pieces/`, `shared-state/`, `api-client/`, `reusable-logic/`, `helpers/`.
- `TROUBLESHOOTING.md` maps symptoms to the files to check; update it when a chain changes.
- Requires Node.js 22.13 or newer. Run `npm install`, `npm run db:seed`, then `npm run dev`.
- See `README.md` for the full structure, permissions, and scripts.

## Permission rules for code changes

- Enforce every permission on the server. Client-side route guards are only for UX.
- Thesis and submission access goes through `server/src/permission-rules/access.js`. Users without access get a 404, not a 403.
- Thesis status is derived from submissions by `Thesis.recomputeStatus()`. Call it after any change to submissions or reviews.
- Keep features role-specific. Reviews and comments belong to the student and adviser. Thesis content belongs to the student. Admins manage users, adviser assignment, status, defenses, and deletion. Update the permissions table in `README.md` when this changes.
- Schedule access goes through `canViewSchedule` and `canManageSchedule` in `permission-rules/access.js`.

## Database rules

- The database is relational SQLite. Keep data normalized: a submission's status comes from the `reviews` table through the `submission_details` view, so don't add a status column back to `submissions`.
- **Never edit an applied migration.** Files in `server/src/database/migrations/` are a history: once a file has run on any database, changing it means databases disagree about their shape. To change the schema, add the next numbered file after the highest one in the folder, for example `009_add_terms.sql`.
- A migration must upgrade an existing database in place (`ALTER TABLE`, `CREATE TABLE`, backfill with `UPDATE`). Never write one that drops and recreates a table holding real data.
- After adding a migration, update `server/src/database/seed.js` and the ER diagram in `README.md` to match.
- `npm run db:seed` deletes the database and all uploads. It is for demo data only, never for applying a schema change.
- `npm run db:backup` copies the database and uploads into `server/backups/`. Take a backup before anything that rewrites data, and keep the restore path working: it is tested in `server/test/backup.test.js`.
