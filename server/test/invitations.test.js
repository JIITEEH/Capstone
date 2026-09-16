import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// Steps build on each other: Lia leads one group, Quinn another, and classmates move between them
let admin;
let adviser;
let lia;
let quinn;
let nia;
let oli;
let pat;
let fillers;
let liaThesis;
let quinnThesis;
let niaInvitation;

const invite = (leader, thesisId, email) => api.post(`/theses/${thesisId}/invitations`, { token: leader.token, body: { email } });
const answer = (student, id, choice) => api.post(`/invitations/${id}/${choice}`, { token: student.token });
const inbox = async (student) => (await api.get('/invitations', { token: student.token })).data;
const titles = async (who) => (await api.get('/notifications', { token: who.token })).data.notifications.map((n) => n.title);
const thesis = async (who, id) => (await api.get(`/theses/${id}`, { token: who.token })).data;

before(async () => {
  admin = await makeUser(api, { name: 'Invite Admin', email: 'i-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Reyes', email: 'reyes@tms.edu', role: 'adviser' });
  lia = await makeUser(api, { name: 'Lia Leader', email: 'lia@tms.edu' });
  quinn = await makeUser(api, { name: 'Quinn Leader', email: 'quinn@tms.edu' });
  nia = await makeUser(api, { name: 'Nia Classmate', email: 'nia@tms.edu' });
  oli = await makeUser(api, { name: 'Oli Classmate', email: 'oli@tms.edu' });
  pat = await makeUser(api, { name: 'Pat Taken', email: 'pat@tms.edu' });
  fillers = [];
  for (let i = 1; i <= 4; i++) fillers.push(await makeUser(api, { name: `Filler ${i}`, email: `filler${i}@tms.edu` }));

  liaThesis = (await api.post('/theses', { token: lia.token, body: { title: 'Lia group thesis' } })).data.id;
  quinnThesis = (await api.post('/theses', { token: quinn.token, body: { title: 'Quinn group thesis' } })).data.id;
  await api.post('/theses', { token: pat.token, body: { title: 'Pat solo thesis' } });
});

describe('sending an invitation', () => {
  it('shows the classmate the invitation and tells them about it', async () => {
    const res = await invite(lia, liaThesis, 'nia@tms.edu');
    assert.equal(res.status, 201);
    niaInvitation = res.data.id;

    const [invitation] = await inbox(nia);
    assert.equal(invitation.id, niaInvitation);
    assert.equal(invitation.thesis_title, 'Lia group thesis');
    assert.equal(invitation.invited_by_name, 'Lia Leader');
    assert.equal(invitation.group_names, 'Lia Leader');
    assert.ok((await titles(nia)).includes('Lia Leader invited you to join their thesis group'));
  });

  it('lists who the group is waiting on', async () => {
    const { invitations } = await thesis(lia, liaThesis);
    assert.deepEqual(invitations.map((i) => i.student_name), ['Nia Classmate']);
  });

  it('refuses a second invitation while one is waiting', async () => {
    const res = await invite(lia, liaThesis, 'nia@tms.edu');
    assert.equal(res.status, 409);
    assert.match(res.data.error, /already has an invitation/);
  });

  it("doesn't tell the leader that a classmate is already in another group", async () => {
    const res = await invite(lia, liaThesis, 'pat@tms.edu');
    assert.equal(res.status, 201, 'looks the same as inviting anyone else');

    const accepted = await answer(pat, res.data.id, 'accept');
    assert.equal(accepted.status, 409);
    assert.match(accepted.data.error, /Leave it before joining another/);
  });

  it('tells the leader when a classmate declines', async () => {
    const [invitation] = await inbox(pat);
    assert.equal((await answer(pat, invitation.id, 'decline')).status, 204);
    assert.deepEqual(await inbox(pat), []);
    assert.ok((await titles(lia)).includes('Pat Taken declined your invitation'));
  });
});

