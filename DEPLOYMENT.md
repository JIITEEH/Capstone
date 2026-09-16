# Deploying ThesisTrack

How to run ThesisTrack for real students on a single server: a Linux VPS or any machine that stays on.
It assumes one server process, which is what the app is built for. Rate limits and sessions are kept
in memory, so running several copies behind a load balancer is not supported.

## 1. What you need

- **Node.js 22.13 or newer**
- **A domain name** pointing at the server, for HTTPS
- **nginx** (or another reverse proxy) in front of Node
- About 200 MB of disk for the app, plus room for manuscripts. Each upload can be up to 50 MB.

## 2. Install

```bash
git clone https://github.com/JIITEEH/Capstone.git thesistrack
cd thesistrack
git checkout main
npm ci
npm run build          # builds the website into client/dist
```

`npm start` then serves both the website and the API from one port.

## 3. Configure

Copy the template and fill it in:

```bash
cp server/.env.example server/.env
```

| Setting | Production value | Why it matters |
| --- | --- | --- |
| `NODE_ENV` | `production` | Turns off development-only endpoints and the reset-link shortcut |
| `JWT_SECRET` | a long random string | **Required.** The server refuses to start without it. Generate one with `openssl rand -base64 48` |
| `PORT` | `3001` | The port nginx forwards to. Keep it private; don't open it in the firewall |
| `CLIENT_ORIGIN` | `https://thesis.yourschool.edu` | The public address. Used in password reset links |
| `TRUST_PROXY` | `1` | **Set this behind nginx.** See below |
| `SMTP_HOST` | `smtp.gmail.com` | **Needed for password reset emails.** See section 4 |
| `SMTP_PORT` | `465` | 465 for TLS from the start, 587 for STARTTLS |
| `SMTP_USER` | your sending address | The account that sends the email |
| `SMTP_PASS` | an app password | **Not** your normal password. See section 4 |
| `MAIL_FROM` | `ThesisTrack <you@gmail.com>` | Who the email says it is from |
| `DATABASE_PATH` | `./data/app.db` | Where the SQLite database lives |
| `UPLOAD_DIR` | `./uploads` | Where manuscripts live |
| `BACKUP_DIR` | `./backups` | Where nightly backups are written |
| `BACKUP_KEEP_DAYS` | `14` | How long backups are kept |
| `BACKUP_REMOTE` | `gdrive:thesistrack-backups` | Copies backups off the server. See section 9 |

### Why `TRUST_PROXY` matters

Behind nginx, every request reaches Node from nginx's own address. The sign-in, sign-up, and
password-reset limits are counted per address, so without `TRUST_PROXY=1` **every visitor shares one
limit**, and a handful of wrong reset attempts from anyone locks out the whole school for 15 minutes.

Set it to the number of proxies in front of Node, normally `1`. **Leave it unset if Node faces the
internet directly**: trusting a proxy that isn't there lets a client fake its address and dodge the limits.
The server prints a warning at startup when `NODE_ENV=production` and `TRUST_PROXY` is not set.

## 4. Set up email

Without email, a student who forgets their password is locked out until an admin resets it by hand. The
server prints a warning at startup when `NODE_ENV=production` and `SMTP_HOST` is not set.

**Gmail is free and works well at a school's volume** (up to about 500 emails a day):

1. Use a Gmail account for sending, ideally one made for the system rather than a personal one.
2. Turn on **2-Step Verification** for it: https://myaccount.google.com/security
3. Create an **app password**: https://myaccount.google.com/apppasswords — name it "ThesisTrack".
   Google shows a 16-character password once. Copy it.
4. In `server/.env`:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=thesistrack.yourschool@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   MAIL_FROM=ThesisTrack <thesistrack.yourschool@gmail.com>
   ```

5. Restart, then request a password reset for your own account and check it arrives. Look in spam the
   first time; marking it "not spam" helps later ones land in the inbox.

Your school's own mail server works the same way: ask IT for the SMTP host, port, and an account.

**Emails send in the background.** The reset page answers straight away, so a slow mail server never
delays it, and the response takes the same time whether or not an account exists. A failed send is
logged; it never breaks the page.

## 5. Create the first admin

The seed script refuses to run in production, because it deletes the database. For a brand-new
server with **no data yet**, run it once, explicitly:

```bash
cd server
SEED_ALLOW_PRODUCTION=yes SEED_ADMIN_EMAIL=you@yourschool.edu SEED_ADMIN_PASSWORD='a-strong-password' \
  npm run seed
```

Then sign in as that admin, create the adviser accounts, and **delete the demo student and adviser**
from the Users page. Never run the seed again on a server that holds real data.

## 6. Keep it running

With systemd, create `/etc/systemd/system/thesistrack.service`:

```ini
[Unit]
Description=ThesisTrack
After=network.target

[Service]
WorkingDirectory=/home/thesistrack/thesistrack
ExecStart=/usr/bin/npm start
Restart=on-failure
User=thesistrack

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now thesistrack
sudo systemctl status thesistrack       # check it started
journalctl -u thesistrack -f            # follow the logs
```

## 7. Put nginx in front

`/etc/nginx/sites-available/thesistrack`:

```nginx
server {
    server_name thesis.yourschool.edu;

    # Manuscripts can be up to 50 MB. nginx's default is 1 MB, which would reject
    # most real uploads with a confusing "413 Request Entity Too Large".
    client_max_body_size 55M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/thesistrack /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Turn on HTTPS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d thesis.yourschool.edu
```

Certbot edits the nginx config and renews the certificate automatically. Once HTTPS works, the app's
`Strict-Transport-Security` header tells browsers to use it from then on.

## 9. Back up every night

Nightly backups are not optional on a live system. Install rclone and connect storage once (see the
Backups section of `README.md`), then add to the service user's crontab (`crontab -e`):

```
30 2 * * * cd /home/thesistrack/thesistrack && npm run db:backup >> server/backups/backup.log 2>&1
```

Check it the next morning:

```bash
npm run db:backup -- --list
tail server/backups/backup.log
```

**Test a restore before you need one.** Restore last night's backup onto a copy of the server once, and
confirm the accounts and manuscripts are there. A backup that has never been restored has not been tested.

## 10. Check it works

```bash
curl https://thesis.yourschool.edu/api/health     # {"status":"ok"}
```

Then, in a browser: sign in as the admin, upload a PDF as a test student (this checks the upload size
limit), and request a password reset (this checks `CLIENT_ORIGIN`).

## 11. Upgrading

```bash
npm run db:backup                 # always, before anything else
git pull
npm ci
npm run build
sudo systemctl restart thesistrack
```

Database changes apply themselves on start: the server upgrades the database in place and logs
`Database upgraded: applied 005_...`. If a migration fails, it rolls back and the server stops with the
error; restore the backup you just made while you investigate.

## If something goes wrong

- **Every upload fails** — check `client_max_body_size` in nginx (section 7).
- **Everyone is "Too many attempts"** — `TRUST_PROXY` is not set (section 3).
- **Reset emails never arrive** — check `SMTP_*` settings and the server log for "Could not email" (section 4).
- **Reset links point at localhost** — `CLIENT_ORIGIN` is wrong (section 3).
- **Server won't start: "JWT_SECRET must be set"** — add it to `server/.env`.
- **Anything else** — `TROUBLESHOOTING.md` maps symptoms to the files to check.
