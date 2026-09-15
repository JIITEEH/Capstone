import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let adviser;
let student;

before(async () => {
  admin = await makeUser(api, { name: 'Ada Admin', email: 'admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr. Maria Santos', email: 'santos@tms.edu', role: 'adviser' });
  student = await makeUser(api, { name: 'Sam Student', email: 'sam@tms.edu' });
});

describe('user management access', () => {
  it('is limited to admins', async () => {
    assert.equal((await api.get('/users', { token: student.token })).status, 403);
    assert.equal((await api.get('/users', { token: adviser.token })).status, 403);
    assert.equal((await api.get('/users', { token: admin.token })).status, 200);
  });
});

describe('creating and editing accounts', () => {
  it('creates accounts and rejects taken emails', async () => {
    const body = { name: 'Dr. New', email: 'new@tms.edu', role: 'adviser', program: 'CS', password: 'password123' };
    assert.equal((await api.post('/users', { token: admin.token, body })).status, 201);
    assert.equal((await api.post('/users', { token: admin.token, body })).status, 409);
  });

  it("stops admins from changing their own role or deleting themselves", async () => {
    assert.equal((await api.patch(`/users/${admin.id}`, { token: admin.token, body: { role: 'student' } })).status, 400);
    assert.equal((await api.delete(`/users/${admin.id}`, { token: admin.token })).status, 400);
  });

  it('keeps advisers with advisees in their role', async () => {
    const thesis = await api.post('/theses', { token: student.token, body: { title: 'Advised Thesis' } });
    await api.patch(`/theses/${thesis.data.id}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
    const res = await api.patch(`/users/${adviser.id}`, { token: admin.token, body: { role: 'student' } });
    assert.equal(res.status, 400);
  });
});

describe('deactivating and deleting accounts', () => {
  it('blocks sign-in and ends existing sessions for deactivated accounts', async () => {
    const user = await makeUser(api, { name: 'Dee Active', email: 'dee@tms.edu' });
    const res = await api.patch(`/users/${user.id}`, { token: admin.token, body: { is_active: false } });
    assert.equal(res.status, 200);
    assert.equal(res.data.is_active, 0);

    assert.equal((await api.login('dee@tms.edu')).status, 403);
    assert.equal((await api.get('/auth/me', { token: user.token })).status, 401);
  });

  it('lets an admin reactivate an account with a new password', async () => {
    const dee = (await api.get('/users?search=dee', { token: admin.token })).data[0];
    const res = await api.patch(`/users/${dee.id}`, { token: admin.token, body: { is_active: true, password: 'adminset123' } });
    assert.equal(res.status, 200);
    assert.equal((await api.login('dee@tms.edu', 'adminset123')).status, 200);
  });

  it('deletes accounts', async () => {
    const user = await makeUser(api, { name: 'Del Ete', email: 'delete@tms.edu' });
    assert.equal((await api.delete(`/users/${user.id}`, { token: admin.token })).status, 204);
    assert.equal((await api.login('delete@tms.edu')).status, 401);
  });
});

describe('dashboards', () => {
  it('gives each role its own dashboard data', async () => {
    const studentView = await api.get('/dashboard', { token: student.token });
    assert.equal(studentView.status, 200);
    assert.equal(studentView.data.thesis.title, 'Advised Thesis');

    const adviserView = await api.get('/dashboard', { token: adviser.token });
    assert.equal(adviserView.status, 200);
    assert.equal(adviserView.data.stats.advisees, 1);

    const adminView = await api.get('/dashboard', { token: admin.token });
    assert.equal(adminView.status, 200);
    assert.ok(adminView.data.stats.theses >= 1);
    assert.ok(Array.isArray(adminView.data.advisers));
  });

  it('shows a student without a thesis an empty dashboard', async () => {
    const user = await makeUser(api, { name: 'New Student', email: 'fresh@tms.edu' });
    const res = await api.get('/dashboard', { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.data.thesis, null);
  });
});
