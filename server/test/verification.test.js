import './setup.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import db from '../src/database/index.js';
import { migrate, MIGRATIONS_DIR } from '../src/database/migrate.js';
import { useTransport } from '../src/helpers/email.js';
import { makeUser, PASSWORD, startApi } from './helpers.js';

const api = await startApi();

let outbox = [];
beforeEach(() => {
  outbox = [];
  useTransport({ sendMail: (message) => { outbox.push(message); return Promise.resolve(); } });
});
after(() => useTransport(null));

const settle = () => new Promise((resolve) => setImmediate(resolve));
const tokenFrom = (url) => new URL(url).searchParams.get('token');

async function signUp(email, name = 'New Student') {
  const res = await api.post('/auth/register', { body: { name, email, program: 'BS IT', password: PASSWORD } });
  assert.equal(res.status, 201);
  await settle();
  return res.data;
}

describe('signing up', () => {
  it('creates an unverified account and emails a verification link', async () => {
    const { user, devVerifyUrl, token } = await signUp('fresh@tms.edu', 'Fresh Face');

    assert.equal(user.email_verified, 0);
    assert.ok(token, 'the student is signed in straight away');
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, 'fresh@tms.edu');
    assert.ok(outbox[0].text.includes(devVerifyUrl), 'the email carries the working link');
  });

  it('keeps an unverified student from starting a thesis', async () => {
    const { token } = await signUp('eager@tms.edu');
    const res = await api.post('/theses', { token, body: { title: 'Too soon' } });

    assert.equal(res.status, 403);
    assert.match(res.data.error, /Verify your email/);
  });

  it('keeps a leader from inviting an unverified classmate', async () => {
    const leader = await makeUser(api, { name: 'Group Leader', email: 'leader-v@tms.edu' });
    const thesis = await api.post('/theses', { token: leader.token, body: { title: 'Verified group' } });
    await signUp('impostor@tms.edu', 'Maybe Impostor');

    const res = await api.post(`/theses/${thesis.data.id}/invitations`, { token: leader.token, body: { email: 'impostor@tms.edu' } });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /needs to verify their email/);
  });
});

describe('verifying', () => {
  it('verifies the address, after which the student can start a thesis', async () => {
    const { token, devVerifyUrl } = await signUp('verify-me@tms.edu');

    const res = await api.post('/auth/verify-email', { body: { token: tokenFrom(devVerifyUrl) } });
    assert.equal(res.status, 200);

    assert.equal((await api.get('/auth/me', { token })).data.user.email_verified, 1);
    assert.equal((await api.post('/theses', { token, body: { title: 'Now allowed' } })).status, 201);
  });

  it('accepts a link only once', async () => {
    const { devVerifyUrl } = await signUp('once@tms.edu');
    assert.equal((await api.post('/auth/verify-email', { body: { token: tokenFrom(devVerifyUrl) } })).status, 200);
    assert.equal((await api.post('/auth/verify-email', { body: { token: tokenFrom(devVerifyUrl) } })).status, 400);
  });

  it('refuses a made-up or expired link', async () => {
    assert.equal((await api.post('/auth/verify-email', { body: { token: 'made-up' } })).status, 400);

    const { devVerifyUrl, user } = await signUp('expired@tms.edu');
    db.prepare("UPDATE email_verifications SET expires_at = datetime('now', '-1 minute') WHERE user_id = ?").run(user.id);
    assert.equal((await api.post('/auth/verify-email', { body: { token: tokenFrom(devVerifyUrl) } })).status, 400);
  });

  it('sends a fresh link on request, which replaces the old one', async () => {
    const { token, devVerifyUrl: first } = await signUp('resend@tms.edu');

    const resent = await api.post('/auth/resend-verification', { token });
    await settle();
    assert.equal(resent.status, 200);
    assert.equal(outbox.length, 2, 'the sign-up email and the resent one');

    assert.equal((await api.post('/auth/verify-email', { body: { token: tokenFrom(first) } })).status, 400, 'the old link stopped working');
    assert.equal((await api.post('/auth/verify-email', { body: { token: tokenFrom(resent.data.devVerifyUrl) } })).status, 200);
  });

  it('says so when there is nothing left to verify', async () => {
    const already = await makeUser(api, { name: 'Already Done', email: 'already@tms.edu' });
    const res = await api.post('/auth/resend-verification', { token: already.token });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /already verified/);
  });
});

describe('accounts that need no verification', () => {
  it('treats an account an admin creates as verified', async () => {
    const admin = await makeUser(api, { name: 'Verify Admin', email: 'verify-admin@tms.edu', role: 'admin' });
    const res = await api.post('/users', {
      token: admin.token,
      body: { name: 'Prof Made', email: 'made@tms.edu', role: 'adviser', password: 'temporary-pass-1' },
    });
    assert.equal(res.data.email_verified, 1);
  });

  it('marks every account that existed before verification as verified', () => {
    // Build a database from the migrations before 009, add a user, then apply 009
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'thesistrack-verify-'));
    const earlier = path.join(scratch, 'earlier');
    fs.mkdirSync(earlier);
    for (const name of fs.readdirSync(MIGRATIONS_DIR)) {
      if (Number(name.slice(0, 3)) < 9) fs.copyFileSync(path.join(MIGRATIONS_DIR, name), path.join(earlier, name));
    }

    const old = new DatabaseSync(path.join(scratch, 'old.db'));
    migrate(old, earlier);
    old.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Old Timer', 'old@tms.edu', 'x', 'student')").run();
    migrate(old, MIGRATIONS_DIR);

    const row = old.prepare("SELECT email_verified_at FROM users WHERE email = 'old@tms.edu'").get();
    assert.ok(row.email_verified_at, 'an existing student is not locked out by the upgrade');
    old.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });
});
