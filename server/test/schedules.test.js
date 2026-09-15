import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { daysFromNow, makeUser, startApi } from './helpers.js';

const api = await startApi();

// Steps in this file build on each other, using one thesis with an adviser
let admin;
let adviser;
let panelist;
let student;
let outsider;
let thesisId;
let consultationId;
let defenseId;

const event = (overrides = {}) => ({
  thesisId,
  type: 'consultation',
  title: 'Check-in',
  startsAt: daysFromNow(3, 2),
  durationMinutes: 60,
  mode: 'online',
  location: 'https://meet.google.com/abc-defg-hij',
  notes: '',
  ...overrides,
});

before(async () => {
  admin = await makeUser(api, { name: 'Ada Admin', email: 'admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr. Maria Santos', email: 'santos@tms.edu', role: 'adviser' });
  panelist = await makeUser(api, { name: 'Dr. Panel', email: 'panel@tms.edu', role: 'adviser' });
  student = await makeUser(api, { name: 'Sam Student', email: 'sam@tms.edu' });
  outsider = await makeUser(api, { name: 'Tia Outsider', email: 'tia@tms.edu' });

  thesisId = (await api.post('/theses', { token: student.token, body: { title: 'Scheduled Thesis' } })).data.id;
});

describe('scheduling rules', () => {
  it('needs an adviser assigned before anything can be scheduled', async () => {
    const res = await api.post('/schedules', { token: admin.token, body: event() });
    assert.equal(res.status, 400);
    await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
  });

  it('lets the adviser schedule a consultation in the future', async () => {
    const past = await api.post('/schedules', { token: adviser.token, body: event({ startsAt: new Date(Date.now() - 86400000).toISOString() }) });
    assert.equal(past.status, 400);

    const res = await api.post('/schedules', { token: adviser.token, body: event() });
    assert.equal(res.status, 201);
    consultationId = res.data.id;
  });

  it('leaves defenses to admins and scheduling to staff', async () => {
    assert.equal((await api.post('/schedules', { token: adviser.token, body: event({ type: 'final_defense', startsAt: daysFromNow(6) }) })).status, 403);
    assert.equal((await api.post('/schedules', { token: student.token, body: event({ startsAt: daysFromNow(7) }) })).status, 403);
  });

  it("doesn't let the thesis's own adviser sit on its panel", async () => {
    const res = await api.post('/schedules', {
      token: admin.token,
      body: event({ type: 'final_defense', startsAt: daysFromNow(10), panelistIds: [adviser.id] }),
    });
    assert.equal(res.status, 400);
  });

  it('rejects events that overlap for the same thesis', async () => {
    const res = await api.post('/schedules', {
      token: admin.token,
      body: event({ type: 'final_defense', startsAt: daysFromNow(3, 2), panelistIds: [panelist.id] }),
    });
    assert.equal(res.status, 409);
  });

  it('lets admins schedule a defense with a panel', async () => {
    const res = await api.post('/schedules', {
      token: admin.token,
      body: event({ type: 'final_defense', title: 'Final defense', startsAt: daysFromNow(10), durationMinutes: 120, panelistIds: [panelist.id] }),
    });
    assert.equal(res.status, 201);
    assert.deepEqual(
      res.data.panelists.map((person) => person.id),
      [panelist.id],
    );
    defenseId = res.data.id;
  });
});

describe('who sees which events', () => {
  it('shows the student both upcoming events', async () => {
    const res = await api.get('/schedules?range=upcoming', { token: student.token });
    const ids = res.data.map((item) => item.id);
    assert.ok(ids.includes(consultationId) && ids.includes(defenseId));
  });

  it('hides them from other students', async () => {
    const res = await api.get('/schedules?range=upcoming', { token: outsider.token });
    assert.ok(res.data.every((item) => item.thesis_id !== thesisId));
  });

  it('shows panelists the defense without opening the thesis', async () => {
    const res = await api.get('/schedules?range=upcoming', { token: panelist.token });
    assert.ok(res.data.some((item) => item.id === defenseId));
    assert.equal((await api.get(`/theses/${thesisId}`, { token: panelist.token })).status, 404);
  });
});

describe('changing events', () => {
  it('lets the adviser reschedule and cancel their consultation', async () => {
    const moved = await api.patch(`/schedules/${consultationId}`, { token: adviser.token, body: { startsAt: daysFromNow(4, 2) } });
    assert.equal(moved.status, 200);

    const cancelled = await api.patch(`/schedules/${consultationId}`, { token: adviser.token, body: { status: 'cancelled' } });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.status, 'cancelled');

    const past = await api.get('/schedules?range=past', { token: student.token });
    assert.ok(past.data.some((item) => item.id === consultationId));
  });

  it("doesn't let advisers edit defenses", async () => {
    assert.equal((await api.patch(`/schedules/${defenseId}`, { token: adviser.token, body: { title: 'Changed' } })).status, 403);
  });

  it('lets only admins delete events', async () => {
    assert.equal((await api.delete(`/schedules/${consultationId}`, { token: adviser.token })).status, 403);
    assert.equal((await api.delete(`/schedules/${consultationId}`, { token: admin.token })).status, 204);
  });
});
