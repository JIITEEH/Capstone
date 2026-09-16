# Troubleshooting map

When something breaks, start at the symptom below and follow the files in order. Each chain is the
actual path a request takes, so checking them in order finds the problem faster than searching.

Run `npm run dev` and keep two things open: the terminal (server errors) and the browser console
(page errors). Most problems announce themselves in one of the two.

## Where things live

**Server** — `server/src/`

| Folder | What it holds | Check it when |
| --- | --- | --- |
| `api-endpoints/` | The URL list. Which address maps to which handler, and which roles may call it. | A request returns 404, or the wrong role can reach something |
| `request-handlers/` | What happens for one request: reads input, checks the rules, replies. | The API answers, but with the wrong data or error |
| `database-queries/` | The SQL. One file per table. | Data is missing, duplicated, or stale |
| `database/` | Connection, migrations, demo data. | The server won't start, or the schema changed |
| `permission-rules/` | Who may see and change each record. | Someone sees too much, or gets a wrong 404 |
| `request-filters/` | Runs before handlers: sign-in check, uploads, rate limits, security headers, errors. | Everything fails the same way, regardless of endpoint |
| `helpers/` | Passwords, validation, files, file signatures, error shapes. | Small shared behaviour looks wrong |
| `config/` | Settings read from `.env`. | A path, port, secret, or limit is wrong |

**Website** — `client/src/`

| Folder | What it holds | Check it when |
| --- | --- | --- |
| `screens/` | One file per page, grouped by role. | A whole page is wrong or missing |
| `ui-pieces/` | Reusable parts: `layout/`, `basics/`, `thesis/`, `schedule/`, `dashboard/`, `auth/`. | One widget misbehaves on several pages |
| `shared-state/` | Who is signed in, and toast messages. | Sign-in state or notifications look wrong everywhere |
| `api-client/` | The single file that talks to the server. | Every request fails, or the token isn't sent |
| `reusable-logic/` | Shared loading/error handling for pages. | Pages hang on "loading" or never show errors |
| `helpers/` | Date and text formatting, shared labels. | Dates or labels are formatted wrong |
| `styles/` | The whole stylesheet. | Something looks wrong but works |

---

## Symptoms

### "I can't sign in"

1. `server/src/api-endpoints/authRoutes.js` — is `POST /auth/login` listed?
2. `server/src/request-handlers/authController.js` → `login` — the password check and the error text.
3. `server/src/helpers/password.js` — how hashes are compared.
4. `server/src/request-filters/rateLimit.js` — after 10 wrong passwords in 15 minutes the account is locked out. Wait, or restart the server to clear it.
5. Wrong password for the admin? It is **not** `password123`. Set `SEED_ADMIN_PASSWORD` in `server/.env` and re-seed, or copy the random one the seed printed.

### "It signs me out by itself"

1. `client/src/api-client/api.js` — the token is kept in `localStorage` ("keep me signed in") or `sessionStorage` otherwise. Closing the tab clears the second.
2. `server/src/request-filters/auth.js` — a token is rejected when it expired, or when the account was deactivated or deleted.
3. `server/src/config/index.js` — sessions last 12 hours, or 30 days with "keep me signed in".

### "My upload is refused"

1. **"That file isn't a valid PDF, DOC, or DOCX"** — the file's contents don't match its name. Open it; if it really is a PDF, re-export it. See `server/src/request-filters/upload.js` and `server/src/helpers/fileSignature.js`.
2. **"Only PDF, DOC, or DOCX files are allowed"** — wrong extension. Same file.
3. **"File must be 50 MB or smaller"** — the limit is `maxUploadBytes` in `server/src/config/index.js`, and the matching number in `client/src/ui-pieces/thesis/SubmissionForm.jsx`. Change both.
4. The file uploads but the page shows an error — `server/src/request-handlers/thesisController.js` → `createSubmission` rejects it after upload and deletes the file.

### "The New submission button is greyed out"

Only one submission may be pending at a time, and stages unlock in order.

1. `client/src/screens/ThesisDetail.jsx` — the `canSubmit` line shows every condition.
2. Most often: an earlier submission is still **pending**. The adviser must review it first.
3. Also blocked when the thesis is `completed`, or when all four stages are approved.
4. The same rules are enforced in `server/src/request-handlers/thesisController.js` → `createSubmission`, so removing the button would not help.

### "It says not found, but the thesis exists"

That is deliberate: people outside a thesis get 404, never 403, so they cannot confirm it exists.

1. `server/src/permission-rules/access.js` — `canViewThesis`, `getAccessibleThesis`.
2. Check the signed-in user really is a member: `thesis_members` in the database.
3. Advisers only see theses assigned to them; admins see all.

### "The page is blank / white"

1. Open the browser console. The error names the file.
2. If you see "Something went wrong on this page", the error boundary caught it — `client/src/ui-pieces/basics/ErrorBoundary.jsx`. The real cause is in the console.
3. A blank page with no message usually means the API returned something the page did not expect. Check the Network tab, then the matching file in `request-handlers/`.

### "The server won't start"

1. **"This database is at schema version N, but the code only knows up to M"** — your database is newer than your code. Pull the latest code.
2. **"JWT_SECRET must be set in production"** — set it in `server/.env`.
3. **Port in use** — something else is on 3001. Stop it, or set `PORT` in `server/.env`.
4. **A migration failed** — the message names the file. The database rolled back to its last good version; fix the SQL in `server/src/database/migrations/` and start again.

### "I changed the schema"

1. Add the next numbered file to `server/src/database/migrations/`, e.g. `005_add_notifications.sql`.
2. Restart. The server applies it and prints `Database upgraded: applied 005_...`.
3. **Do not run `npm run db:seed` to apply a schema change** — it deletes every account, thesis, and upload. It is for demo data only.
4. Update the matching query file in `database-queries/` and the ER diagram in `README.md`.

### "Too many attempts" (429)

`server/src/request-filters/rateLimit.js`. Limits count failures per account, not per network, so a
full computer lab is never locked out together. Restarting the server clears the counters.

### "The notification bell is empty"

Expected today. It only lists upcoming consultations and defenses — see
`client/src/ui-pieces/layout/Notifications.jsx`. Reviews, comments, and group changes produce no
alert yet; that is finding A2 on the roadmap.

### "Tests or CI are failing"

1. Run `npm test` locally; the output names the file and line.
2. `npm run lint` must pass with zero warnings, or CI fails even when tests pass.
3. Tests use a throwaway database in the system temp folder, never `server/data/app.db`. A failing
   test cannot damage your real data.
4. After renaming or moving a file, check `client/test/` and `server/test/` too — their imports point
   into `src/`.

### "Something looks wrong but works"

Everything visual is in `client/src/styles/index.css`. Search for the class name you see in the
browser inspector. The login page's entrance animation is near the `.auth-*` rules.

---

## Two commands worth remembering

```bash
npm run dev       # API and website together, with reload
npm test          # everything; run before committing
```

And the one to be careful with:

```bash
npm run db:seed   # DELETES the database and all uploads, then loads demo data
```
