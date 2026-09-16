import './setup.js';
import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import * as User from '../src/database-queries/userModel.js';
import { passwordResetEmail, sendEmail, useTransport } from '../src/helpers/email.js';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// A fake mail server that records what would have been sent
let outbox = [];
let behaviour = 'deliver';
const fakeMailer = {
  sendMail(message) {
    outbox.push(message);
    if (behaviour === 'fail') return Promise.reject(new Error('Mail server refused the connection'));
    if (behaviour === 'hang') return new Promise(() => {});
    return Promise.resolve({ messageId: 'fake' });
  },
};

beforeEach(() => {
  outbox = [];
  behaviour = 'deliver';
  useTransport(fakeMailer);
});
after(() => useTransport(null));

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('password reset email', () => {
  it('sends the reset link to the account owner', async () => {
    await makeUser(api, { name: 'Ana Cruz', email: 'ana-mail@tms.edu' });

    const res = await api.post('/auth/forgot-password', { body: { email: 'ana-mail@tms.edu' } });
    await settle();

    assert.equal(res.status, 200);
    assert.equal(outbox.length, 1);
    const [mail] = outbox;
    assert.equal(mail.to, 'ana-mail@tms.edu');
    assert.equal(mail.subject, 'Reset your ThesisTrack password');
    assert.ok(mail.text.includes(res.data.devResetUrl), 'the plain-text body carries the working link');
    assert.ok(mail.html.includes('Choose a new password'));
    assert.match(mail.text, /expires in 1 hour/);
  });

  it('sends nothing for an address with no account, and answers the same way', async () => {
    const res = await api.post('/auth/forgot-password', { body: { email: 'nobody-here@tms.edu' } });
    await settle();

    assert.equal(res.status, 200);
    assert.equal(outbox.length, 0);
    assert.match(res.data.message, /If an account exists/, 'the reply does not reveal that the address is unknown');
  });

  it('sends nothing to a deactivated account', async () => {
    const student = await makeUser(api, { name: 'Gone Away', email: 'gone@tms.edu' });
    User.update(student.id, { is_active: 0 });

    await api.post('/auth/forgot-password', { body: { email: 'gone@tms.edu' } });
    await settle();

    assert.equal(outbox.length, 0);
  });

  it('still answers when the mail server fails', async () => {
    await makeUser(api, { name: 'Ben Reyes', email: 'ben-mail@tms.edu' });
    behaviour = 'fail';

    const res = await api.post('/auth/forgot-password', { body: { email: 'ben-mail@tms.edu' } });
    await settle();

    assert.equal(res.status, 200, 'a broken mail server does not break the page');
  });

  it('answers without waiting for a slow mail server', async () => {
    await makeUser(api, { name: 'Cara Lim', email: 'cara-mail@tms.edu' });
    behaviour = 'hang';

    const started = Date.now();
    const res = await api.post('/auth/forgot-password', { body: { email: 'cara-mail@tms.edu' } });

    assert.equal(res.status, 200);
    assert.ok(Date.now() - started < 2000, 'the response did not wait on a mail server that never replies');
  });
});

describe('the email itself', () => {
  it('escapes a name that contains HTML', () => {
    const mail = passwordResetEmail({
      to: 'x@tms.edu',
      name: '<img src=x onerror=alert(1)>',
      resetUrl: 'http://localhost:5173/reset-password?token=abc',
    });
    assert.ok(!mail.html.includes('<img'), 'the name cannot inject markup');
    assert.ok(mail.html.includes('&lt;img'));
  });

  it('skips quietly when no mail server is configured', async () => {
    useTransport(null);
    const result = await sendEmail({ to: 'x@tms.edu', subject: 'Test', text: 'Hello' });
    assert.deepEqual(result, { skipped: true });
  });
});
