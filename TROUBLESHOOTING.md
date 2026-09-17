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

### "The browser smoke tests fail" (`npm run test:e2e`)

They sign in as the demo student, adviser, and admin and open every page at desktop and phone size, on a
freshly seeded throwaway database (port 3100). Your real database and `server/.env` aren't used.

1. The failing step names the page and the reason: a crash, a console error, a server error, or sideways
   scrolling on a phone.
2. "Chrome not found": install Google Chrome. The tests use it instead of downloading a browser.
3. "Port 3100 is already in use": a previous run is still going. Stop it and run again.
4. In CI, the HTML report is attached to the failed run as `playwright-report`.
5. Code: `client/e2e/smoke.spec.js`, `client/e2e/start-server.mjs`, `client/playwright.config.js`.

### "The server won't start"

1. **"This database is at schema version N, but the code only knows up to M"** — your database is newer than your code. Pull the latest code.
2. **"JWT_SECRET must be set in production"** — set it in `server/.env`.
3. **Port in use** — something else is on 3001. Stop it, or set `PORT` in `server/.env`.
4. **A migration failed** — the message names the file. The database rolled back to its last good version; fix the SQL in `server/src/database/migrations/` and start again.

### "I changed the schema"

1. Add the next numbered file to `server/src/database/migrations/`, e.g. `009_add_terms.sql`. Check the folder for the highest number first.
2. Restart. The server applies it and prints `Database upgraded: applied 009_...`.
3. **Do not run `npm run db:seed` to apply a schema change** — it deletes every account, thesis, and upload. It is for demo data only.
4. Update the matching query file in `database-queries/` and the ER diagram in `README.md`.

### "Too many attempts" (429)

`server/src/request-filters/rateLimit.js`. Limits count failures per account, not per network, so a
full computer lab is never locked out together. Restarting the server clears the counters.

### "A notification didn't arrive" or "the bell count looks wrong"

1. **You never get notified about your own action.** Submitting, reviewing, or commenting tells the
   other people involved, not you. That is deliberate.
2. `server/src/database-queries/notificationModel.js` — `notify` decides recipients; `thesisParticipants`
   is the students plus the adviser.
3. Each event notifies from its handler: submissions and group changes in `request-handlers/thesisController.js`,
   reviews and comments in `submissionController.js`, events in `scheduleController.js`, verdicts in
   `defenseController.js`. Search for `Notification.notify`.
4. A refused action (400, 403, 409) sends nothing, because the notification is in the same transaction.
5. The bell refreshes every 60 seconds while the tab is visible — `client/src/ui-pieces/layout/Notifications.jsx`.

### "A group wasn't reminded about a deadline"

1. Reminders come from `npm run reminders`, not the running server. Check that the cron line in
   `DEPLOYMENT.md` section 9 exists, and read `server/backups/reminders.log`.
2. Only the group's **next** deadline is reminded: the earliest stage with a due date and nothing submitted.
   No term, a completed thesis, or a stage already submitted means no reminder. See "A thesis shows no deadline".
3. Timing: 3 days before the date, and once the date has passed. Overdue reminders stop 7 days after the date.
4. Each reminder is sent once, recorded in `deadline_reminders`. Moving the due date allows a new one.
5. On the bell but no email? Email follows "Password reset emails never arrive" below. Failed emails are
   listed in the log and not retried.
6. Code: `server/src/database/reminders.js` (words, email, sending), `database-queries/reminderModel.js`
   (`owed`: who is due), `helpers/email.js` → `deadlineReminderEmail`.

### "Password reset emails never arrive"

1. Sign in as an admin and choose **Send test email** on the dashboard's **Email** card. It says what the
   mail server objected to. The server log also shows `Email is not working` at startup, and `Could not email`
   with the reason for each failed send.
2. `SMTP_HOST` unset in `server/.env` means nothing is sent. In development the email is printed to the
   console instead; in production the server warns at startup.
3. With Gmail, `SMTP_PASS` must be an **app password**, not the account password. See `DEPLOYMENT.md`, section 4.
4. Look in spam. The request page answers the same way whether or not the email exists or sent, on purpose.
5. Code: `server/src/helpers/email.js`, called from `request-handlers/authController.js` → `forgotPassword`.
   The admin check is `request-handlers/emailController.js`; client `ui-pieces/dashboard/EmailStatusCard.jsx`.