describe('answering an invitation', () => {
  it('lets only the invited student answer it', async () => {
    assert.equal((await answer(oli, niaInvitation, 'accept')).status, 404);
    assert.equal((await answer(lia, niaInvitation, 'decline')).status, 404);
    assert.equal((await api.post(`/invitations/${niaInvitation}/accept`, { token: adviser.token })).status, 403);
    assert.equal((await api.get('/invitations', { token: admin.token })).status, 403);
  });

  it('joins the group, tells the group, and withdraws other invitations', async () => {
    assert.equal((await invite(quinn, quinnThesis, 'nia@tms.edu')).status, 201);
    assert.equal((await inbox(nia)).length, 2);

    const res = await answer(nia, niaInvitation, 'accept');
    assert.equal(res.status, 200);
    assert.equal(res.data.thesisId, liaThesis);

    assert.ok((await thesis(lia, liaThesis)).members.some((m) => m.id === nia.id));
    assert.deepEqual(await inbox(nia), []);
    assert.deepEqual((await thesis(quinn, quinnThesis)).invitations, [], "Quinn's invitation was withdrawn");
    assert.ok((await titles(lia)).includes('Nia Classmate joined your thesis group'));
  });

  it("can't be answered twice", async () => {
    assert.equal((await answer(nia, niaInvitation, 'accept')).status, 404);
    assert.equal((await answer(nia, niaInvitation, 'decline')).status, 404);
  });
});

describe('cancelling an invitation', () => {
  it('lets the leader take an invitation back', async () => {
    const res = await invite(lia, liaThesis, 'oli@tms.edu');
    assert.equal((await api.delete(`/theses/${liaThesis}/invitations/${res.data.id}`, { token: nia.token })).status, 403);

    assert.equal((await api.delete(`/theses/${liaThesis}/invitations/${res.data.id}`, { token: lia.token })).status, 204);
    assert.deepEqual(await inbox(oli), []);
    assert.equal((await answer(oli, res.data.id, 'accept')).status, 404);
    assert.equal((await api.delete(`/theses/${liaThesis}/invitations/${res.data.id}`, { token: lia.token })).status, 404);
  });

  it("won't cancel another group's invitation", async () => {
    const res = await invite(quinn, quinnThesis, 'oli@tms.edu');
    assert.equal((await api.delete(`/theses/${liaThesis}/invitations/${res.data.id}`, { token: lia.token })).status, 404);
    assert.equal((await inbox(oli)).length, 1);
  });
});

describe('limits', () => {
  it("won't let a late acceptance push a group past five", async () => {
    // Lia and Nia, plus three invitations: the group is full on paper
    const waiting = [];
    for (const filler of fillers.slice(0, 3)) waiting.push((await invite(lia, liaThesis, filler.email)).data.id);

    // An admin fills a seat directly while the invitations are still out
    assert.equal((await api.post(`/theses/${liaThesis}/members`, { token: admin.token, body: { email: 'filler4@tms.edu' } })).status, 201);

    assert.equal((await answer(fillers[0], waiting[0], 'accept')).status, 200);
    assert.equal((await answer(fillers[1], waiting[1], 'accept')).status, 200);
    const late = await answer(fillers[2], waiting[2], 'accept');
    assert.equal(late.status, 400);
    assert.match(late.data.error, /already has 5 students/);
  });

  it("won't let a student join a completed thesis", async () => {
    const [invitation] = await inbox(oli);
    await api.patch(`/theses/${quinnThesis}/status`, { token: admin.token, body: { status: 'completed' } });

    const res = await answer(oli, invitation.id, 'accept');
    assert.equal(res.status, 400);
    assert.match(res.data.error, /completed/);
    assert.equal((await invite(quinn, quinnThesis, 'filler3@tms.edu')).status, 400, 'no new invitations either');
  });

  it("removes a student's invitations when their account is deleted", async () => {
    const [invitation] = await inbox(fillers[2]);
    assert.ok(invitation, 'the refused invitation is still waiting');
    assert.equal((await api.delete(`/users/${fillers[2].id}`, { token: admin.token })).status, 204);
    assert.ok((await thesis(lia, liaThesis)).invitations.every((i) => i.id !== invitation.id));
  });
});
