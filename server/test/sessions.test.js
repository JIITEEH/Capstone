import './setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import { makeUser, PASSWORD, startApi, tokenHours } from './helpers.js';

const api = await startApi();

describe('changing a password ends other sessions', () => {
  it('signs out the other device and keeps this one signed in', async () => {
    const student = await makeUser(api, { name: 'Lia Tan', email: 'lia@tms.edu' });
    const laptop = student.token;
    const phone = (await api.login('lia@tms.edu')).data.token;

    const change = await api.patch('/auth/me', {
      token: laptop,
      body: { currentPassword: PASSWORD, newPassword: 'a-much-better-password' },
    });
    assert.equal(change.status, 200);
    assert.ok(change.data.token, 'the device that made the change gets a fresh token');

    const stolen = await api.get('/auth/me', { token: phone });
    assert.equal(stolen.status, 401, 'the other session is over');
    assert.match(stolen.data.error, /password was changed/);

    assert.equal((await api.get('/auth/me', { token: laptop })).status, 401, 'the old token here is over too');
    assert.equal((await api.get('/auth/me', { token: change.data.token })).status, 200, 'the new token works');
  });

  it('keeps "keep me signed in" on the replacement token', async () => {
    await makeUser(api, { name: 'Rafa Cruz', email: 'rafa@tms.edu' });
    const remembered = (await api.login('rafa@tms.edu', PASSWORD, { remember: true })).data.token;

    const change = await api.patch('/auth/me', {
      token: remembered,
      body: { currentPassword: PASSWORD, newPassword: 'another-good-password' },
    });

    assert.equal(tokenHours(change.data.token), tokenHours(remembered), 'still a 30-day token');
  });

  it('leaves sessions alone when only the name changes', async () => {
    const student = await makeUser(api, { name: 'Nina Go', email: 'nina@tms.edu' });
    const other = (await api.login('nina@tms.edu')).data.token;

    const change = await api.patch('/auth/me', { token: student.token, body: { name: 'Nina Go Santos' } });
    assert.equal(change.status, 200);
    assert.equal(change.data.token, undefined, 'no new token when the password did not change');
    assert.equal((await api.get('/auth/me', { token: other })).status, 200);
  });
});

describe('other ways a password changes', () => {
  it('ends sessions when an admin sets a new password', async () => {
    const admin = await makeUser(api, { name: 'Admin', email: 'admin-s@tms.edu', role: 'admin' });
    const student = await makeUser(api, { name: 'Leo Uy', email: 'leo@tms.edu' });

    const reset = await api.patch(`/users/${student.id}`, { token: admin.token, body: { password: 'set-by-the-admin' } });
    assert.equal(reset.status, 200);

    assert.equal((await api.get('/auth/me', { token: student.token })).status, 401);
    assert.equal((await api.get('/auth/me', { token: admin.token })).status, 200, "the admin's own session is unaffected");
  });

  it('ends sessions when a reset link is used', async () => {
    const student = await makeUser(api, { name: 'Mika Lim', email: 'mika@tms.edu' });

    const forgot = await api.post('/auth/forgot-password', { body: { email: 'mika@tms.edu' } });
    const resetToken = new URL(forgot.data.devResetUrl).searchParams.get('token');
    const reset = await api.post('/auth/reset-password', { body: { token: resetToken, password: 'recovered-password' } });
    assert.equal(reset.status, 200);

    assert.equal((await api.get('/auth/me', { token: student.token })).status, 401);
  });
});

describe('upgrading an existing system', () => {
  it('still accepts tokens issued before sessions were versioned', async () => {
    const student = await makeUser(api, { name: 'Old Token', email: 'old@tms.edu' });
    // A token shaped the way sign-in worked before this change: no tv claim
    const legacy = jwt.sign({ sub: String(student.id), role: 'student' }, config.jwtSecret, { expiresIn: '1h' });

    assert.equal((await api.get('/auth/me', { token: legacy })).status, 200, 'nobody is signed out by the upgrade');
  });

  it('refuses that old token once the password changes', async () => {
    const student = await makeUser(api, { name: 'Old Token Two', email: 'old2@tms.edu' });
    const legacy = jwt.sign({ sub: String(student.id), role: 'student' }, config.jwtSecret, { expiresIn: '1h' });

    await api.patch('/auth/me', { token: student.token, body: { currentPassword: PASSWORD, newPassword: 'changed-now-ok' } });
    assert.equal((await api.get('/auth/me', { token: legacy })).status, 401);
  });

  it('never reveals the version number in an API response', async () => {
    const student = await makeUser(api, { name: 'Private', email: 'private@tms.edu' });
    const { data } = await api.get('/auth/me', { token: student.token });
    assert.equal(data.user.token_version, undefined);
  });
});
