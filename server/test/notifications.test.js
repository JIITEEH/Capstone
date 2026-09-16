import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import db from '../src/database/index.js';
import { daysFromNow, makeUser, startApi } from './helpers.js';

const api = await startApi();

// Steps build on each other, following one thesis from forming a group to a scheduled consultation
let admin;
let adviser;
let leader;
let member;
let thesisId;
let submissionId;

const feed = async (who) => (await api.get('/notifications', { token: who.token })).data;
const titles = async (who) => (await feed(who)).notifications.map((n) => n.title);

before(async () => {
  admin = await makeUser(api, { name: 'Notify Admin', email: 'n-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Bautista', email: 'bautista@tms.edu', role: 'adviser' });
  leader = await makeUser(api, { name: 'Lea Santos', email: 'lea@tms.edu' });
  member = await makeUser(api, { name: 'Mark Dizon', email: 'mark@tms.edu' });
  thesisId = (await api.post('/theses', { token: leader.token, body: { title: 'Notified thesis' } })).data.id;
});

describe('who gets told what', () => {
  it('tells a student they were added to a group', async () => {
    const res = await api.post(`/theses/${thesisId}/members`, { token: leader.token, body: { email: 'mark@tms.edu' } });
    assert.equal(res.status, 201);

    assert.ok((await titles(member)).includes('You were added to a thesis group'));
    assert.equal((await titles(leader)).length, 0, 'the leader who added them is not told about their own action');
  });

  it('tells the adviser and the group when an adviser is assigned', async () => {
    await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });

    assert.ok((await titles(adviser)).includes('You have a new advisee'));
    assert.ok((await titles(leader)).includes('Dr Bautista is now your adviser'));
    assert.ok((await titles(member)).includes('Dr Bautista is now your adviser'));
    assert.equal((await titles(admin)).length, 0);
  });

  it('tells the adviser and groupmates about a new submission, but not the submitter', async () => {
    const upload = await api.upload(leader.token, thesisId, 'proposal');
    assert.equal(upload.status, 201);
    submissionId = upload.data.id;

    assert.ok((await titles(adviser)).includes('Proposal submitted for review'));
    assert.ok((await titles(member)).includes('Proposal submitted for review'));
    assert.ok(!(await titles(leader)).includes('Proposal submitted for review'));
  });

  it('links a notification to where the change happened', async () => {
    const note = (await feed(adviser)).notifications.find((n) => n.title === 'Proposal submitted for review');
    assert.equal(note.link, `/submissions/${submissionId}`);
    assert.equal(note.actor_name, 'Lea Santos');
  });

  it('tells the group about a review decision, but not the reviewer', async () => {
    await api.patch(`/submissions/${submissionId}/review`, {
      token: adviser.token,
      body: { decision: 'revisions_requested', feedback: 'Narrow the scope.' },
    });

    assert.ok((await titles(leader)).includes('Revisions requested on Proposal'));
    assert.ok((await titles(member)).includes('Revisions requested on Proposal'));
    assert.ok(!(await titles(adviser)).includes('Revisions requested on Proposal'));
  });

  it('tells everyone else in the conversation about a comment', async () => {
    await api.post(`/submissions/${submissionId}/comments`, { token: member.token, body: { body: 'I can take the scope section.' } });

    const expected = 'Mark Dizon commented on Proposal';
    assert.ok((await titles(leader)).includes(expected));
    assert.ok((await titles(adviser)).includes(expected));
    assert.ok(!(await titles(member)).includes(expected), 'the author is not told about their own comment');

    const note = (await feed(adviser)).notifications.find((n) => n.title === expected);
    assert.equal(note.body, 'I can take the scope section.', 'the comment itself is in the notification');
  });

  it('tells the group about a scheduled consultation', async () => {
    const res = await api.post('/schedules', {
      token: adviser.token,
      body: {
        thesisId,
        type: 'consultation',
        title: 'Scope check-in',
        startsAt: daysFromNow(3, 2),
        durationMinutes: 45,
        mode: 'online',
        location: 'https://meet.google.com/abc-defg-hij',
        notes: '',
      },
    });
    assert.equal(res.status, 201);

    assert.ok((await titles(leader)).includes('Consultation scheduled'));
    assert.ok((await titles(member)).includes('Consultation scheduled'));
  });
});

describe('reading and dismissing', () => {
  it('counts what is unread, and marks one or all as read', async () => {
    const start = await feed(leader);
    assert.ok(start.unread >= 3);

    const first = start.notifications[0];
    const one = await api.post(`/notifications/${first.id}/read`, { token: leader.token });
    assert.equal(one.status, 200);
    assert.equal(one.data.unread, start.unread - 1);

    const all = await api.post('/notifications/read-all', { token: leader.token });
    assert.equal(all.data.unread, 0);
    assert.ok((await feed(leader)).notifications.every((n) => n.read_at), 'every notification now has a read time');
  });

  it("can't mark someone else's notification as read", async () => {
    const theirs = (await feed(adviser)).notifications.find((n) => !n.read_at);
    const res = await api.post(`/notifications/${theirs.id}/read`, { token: leader.token });

    assert.equal(res.status, 404);
    assert.equal((await feed(adviser)).notifications.find((n) => n.id === theirs.id).read_at, null, 'still unread');
  });

  it('shows each person only their own', async () => {
    assert.ok(!(await titles(leader)).includes('You have a new advisee'), "the adviser's notification isn't in a student's feed");
  });

  it('needs you to be signed in', async () => {
    assert.equal((await api.get('/notifications')).status, 401);
  });
});

describe('when nothing should be sent', () => {
  it('sends nothing for an action that was refused', async () => {
    const before = (await feed(leader)).notifications.length;
    const again = await api.patch(`/submissions/${submissionId}/review`, { token: adviser.token, body: { decision: 'approved' } });

    assert.equal(again.status, 400, 'the submission was already reviewed');
    assert.equal((await feed(leader)).notifications.length, before);
  });

  it("removes a person's notifications when their account is deleted", async () => {
    const leaving = await makeUser(api, { name: 'Leaving', email: 'leaving@tms.edu' });
    await api.post(`/theses/${thesisId}/members`, { token: leader.token, body: { email: 'leaving@tms.edu' } });
    assert.ok((await feed(leaving)).notifications.length > 0);

    await api.delete(`/users/${leaving.id}`, { token: admin.token });
    const left = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?').get(leaving.id).n;
    assert.equal(left, 0);
  });
});
