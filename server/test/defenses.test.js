import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import db from '../src/database/index.js';
import { daysFromNow, makeUser, startApi } from './helpers.js';

const api = await startApi();

// Steps build on each other, following one final defense from scheduled to decided
let admin;
let adviser;
let panelA;
let panelB;
let outsider;
let student;
let thesisId;
let defenseId;

const scores = (content, methodology, presentation, answers) => ({ content, methodology, presentation, answers });
const open = (who, id = defenseId) => api.get(`/defenses/${id}`, { token: who.token });
const evaluate = (who, body, id = defenseId) => api.put(`/defenses/${id}/evaluation`, { token: who.token, body });

// The API refuses to schedule in the past, so a defense that "already happened" is moved back here
const moveToPast = (id) => db.prepare("UPDATE schedules SET starts_at = datetime('now', '-2 hours') WHERE id = ?").run(id);

async function scheduleDefense(panelistIds, title = 'Final defense') {
  const res = await api.post('/schedules', {
    token: admin.token,
    body: {
      thesisId,
      type: 'final_defense',
      title,
      startsAt: daysFromNow(5, 2),
      durationMinutes: 120,
      mode: 'in_person',
      location: 'AVR 1',
      notes: '',
      panelistIds,
    },
  });
  assert.equal(res.status, 201);
  return res.data.id;
}

before(async () => {
  admin = await makeUser(api, { name: 'Defense Admin', email: 'd-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Adviser', email: 'd-adviser@tms.edu', role: 'adviser' });
  panelA = await makeUser(api, { name: 'Dr Aquino', email: 'aquino@tms.edu', role: 'adviser' });
  panelB = await makeUser(api, { name: 'Dr Bernal', email: 'bernal@tms.edu', role: 'adviser' });
  outsider = await makeUser(api, { name: 'Dr Outside', email: 'outside@tms.edu', role: 'adviser' });
  student = await makeUser(api, { name: 'Sam Reyes', email: 'sam-d@tms.edu' });

  thesisId = (await api.post('/theses', { token: student.token, body: { title: 'Defended thesis' } })).data.id;
  await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
  defenseId = await scheduleDefense([panelA.id, panelB.id]);
});

describe('before the defense', () => {
  it("doesn't take scores for a defense that hasn't happened", async () => {
    const res = await evaluate(panelA, { scores: scores(4, 4, 4, 4) });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /once the defense has started/);
    assert.equal((await open(panelA)).data.canEvaluate, false);
  });
});

describe('scoring', () => {
  before(() => moveToPast(defenseId));

  it('lets a panelist score and write remarks', async () => {
    const res = await evaluate(panelA, { scores: scores(4, 3, 5, 4), remarks: 'Strong results chapter.' });
    assert.equal(res.status, 200);
    assert.equal(res.data.methodology, 3);
    assert.equal(res.data.panelist_name, 'Dr Aquino');
  });

  it('lets a panelist revise their scores before the verdict', async () => {
    await evaluate(panelA, { scores: scores(4, 4, 5, 4), remarks: 'Strong results chapter. Methods clarified.' });
    const { myEvaluation } = (await open(panelA)).data;
    assert.equal(myEvaluation.methodology, 4, 'the second save replaced the first');
  });

  it('rejects a score outside 1 to 5, or a missing one', async () => {
    assert.equal((await evaluate(panelB, { scores: scores(0, 3, 3, 3) })).status, 400);
    assert.equal((await evaluate(panelB, { scores: scores(6, 3, 3, 3) })).status, 400);
    assert.equal((await evaluate(panelB, { scores: { content: 3 } })).status, 400);
  });

  it('only lets this defense\'s panelists score it', async () => {
    assert.equal((await evaluate(adviser, { scores: scores(5, 5, 5, 5) })).status, 403, "the thesis's own adviser is not on the panel");
    assert.equal((await evaluate(student, { scores: scores(5, 5, 5, 5) })).status, 403);
    assert.equal((await evaluate(outsider, { scores: scores(5, 5, 5, 5) })).status, 404, "an adviser with no link to it can't even see it");
  });

  it("keeps each panelist's scores from the others until the verdict", async () => {
    await evaluate(panelB, { scores: scores(3, 3, 4, 2), remarks: 'Needs a stronger defense of the sample size.' });

    const seenByA = (await open(panelA)).data;
    assert.deepEqual(seenByA.evaluations, [], "panelist A can't see B's scores yet");
    assert.equal(seenByA.myEvaluation.content, 4, 'but sees their own');
    assert.equal(seenByA.submittedCount, 2, 'and knows how many are in');
  });

  it('shows students and the adviser nothing until the verdict', async () => {
    for (const who of [student, adviser]) {
      const { data } = await open(who);
      assert.deepEqual(data.evaluations, []);
      assert.equal(data.summary, null);
      assert.equal(data.verdict, null);
    }
  });

  it('shows the admin every score, with averages', async () => {
    const { data } = await open(admin);
    assert.equal(data.evaluations.length, 2);
    // content (4+3)/2, methodology (4+3)/2, presentation (5+4)/2, answers (4+2)/2
    assert.deepEqual(data.summary.averages, { content: 3.5, methodology: 3.5, presentation: 4.5, answers: 3 });
    assert.equal(data.summary.overall, 3.63);
    assert.equal(data.canRecordVerdict, true);
  });
});