### "A new student can't start a thesis" or "I can't invite a classmate to my group"

They haven't verified their email yet. Students who sign up must open the link in their verification
email first. Accounts made by an admin don't need this.

1. On their thesis page they can choose **Send a new link**. Links expire after 48 hours.
2. No email arriving? It's the same mail setup as password resets; see the entry above.
3. Sign-up refused with "Sign up with your school email address"? `ALLOWED_EMAIL_DOMAINS` in `server/.env`
   limits which domains may register.
4. Code: `server/src/request-handlers/authController.js` → `register`, `verifyEmail`, `resendVerification`;
   the checks in `thesisController.js` → `createThesis`, `inviteMember`, and `addMember`.

### "My classmate can't accept the group invitation" or "The invite button is gone"

Leaders invite; classmates join by choosing **Accept** on their My Thesis page. Admins add students directly.

1. "You're already in a thesis group": the classmate must leave their current group first. The leader is
   never told this, on purpose, so leaders can't find out who is already taken.
2. "This group already has 5 students": seats filled while the invitation was waiting, often by an admin.
3. No invite form, or "full, counting invitations": pending invitations hold seats. Cancel stale ones with
   the × next to the name marked **Invited**.
4. Invitation not showing? It disappears once answered, cancelled, or when the classmate accepts another group.
5. Code: `server/src/request-handlers/invitationController.js` (accept, decline),
   `thesisController.js` → `inviteMember`, `cancelInvitation`; client `ui-pieces/thesis/GroupMembers.jsx`
   and `GroupInvitations.jsx`.

### "A thesis shows no deadline" or "A group is overdue when it shouldn't be"

Deadlines come from the thesis's term. Admins manage terms on the **Terms** page.

1. No deadline? The thesis has no term (theses created before terms existed don't), or its term has no
   due date left for a stage the group hasn't submitted. Pick a term under **Admin controls** on the thesis.
2. New theses join the **current** term. If none is current, they get no term.
3. Overdue means: that stage's due date has passed and the group has submitted nothing for it. A submission
   waiting for review counts as submitted.
4. Off by a day? The server decides when a day ends. Set `TZ` to the school's time zone; see `DEPLOYMENT.md`.
5. Code: `server/src/database-queries/thesisModel.js` (`NEXT_DEADLINE`), `termModel.js` → `deadlinesForThesis`,
   `request-handlers/termController.js`; client `screens/admin/Terms.jsx`, `ui-pieces/thesis/Deadlines.jsx`.

### "A finished thesis isn't in the archive" or "It has no Download button"

1. Only theses with the status **Completed** appear. Check the status on the thesis page.
2. An admin may have kept it out: on the thesis, **Admin controls** → **Show in the thesis archive**.
   The audit log records who changed it.
3. No Download button: there is no approved Final Manuscript with a file, for example when an admin set
   the status to Completed by hand.
4. Code: `server/src/database-queries/archiveModel.js`, `request-handlers/archiveController.js`;
   client `screens/Archive.jsx`, `screens/ArchiveDetail.jsx`.

### "Everyone was signed out after a password change"

Expected. Changing, resetting, or having an admin set a password ends every session for that account,
so a stolen session can't outlive it. The device that made the change stays signed in. See
`server/src/request-filters/auth.js` (the `token_version` check) and `database-queries/userModel.js` → `setPassword`.

### "I can't score a defense" or "the Record verdict button is missing"

All in `server/src/request-handlers/defenseController.js`:

1. Scoring opens only **once the defense has started**. Before then the page says when.
2. Only **panelists on that defense** can score. The thesis's own adviser is never on its panel.
3. Once the **verdict is recorded**, scores are locked for good.
4. The verdict button appears only for an **admin**, after **at least one** panelist has scored.
5. A **cancelled** defense can't be scored or decided.

### "Who changed this account or thesis?"

Admins: **Audit log** in the sidebar. It lists role changes, deactivations, deleted accounts, adviser
assignments, status overrides, deleted theses, and defense verdicts, with who did it and when.
Code: `server/src/database-queries/auditModel.js`; each admin handler calls `Audit.record`.

### "A CSV export shows a quote before a value"

Expected for values starting with `=`, `+`, `-`, or `@`. A spreadsheet would run those as formulas,
so the export turns them into plain text. See `server/src/helpers/csv.js`.

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
