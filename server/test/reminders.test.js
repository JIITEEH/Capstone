import './setup.js';
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import db from '../src/database/index.js';
import { sendDeadlineReminders } from '../src/database/reminders.js';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// Every thesis joins one term with fixed due dates, and each run passes the day it pretends to be
// today, so the tests don't depend on the real date. Steps build on each other.
const DEADLINES = { proposal: '2026-10-10', chapters_1_3: '2026-11-10', chapters_4_5: '2026-12-10', final: '2027-01-10' };

let admin;
let adviser;
let lead;
let mate;
let solo;
let term;
let groupThesis;
let soloThesis;

// A fake mail server: records each message, and refuses any address in `refuse`
let outbox = [];
let refuse = new Set();
const send = async (message) => {
  if (refuse.has(message.to)) throw Object.assign(new Error('Mailbox unavailable'), { code: 'EENVELOPE' });
  outbox.push(message);
  return { sent: true };
};
const run = (today) => sendDeadlineReminders({ today, send });

const titles = async (who) =>
  (await api.get('/notifications', { token: who.token })).data.notifications
    .filter((n) => n.type.startsWith('deadline.'))
    .map((n) => n.title);

beforeEach(() => {
  outbox = [];
  refuse = new Set();
});

before(async () => {
  admin = await makeUser(api, { name: 'Remind Admin', email: 'r-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Reyes', email: 'reyes@tms.edu', role: 'adviser' });
  lead = await makeUser(api, { name: 'Lia Ramos', email: 'lia@tms.edu' });
  mate = await makeUser(api, { name: 'Migs Uy', email: 'migs@tms.edu' });
  solo = await makeUser(api, { name: 'Sol Tan', email: 'sol@tms.edu' });

  term = (
    await api.post('/terms', {
      token: admin.token,
      body: { name: 'Reminder term', startsOn: '2026-08-01', endsOn: '2027-05-31', deadlines: DEADLINES },
    })
  ).data;

  groupThesis = (await api.post('/theses', { token: lead.token, body: { title: 'Group thesis' } })).data;
  await api.post(`/theses/${groupThesis.id}/members`, { token: admin.token, body: { email: 'migs@tms.edu' } });
  await api.patch(`/theses/${groupThesis.id}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });

  // The solo group has already submitted its proposal, so its next deadline is Chapters 1–3
  soloThesis = (await api.post('/theses', { token: solo.token, body: { title: 'Solo thesis' } })).data;
  assert.equal((await api.upload(solo.token, soloThesis.id, 'proposal')).status, 201);
});

describe('before a deadline', () => {
  it('sends nothing more than 3 days out', async () => {
    assert.deepEqual(await run('2026-10-06'), { reminders: 0, notified: 0, emailed: 0, emailFailures: [] });
  });

  it('notifies and emails every member 3 days before, but not the adviser', async () => {
    const summary = await run('2026-10-07');
    assert.deepEqual(summary, { reminders: 1, notified: 2, emailed: 2, emailFailures: [] });

    assert.deepEqual(await titles(lead), ['Proposal is due in 3 days']);
    assert.deepEqual(await titles(mate), ['Proposal is due in 3 days']);
    assert.deepEqual(await titles(adviser), []);
    assert.deepEqual(await titles(solo), [], 'a stage already submitted is not reminded');
    const [notification] = (await api.get('/notifications', { token: lead.token })).data.notifications;
    assert.equal(notification.body, 'Submit it by the end of Oct 10, 2026.');
    assert.equal(notification.link, '/thesis');

    assert.deepEqual(outbox.map((m) => m.to).sort(), ['lia@tms.edu', 'migs@tms.edu']);
    const [email] = outbox;
    assert.equal(email.subject, 'ThesisTrack: Proposal is due in 3 days');
    assert.match(email.text, /Submit it by the end of Oct 10, 2026/);
    assert.match(email.text, /Thesis: Group thesis/);
    assert.match(email.text, /http:\/\/localhost:5173\/thesis/);
  });

  it('never sends the same reminder twice', async () => {
    assert.equal((await run('2026-10-07')).reminders, 0);
    assert.equal((await run('2026-10-09')).reminders, 0, 'still due soon, already reminded');
    assert.deepEqual(await titles(lead), ['Proposal is due in 3 days']);
    assert.deepEqual(outbox, []);
  });
});

describe('after a deadline', () => {
  it('reminds once the day has passed with nothing submitted', async () => {
    assert.equal((await run('2026-10-10')).reminders, 0, 'due today is not overdue yet');

    const summary = await run('2026-10-11');
    assert.equal(summary.reminders, 1);
    assert.deepEqual(await titles(mate), ['Proposal is overdue', 'Proposal is due in 3 days']);
    assert.match(outbox[0].text, /It was due on Oct 10, 2026 and nothing has been submitted for it yet/);

    assert.equal((await run('2026-10-12')).reminders, 0);
  });

  it("doesn't remind about a deadline missed long ago", async () => {
    db.prepare('DELETE FROM deadline_reminders').run();
    assert.equal((await run('2026-10-25')).reminders, 0, '15 days late is past the 7-day window');
  });

  it('reminds again when an admin moves the due date', async () => {
    const moved = await api.put(`/terms/${term.id}`, {
      token: admin.token,
      body: { name: 'Reminder term', startsOn: '2026-08-01', endsOn: '2027-05-31', deadlines: { ...DEADLINES, proposal: '2026-10-28' } },
    });
    assert.equal(moved.status, 200);

    assert.equal((await run('2026-10-26')).reminders, 1);
    assert.equal((await titles(lead))[0], 'Proposal is due in 2 days');
  });
});

describe('who is emailed', () => {
  it('keeps going when one email fails, and reports it', async () => {
    await api.put(`/terms/${term.id}`, {
      token: admin.token,
      body: { name: 'Reminder term', startsOn: '2026-08-01', endsOn: '2027-05-31', deadlines: { ...DEADLINES, proposal: '2026-11-01' } },
    });
    refuse.add('lia@tms.edu');

    const summary = await run('2026-10-31');
    assert.equal(summary.reminders, 1);
    assert.equal(summary.notified, 2, 'the bell still shows it to everyone');
    assert.equal(summary.emailed, 1);
    assert.deepEqual(summary.emailFailures.map((f) => f.to), ['lia@tms.edu']);
    assert.match(summary.emailFailures[0].error, /refused the sender or recipient/);
  });

  it("doesn't email a deactivated account", async () => {
    await api.put(`/terms/${term.id}`, {
      token: admin.token,
      body: { name: 'Reminder term', startsOn: '2026-08-01', endsOn: '2027-05-31', deadlines: { ...DEADLINES, proposal: '2026-11-05' } },
    });
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(mate.id);

    const summary = await run('2026-11-04');
    assert.equal(summary.emailed, 1);
    assert.deepEqual(outbox.map((m) => m.to), ['lia@tms.edu']);
    db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(mate.id);
  });
});

describe('theses that get no reminders', () => {
  it('skips completed theses and theses without a term', async () => {
    await api.patch(`/theses/${groupThesis.id}/status`, { token: admin.token, body: { status: 'completed' } });
    db.prepare('UPDATE theses SET term_id = NULL WHERE id = ?').run(soloThesis.id);

    assert.equal((await run('2026-11-07')).reminders, 0, 'Chapters 1–3 is 3 days out, but neither thesis qualifies');
    db.prepare('UPDATE theses SET term_id = ? WHERE id = ?').run(term.id, soloThesis.id);
    assert.equal((await run('2026-11-07')).reminders, 1, 'the solo group is reminded once it has a term again');
  });

  it('forgets reminders when the thesis is deleted', async () => {
    assert.equal((await api.delete(`/theses/${soloThesis.id}`, { token: admin.token })).status, 204);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM deadline_reminders WHERE thesis_id = ?').get(soloThesis.id).n, 0);
  });
});
