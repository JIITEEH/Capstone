import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// Steps in this file build on each other, following one thesis group
let admin;
let adviser;
let leader;
let ben;
let cara;
let outsider;
let extras;
let thesisId;

const addMember = (token, email) => api.post(`/theses/${thesisId}/members`, { token, body: { email } });
const removeMember = (token, studentId) => api.delete(`/theses/${thesisId}/members/${studentId}`, { token });
const members = async (token) => (await api.get(`/theses/${thesisId}`, { token })).data.members;

before(async () => {
  admin = await makeUser(api, { name: 'Ada Admin', email: 'admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr. Maria Santos', email: 'santos@tms.edu', role: 'adviser' });
  leader = await makeUser(api, { name: 'Lara Leader', email: 'lara@tms.edu' });
  ben = await makeUser(api, { name: 'Ben Member', email: 'ben@tms.edu' });
  cara = await makeUser(api, { name: 'Cara Member', email: 'cara@tms.edu' });
  outsider = await makeUser(api, { name: 'Omar Outsider', email: 'omar@tms.edu' });
  extras = [];
  for (let i = 1; i <= 3; i++) extras.push(await makeUser(api, { name: `Extra ${i}`, email: `extra${i}@tms.edu` }));

  const created = await api.post('/theses', { token: leader.token, body: { title: 'Group Thesis' } });
  thesisId = created.data.id;
});

describe('starting a group', () => {
  it('makes the creator the group leader', async () => {
    const res = await api.get(`/theses/${thesisId}`, { token: leader.token });
    assert.equal(res.data.groupLimit, 5);
    assert.equal(res.data.members.length, 1);
    assert.equal(res.data.members[0].id, leader.id);
    assert.equal(res.data.members[0].is_leader, 1);
  });
});

describe('adding members', () => {
  it('lets the leader add a classmate by email', async () => {
    const res = await addMember(leader.token, 'ben@tms.edu');
    assert.equal(res.status, 201);
    assert.equal(res.data.length, 2);
  });

  it('stops other members and outsiders from adding people', async () => {
    assert.equal((await addMember(ben.token, 'cara@tms.edu')).status, 403);
    assert.equal((await addMember(outsider.token, 'cara@tms.edu')).status, 404);
  });

  it('only adds active student accounts that exist', async () => {
    assert.equal((await addMember(leader.token, 'santos@tms.edu')).status, 400);
    assert.equal((await addMember(leader.token, 'nobody@tms.edu')).status, 400);
  });

  it('refuses people already in this or another group', async () => {
    const again = await addMember(leader.token, 'ben@tms.edu');
    assert.equal(again.status, 409);
    assert.match(again.data.error, /already in this group/);

    const other = await api.post('/theses', { token: outsider.token, body: { title: 'Omar Thesis' } });
    const taken = await api.post(`/theses/${other.data.id}/members`, { token: outsider.token, body: { email: 'ben@tms.edu' } });
    assert.equal(taken.status, 409);
    assert.match(taken.data.error, /another thesis group/);
  });

  it('lets admins add members too', async () => {
    assert.equal((await addMember(admin.token, 'cara@tms.edu')).status, 201);
  });

  it('caps a group at five students', async () => {
    assert.equal((await addMember(leader.token, 'extra1@tms.edu')).status, 201);
    assert.equal((await addMember(leader.token, 'extra2@tms.edu')).status, 201);
    const sixth = await addMember(leader.token, 'extra3@tms.edu');
    assert.equal(sixth.status, 400);
    assert.match(sixth.data.error, /at most 5/);
  });

  it('stops a member from starting a second thesis', async () => {
    assert.equal((await api.post('/theses', { token: ben.token, body: { title: 'Second' } })).status, 409);
  });
});

describe('working as a group', () => {
  it('shows every member the thesis, with all names leader first', async () => {
    const res = await api.get('/theses', { token: cara.token });
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].student_name, 'Lara Leader, Ben Member, Cara Member, Extra 1, Extra 2');
    assert.equal((await api.get(`/theses/${thesisId}`, { token: extras[2].token })).status, 404);
  });

  it('lets any member submit and comment', async () => {
    const upload = await api.upload(ben.token, thesisId, 'proposal');
    assert.equal(upload.status, 201);
    const comment = await api.post(`/submissions/${upload.data.id}/comments`, { token: cara.token, body: { body: 'Looks good' } });
    assert.equal(comment.status, 201);
  });

  it("shows the thesis on every member's dashboard", async () => {
    const res = await api.get('/dashboard', { token: cara.token });
    assert.equal(res.data.thesis.id, thesisId);
  });

  it('finds the thesis by any member name', async () => {
    const res = await api.get('/theses?search=Cara', { token: admin.token });
    assert.ok(res.data.some((thesis) => thesis.id === thesisId));
  });

  it('shows group members to the assigned adviser', async () => {
    await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
    assert.equal((await members(adviser.token)).length, 5);
  });

  it("blocks changing a member's role and explains why", async () => {
    const res = await api.patch(`/users/${extras[0].id}`, { token: admin.token, body: { role: 'adviser' } });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /thesis group/);
  });
});

describe('leaving and removing members', () => {
  it('only lets the leader or an admin remove others', async () => {
    assert.equal((await removeMember(ben.token, cara.id)).status, 403);
  });

  it('hands leadership to the longest-standing member when the leader leaves', async () => {
    assert.equal((await removeMember(leader.token, leader.id)).status, 204);
    const list = await members(ben.token);
    assert.equal(list[0].id, ben.id);
    assert.equal(list[0].is_leader, 1);
    assert.equal((await api.get(`/theses/${thesisId}`, { token: leader.token })).status, 404);
  });

  it('lets the new leader remove a member', async () => {
    assert.equal((await removeMember(ben.token, cara.id)).status, 204);
    assert.equal((await removeMember(ben.token, outsider.id)).status, 404);
  });

  it('never leaves a thesis without students', async () => {
    const solo = await api.get('/theses', { token: outsider.token });
    const res = await api.delete(`/theses/${solo.data[0].id}/members/${outsider.id}`, { token: outsider.token });
    assert.equal(res.status, 400);
  });
});

describe('deleting student accounts', () => {
  it("deletes a thesis along with its only member", async () => {
    const solo = (await api.get('/theses', { token: outsider.token })).data[0];
    assert.equal((await api.delete(`/users/${outsider.id}`, { token: admin.token })).status, 204);
    assert.equal((await api.get(`/theses/${solo.id}`, { token: admin.token })).status, 404);
  });

  it('keeps a group thesis and picks a new leader when the leader is deleted', async () => {
    assert.equal((await api.delete(`/users/${ben.id}`, { token: admin.token })).status, 204);
    const res = await api.get(`/theses/${thesisId}`, { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.data.members.every((member) => member.id !== ben.id));
    assert.equal(res.data.members[0].is_leader, 1);
  });
});
