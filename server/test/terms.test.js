import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// Steps build on each other: two terms, and three theses measured against their deadlines
let admin;
let adviser;
let ana;
let ben;
let cy;
let firstTerm;
let secondTerm;
let anaThesis;
let benThesis;

// A calendar day relative to today, in the server's time zone, as YYYY-MM-DD
function day(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const termBody = (overrides = {}) => ({
  name: '1st Semester 2026–2027',
  startsOn: day(-30),
  endsOn: day(120),
  deadlines: { proposal: day(-1), chapters_1_3: day(5), chapters_4_5: day(60) },
  ...overrides,
});
const thesis = async (id) => (await api.get(`/theses/${id}`, { token: admin.token })).data;
const listIds = async (query) => (await api.get(`/theses?${query}`, { token: admin.token })).data.map((t) => t.id);

before(async () => {
  admin = await makeUser(api, { name: 'Term Admin', email: 't-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Lim', email: 'lim@tms.edu', role: 'adviser' });
  ana = await makeUser(api, { name: 'Ana Term', email: 'ana-t@tms.edu' });
  ben = await makeUser(api, { name: 'Ben Term', email: 'ben-t@tms.edu' });
  cy = await makeUser(api, { name: 'Cy Early', email: 'cy-t@tms.edu' });
});

describe('setting up terms', () => {
  it('leaves theses without a term until one exists', async () => {
    const early = await api.post('/theses', { token: cy.token, body: { title: 'Before any term' } });
    assert.equal(early.data.term_id, null);
    assert.equal(early.data.next_due_on, null);
  });

  it('lets an admin create a term with due dates, and makes the first one current', async () => {
    const res = await api.post('/terms', { token: admin.token, body: termBody() });
    assert.equal(res.status, 201);
    firstTerm = res.data;
    assert.equal(firstTerm.is_current, 1);
    assert.deepEqual(firstTerm.deadlines, { proposal: day(-1), chapters_1_3: day(5), chapters_4_5: day(60) });
  });

  it('checks names and dates', async () => {
    const post = (body) => api.post('/terms', { token: admin.token, body: termBody(body) });
    assert.equal((await post({ name: '1ST SEMESTER 2026–2027' })).status, 409, 'names are unique, ignoring case');
    assert.equal((await post({ name: ' ' })).status, 400);
    assert.match((await post({ name: 'Bad date', startsOn: '2026-02-30' })).data.error, /date like/);
    assert.match((await post({ name: 'Backwards', startsOn: day(10), endsOn: day(1) })).data.error, /end after it starts/);

    const outOfOrder = await post({ name: 'Out of order', deadlines: { proposal: day(20), chapters_1_3: day(10) } });
    assert.equal(outOfOrder.status, 400);
    assert.match(outOfOrder.data.error, /Chapters 1–3 can't be due before Proposal/);
  });

  it('is for admins only', async () => {
    assert.equal((await api.get('/terms', { token: ana.token })).status, 403);
    assert.equal((await api.get('/terms', { token: adviser.token })).status, 403);
    assert.equal((await api.post('/terms', { token: adviser.token, body: termBody({ name: 'Nope' }) })).status, 403);
  });

  it('puts new theses in the current term', async () => {
    anaThesis = (await api.post('/theses', { token: ana.token, body: { title: 'Ana thesis' } })).data;
    benThesis = (await api.post('/theses', { token: ben.token, body: { title: 'Ben thesis' } })).data;
    assert.equal(anaThesis.term_id, firstTerm.id);
    assert.equal(anaThesis.term_name, '1st Semester 2026–2027');
  });
});

describe('deadlines', () => {
  it('shows a group as overdue when a due date passed with nothing submitted', async () => {
    const ana1 = await thesis(anaThesis.id);
    assert.equal(ana1.thesis.next_due_stage, 'proposal');
    assert.equal(ana1.thesis.next_due_days_left, -1);
    assert.deepEqual(
      ana1.deadlines.map((d) => [d.stage, d.state]),
      [['proposal', 'missed'], ['chapters_1_3', 'upcoming'], ['chapters_4_5', 'upcoming']],
    );
  });

  it('moves on to the next deadline once the stage is submitted, and marks the late one', async () => {
    assert.equal((await api.upload(ben.token, benThesis.id, 'proposal')).status, 201);

    const ben1 = await thesis(benThesis.id);
    assert.equal(ben1.thesis.next_due_stage, 'chapters_1_3');
    assert.equal(ben1.thesis.next_due_days_left, 5);
    assert.equal(ben1.deadlines[0].state, 'late');
    assert.equal(ben1.deadlines[0].first_submitted_on, day(0));
  });

  it('filters the list to overdue theses', async () => {
    assert.deepEqual(await listIds('deadline=overdue'), [anaThesis.id]);
    assert.deepEqual(await listIds('deadline=overdue&search=Ben'), []);
  });

  it('counts overdue theses on the admin dashboard', async () => {
    assert.equal((await api.get('/dashboard', { token: admin.token })).data.stats.overdue, 1);
  });

  it('recalculates when an admin changes the due dates', async () => {
    const res = await api.put(`/terms/${firstTerm.id}`, {
      token: admin.token,
      body: termBody({ deadlines: { proposal: day(0), chapters_1_3: day(5) } }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.data.deadlines), ['proposal', 'chapters_1_3'], 'a cleared date is removed');

    assert.equal((await thesis(benThesis.id)).deadlines[0].state, 'met', 'submitted on the day it was due');
    const ana2 = await thesis(anaThesis.id);
    assert.equal(ana2.thesis.next_due_days_left, 0, 'due today is not overdue yet');
    assert.deepEqual(await listIds('deadline=overdue'), []);
  });

  it('drops the deadline once a thesis is completed', async () => {
    await api.put(`/terms/${firstTerm.id}`, { token: admin.token, body: termBody() });
    await api.patch(`/theses/${anaThesis.id}/status`, { token: admin.token, body: { status: 'completed' } });
    assert.equal((await thesis(anaThesis.id)).thesis.next_due_on, null);
    assert.deepEqual(await listIds('deadline=overdue'), []);
    await api.patch(`/theses/${anaThesis.id}/status`, { token: admin.token, body: { status: 'draft' } });
  });

  it('adds the term and deadline to the CSV export', async () => {
    const res = await api.get('/theses/export.csv?deadline=overdue', { token: admin.token });
    const [header, row] = res.data.replace('﻿', '').trim().split('\r\n');
    assert.match(header, /Term,Next due,Overdue/);
    assert.match(row, /1st Semester 2026–2027,Proposal, [\d-]+",Yes|1st Semester 2026–2027,"Proposal, [\d-]+",Yes/);
  });
});

describe('moving theses between terms', () => {
  it('makes a newly created term current when asked', async () => {
    const res = await api.post('/terms', {
      token: admin.token,
      body: termBody({ name: '2nd Semester 2026–2027', startsOn: day(121), endsOn: day(240), deadlines: {}, isCurrent: true }),
    });
    secondTerm = res.data;
    assert.equal(secondTerm.is_current, 1);
    const terms = (await api.get('/terms', { token: admin.token })).data;
    assert.deepEqual(terms.filter((t) => t.is_current).map((t) => t.id), [secondTerm.id]);
    assert.equal(terms.find((t) => t.id === firstTerm.id).thesis_count, 2);
  });

  it('lets an admin move a thesis, with an audit record', async () => {
    const res = await api.patch(`/theses/${benThesis.id}/term`, { token: admin.token, body: { termId: secondTerm.id } });
    assert.equal(res.status, 200);
    assert.equal(res.data.term_name, '2nd Semester 2026–2027');
    assert.equal(res.data.next_due_on, null, 'the new term has no due dates');

    const [entry] = (await api.get('/audit', { token: admin.token })).data.entries;
    assert.equal(entry.action, 'thesis.term_changed');
    assert.equal(entry.details, '1st Semester 2026–2027 → 2nd Semester 2026–2027');
  });

  it('refuses unknown terms and non-admins', async () => {
    assert.equal((await api.patch(`/theses/${benThesis.id}/term`, { token: admin.token, body: { termId: 999 } })).status, 400);
    assert.equal((await api.patch(`/theses/${benThesis.id}/term`, { token: ben.token, body: { termId: firstTerm.id } })).status, 403);
  });

  it('filters by term, or by having none', async () => {
    const cyThesis = (await api.get('/theses', { token: cy.token })).data[0];
    assert.deepEqual(await listIds(`term=${secondTerm.id}`), [benThesis.id]);
    assert.deepEqual(await listIds('term=none'), [cyThesis.id]);
  });

  it("won't delete a term that still has theses", async () => {
    const res = await api.delete(`/terms/${firstTerm.id}`, { token: admin.token });
    assert.equal(res.status, 409);
    assert.match(res.data.error, /1 thesis is in this term/);

    await api.patch(`/theses/${benThesis.id}/term`, { token: admin.token, body: { termId: null } });
    assert.equal((await api.delete(`/terms/${secondTerm.id}`, { token: admin.token })).status, 204);
    assert.equal((await api.put(`/terms/${secondTerm.id}`, { token: admin.token, body: termBody({ name: 'Gone' }) })).status, 404);
  });
});
