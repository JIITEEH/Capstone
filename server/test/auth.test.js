import './setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeUser, startApi, tokenHours } from './helpers.js';

const api = await startApi();

describe('health and errors', () => {
  it('reports that the API is up', async () => {
    const res = await api.get('/health');
    assert.equal(res.status, 200);
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await api.get('/no-such-route');
    assert.equal(res.status, 404);
    assert.equal(typeof res.data.error, 'string');
  });

  it('requires a valid sign-in for protected routes', async () => {
    assert.equal((await api.get('/dashboard')).status, 401);
    assert.equal((await api.get('/auth/me', { token: 'not-a-real-token' })).status, 401);
  });
});

describe('registration', () => {
  it('creates a student account and signs them in', async () => {
    const res = await api.post('/auth/register', {
      body: { name: 'Sam Student', email: 'sam@tms.edu', program: 'BS IT', password: 'password123' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, 'student');
    assert.ok(res.data.token);
  });

  it('rejects an email that is already taken, in any letter case', async () => {
    const res = await api.post('/auth/register', { body: { name: 'Dup', email: 'SAM@tms.edu', password: 'password123' } });
    assert.equal(res.status, 409);
  });

  it('rejects short passwords and invalid emails', async () => {
    const short = await api.post('/auth/register', { body: { name: 'A', email: 'a@tms.edu', password: '123' } });
    const invalid = await api.post('/auth/register', { body: { name: 'B', email: 'not-an-email', password: 'password123' } });
    assert.equal(short.status, 400);
    assert.equal(invalid.status, 400);
  });
});

describe('sign-in', () => {
  it('rejects a wrong password', async () => {
    assert.equal((await api.login('sam@tms.edu', 'wrong-password')).status, 401);
  });

  it('keeps people signed in for 30 days only when they ask to', async () => {
    const remembered = await api.login('sam@tms.edu', 'password123', { remember: true });
    const session = await api.login('sam@tms.edu', 'password123', { remember: false });
    assert.equal(tokenHours(remembered.data.token), 720);
    assert.equal(tokenHours(session.data.token), 12);
  });

  it('returns the signed-in user', async () => {
    const { data } = await api.login('sam@tms.edu');
    const me = await api.get('/auth/me', { token: data.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, 'sam@tms.edu');
  });

  it('lists demo accounts outside production', async () => {
    const res = await api.get('/auth/demo-accounts');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.accounts));
  });
});

describe('profile and password', () => {
  it('updates the name and program', async () => {
    const user = await makeUser(api, { name: 'Pat Profile', email: 'pat@tms.edu' });
    const res = await api.patch('/auth/me', { token: user.token, body: { name: 'Pat Updated', program: 'BS CS' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.name, 'Pat Updated');
    assert.equal(res.data.user.program, 'BS CS');
  });

  it('changes the password only with the current one', async () => {
    const user = await makeUser(api, { name: 'Cy Change', email: 'cy@tms.edu' });
    const wrong = await api.patch('/auth/me', { token: user.token, body: { currentPassword: 'nope', newPassword: 'newpass123' } });
    assert.equal(wrong.status, 400);

    const right = await api.patch('/auth/me', {
      token: user.token,
      body: { currentPassword: 'password123', newPassword: 'newpass123' },
    });
    assert.equal(right.status, 200);
    assert.equal((await api.login('cy@tms.edu', 'password123')).status, 401);
    assert.equal((await api.login('cy@tms.edu', 'newpass123')).status, 200);
  });
});

describe('password reset', () => {
  it('issues a one-time link that sets a new password', async () => {
    await makeUser(api, { name: 'Rae Reset', email: 'rae@tms.edu' });
    const requested = await api.post('/auth/forgot-password', { body: { email: 'rae@tms.edu' } });
    assert.equal(requested.status, 200);
    const token = new URL(requested.data.devResetUrl).searchParams.get('token');

    const reset = await api.post('/auth/reset-password', { body: { token, password: 'resetpass123' } });
    assert.equal(reset.status, 200);
    assert.equal((await api.login('rae@tms.edu', 'resetpass123')).status, 200);

    const reused = await api.post('/auth/reset-password', { body: { token, password: 'another123' } });
    assert.equal(reused.status, 400);
  });

  it('gives the same answer for unknown emails without issuing a link', async () => {
    const res = await api.post('/auth/forgot-password', { body: { email: 'nobody@tms.edu' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.devResetUrl, undefined);
  });

  it('rejects an invalid reset token', async () => {
    const res = await api.post('/auth/reset-password', { body: { token: 'made-up', password: 'resetpass123' } });
    assert.equal(res.status, 400);
  });
});

describe('rate limiting', () => {
  it('blocks an account after 10 wrong passwords, even with the right one', async () => {
    await makeUser(api, { name: 'Lee Locked', email: 'locked@tms.edu' });
    for (let attempt = 0; attempt < 10; attempt++) {
      assert.equal((await api.login('locked@tms.edu', `wrong-${attempt}`)).status, 401);
    }
    const blocked = await api.login('locked@tms.edu', 'wrong-again');
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal((await api.login('locked@tms.edu', 'password123')).status, 429);
  });

  it('never counts successful sign-ins, so a shared network is not blocked', async () => {
    await makeUser(api, { name: 'Lab User', email: 'lab@tms.edu' });
    for (let attempt = 0; attempt < 15; attempt++) {
      assert.equal((await api.login('lab@tms.edu')).status, 200);
    }
  });
});