describe('recording the verdict', () => {
  it('needs an explanation for anything short of a pass', async () => {
    const res = await api.post(`/defenses/${defenseId}/verdict`, { token: admin.token, body: { verdict: 'passed_with_revisions' } });
    assert.equal(res.status, 400);
  });

  it('is for admins only', async () => {
    const res = await api.post(`/defenses/${defenseId}/verdict`, { token: panelA.token, body: { verdict: 'passed' } });
    assert.equal(res.status, 403);
  });

  it('records the decision, completes the event, logs it, and tells everyone involved', async () => {
    const res = await api.post(`/defenses/${defenseId}/verdict`, {
      token: admin.token,
      body: { verdict: 'passed_with_revisions', notes: 'Revise the sample size discussion within two weeks.' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.verdict, 'passed_with_revisions');
    assert.equal(res.data.recorded_by_name, 'Defense Admin');

    const event = (await api.get('/schedules?range=past', { token: admin.token })).data.find((e) => e.id === defenseId);
    assert.equal(event.status, 'completed');

    const audit = (await api.get('/audit', { token: admin.token })).data.entries[0];
    assert.equal(audit.action, 'thesis.defense_verdict');
    assert.equal(audit.details, 'Final defense: Passed with revisions');

    const told = async (who) => (await api.get('/notifications', { token: who.token })).data.notifications.map((n) => n.title);
    for (const who of [student, adviser, panelA, panelB]) {
      assert.ok((await told(who)).includes('Final defense: Passed with revisions'));
    }
  });

  it('now shows the student the verdict, the averages, and the panel\'s remarks', async () => {
    const { data } = await open(student);
    assert.equal(data.verdict.verdict, 'passed_with_revisions');
    assert.equal(data.summary.overall, 3.63);
    assert.equal(data.evaluations.length, 2);
    assert.ok(data.evaluations.some((e) => e.remarks.includes('sample size')));
  });

  it('now lets panelists see each other\'s scores', async () => {
    assert.equal((await open(panelA)).data.evaluations.length, 2);
  });

  it('locks the scores and refuses a second verdict', async () => {
    const change = await evaluate(panelA, { scores: scores(5, 5, 5, 5) });
    assert.equal(change.status, 400);
    assert.match(change.data.error, /can no longer change/);

    const again = await api.post(`/defenses/${defenseId}/verdict`, { token: admin.token, body: { verdict: 'failed', notes: 'x' } });
    assert.equal(again.status, 409);
  });
});

describe('edge cases', () => {
  it("won't record a verdict before any panelist has scored", async () => {
    const empty = await scheduleDefense([panelA.id], 'Proposal defense rerun');
    moveToPast(empty);
    const res = await api.post(`/defenses/${empty}/verdict`, { token: admin.token, body: { verdict: 'passed' } });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /at least one panelist/);
  });

  it('treats a consultation as not a defense', async () => {
    const consult = await api.post('/schedules', {
      token: adviser.token,
      body: { thesisId, type: 'consultation', title: 'Check-in', startsAt: daysFromNow(4, 2), durationMinutes: 30, mode: 'online', location: 'https://meet.google.com/x', notes: '' },
    });
    assert.equal((await open(adviser, consult.data.id)).status, 404);
  });

  it("keeps a panelist's name on the result after their account is deleted", async () => {
    await api.delete(`/users/${panelB.id}`, { token: admin.token });
    const { data } = await open(student);
    assert.ok(data.evaluations.some((e) => e.panelist_name === 'Dr Bernal' && e.panelist_id === null));
  });
});
