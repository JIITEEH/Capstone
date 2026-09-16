import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let student;

before(async () => {
  admin = await makeUser(api, { name: 'Head Admin', email: 'head-admin@tms.edu', role: 'admin' });
  student = await makeUser(api, { name: 'Dana Ruiz', email: 'dana@tms.edu' });
});

async function latest(params = '') {
  const res = await api.get(`/audit${params}`, { token: admin.token });
  assert.equal(res.status, 200);
  return res.data.entries;
}

describe('what gets recorded', () => {
  it('records a new account', async () => {
    const res = await api.post('/users', {
      token: admin.token,
      body: { name: 'Prof Ocampo', email: 'ocampo@tms.edu', role: 'adviser', password: 'temporary-pass-1' },
    });
    assert.equal(res.status, 201);

    const [entry] = await latest();
    assert.equal(entry.action, 'user.created');
    assert.equal(entry.actor_name, 'Head Admin');
    assert.equal(entry.target_label, 'Prof Ocampo (ocampo@tms.edu)');
    assert.equal(entry.details, 'Role: adviser');
  });

  it('records a role change with what it was and what it became', async () => {
    const target = await makeUser(api, { name: 'Role Change', email: 'role-change@tms.edu' });
    await api.patch(`/users/${target.id}`, { token: admin.token, body: { role: 'adviser' } });

    const [entry] = await latest();
    assert.equal(entry.action, 'user.role_changed');
    assert.equal(entry.details, 'student → adviser');
  });

  it('records deactivating and reactivating', async () => {
    await api.patch(`/users/${student.id}`, { token: admin.token, body: { is_active: false } });
    assert.equal((await latest())[0].action, 'user.deactivated');

    await api.patch(`/users/${student.id}`, { token: admin.token, body: { is_active: true } });
    assert.equal((await latest())[0].action, 'user.reactivated');
  });

  it('records that a password was set, never the password itself', async () => {
    await api.patch(`/users/${student.id}`, { token: admin.token, body: { password: 'a-secret-we-must-not-log' } });

    const entries = await latest();
    assert.equal(entries[0].action, 'user.password_set');
    assert.ok(!JSON.stringify(entries).includes('a-secret-we-must-not-log'));
  });

  it('records nothing when a save changes nothing', async () => {
    const before = (await latest()).length;
    await api.patch(`/users/${student.id}`, { token: admin.token, body: { name: 'Dana Ruiz', is_active: true } });
    assert.equal((await latest()).length, before);
  });

  it('records an adviser assignment as before and after', async () => {
    const adviser = await makeUser(api, { name: 'Dr Salazar', email: 'salazar@tms.edu', role: 'adviser' });
    const owner = await makeUser(api, { name: 'Theo Lim', email: 'theo@tms.edu' });
    const thesis = await api.post('/theses', { token: owner.token, body: { title: 'Audited thesis' } });

    await api.patch(`/theses/${thesis.data.id}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });

    const [entry] = await latest();
    assert.equal(entry.action, 'thesis.adviser_assigned');
    assert.equal(entry.target_label, 'Audited thesis');
    assert.equal(entry.details, 'No adviser → Dr Salazar');
  });

  it('records a status override', async () => {
    const owner = await makeUser(api, { name: 'Status Owner', email: 'status-owner@tms.edu' });
    const thesis = await api.post('/theses', { token: owner.token, body: { title: 'Overridden thesis' } });

    await api.patch(`/theses/${thesis.data.id}/status`, { token: admin.token, body: { status: 'completed' } });

    const [entry] = await latest();
    assert.equal(entry.action, 'thesis.status_overridden');
    assert.equal(entry.details, 'Draft → Completed');
  });
});

describe('the record outlives what it describes', () => {
  it('keeps the entry and the name after the account is deleted', async () => {
    const doomed = await makeUser(api, { name: 'Soon Gone', email: 'soon-gone@tms.edu' });
    await api.delete(`/users/${doomed.id}`, { token: admin.token });

    const [entry] = await latest();
    assert.equal(entry.action, 'user.deleted');
    assert.equal(entry.target_label, 'Soon Gone (soon-gone@tms.edu)', 'the name survives the deletion');
  });

  it("keeps the actor's name after the admin who acted is deleted", async () => {
    const temporaryAdmin = await makeUser(api, { name: 'Temp Admin', email: 'temp-admin@tms.edu', role: 'admin' });
    const target = await makeUser(api, { name: 'Acted On', email: 'acted-on@tms.edu' });
    await api.patch(`/users/${target.id}`, { token: temporaryAdmin.token, body: { is_active: false } });

    await api.delete(`/users/${temporaryAdmin.id}`, { token: admin.token });

    const entry = (await latest()).find((e) => e.action === 'user.deactivated' && e.target_id === target.id);
    assert.equal(entry.actor_name, 'Temp Admin', 'who did it is still known');
    assert.equal(entry.actor_id, null, 'the link to the deleted account is cleared');
  });
});

describe('a change that fails', () => {
  it('leaves no entry behind', async () => {
    const before = (await latest()).length;
    const res = await api.patch(`/users/${admin.id}`, { token: admin.token, body: { role: 'student' } });
    assert.equal(res.status, 400, "an admin can't change their own role");
    assert.equal((await latest()).length, before);
  });
});

describe('reading the log', () => {
  it('is for admins only', async () => {
    // A fresh account: an earlier test set a new password for `student`, which ended their session
    const outsider = await makeUser(api, { name: 'Not An Admin', email: 'not-admin@tms.edu' });
    assert.equal((await api.get('/audit', { token: outsider.token })).status, 403, 'signed in, but the wrong role');
    assert.equal((await api.get('/audit')).status, 401, 'not signed in at all');
  });

  it('pages from newest to oldest', async () => {
    const first = await api.get('/audit?limit=2', { token: admin.token });
    assert.equal(first.data.entries.length, 2);
    assert.ok(first.data.entries[0].id > first.data.entries[1].id, 'newest first');
    assert.ok(first.data.nextBefore, 'there is an older page');

    const second = await api.get(`/audit?limit=2&before=${first.data.nextBefore}`, { token: admin.token });
    assert.ok(second.data.entries.every((e) => e.id < first.data.nextBefore), 'the next page is strictly older');
  });

  it('filters to accounts or theses', async () => {
    const theses = await latest('?target=thesis');
    assert.ok(theses.length > 0);
    assert.ok(theses.every((e) => e.target_type === 'thesis'));
  });

  it('offers no way to change or remove an entry', async () => {
    const [entry] = await latest();
    assert.equal((await api.delete(`/audit/${entry.id}`, { token: admin.token })).status, 404);
    assert.equal((await api.patch(`/audit/${entry.id}`, { token: admin.token, body: {} })).status, 404);
  });
});
