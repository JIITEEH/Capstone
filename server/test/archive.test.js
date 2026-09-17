import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let adviser;
let finished;
let overridden;
let working;
let finishedId;
let overriddenId;
let workingId;

const STAGES = ['proposal', 'chapters_1_3', 'chapters_4_5', 'final'];
const year = new Date().getUTCFullYear();
const archive = async (who, query = '') => (await api.get(`/archive${query}`, { token: who.token })).data;
const listed = async (who, query) => (await archive(who, query)).items.map((t) => t.id);

// Submits and approves every stage, which completes the thesis
async function finishThesis(student, thesisId) {
  for (const stage of STAGES) {
    const upload = await api.upload(student.token, thesisId, stage, { name: `${stage}.pdf` });
    await api.patch(`/submissions/${upload.data.id}/review`, { token: adviser.token, body: { decision: 'approved' } });
  }
}

async function startThesis(student, title, abstract, keywords) {
  const res = await api.post('/theses', { token: student.token, body: { title, abstract, keywords } });
  await api.patch(`/theses/${res.data.id}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
  return res.data.id;
}

before(async () => {
  admin = await makeUser(api, { name: 'Archive Admin', email: 'a-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Archive', email: 'a-adviser@tms.edu', role: 'adviser' });
  finished = await makeUser(api, { name: 'Fiona Finished', email: 'fiona@tms.edu' });
  overridden = await makeUser(api, { name: 'Oscar Override', email: 'oscar@tms.edu' });
  working = await makeUser(api, { name: 'Wendy Working', email: 'wendy@tms.edu' });

  finishedId = await startThesis(finished, 'Mangrove Mapping with Drones', 'Counting mangrove cover from aerial images.', 'remote sensing, ecology');
  await finishThesis(finished, finishedId);
  overriddenId = await startThesis(overridden, 'Jeepney Route Planner', 'Shortest commutes across the city.', 'transport');
  await api.patch(`/theses/${overriddenId}/status`, { token: admin.token, body: { status: 'completed' } });
  workingId = await startThesis(working, 'Unfinished Study', 'Still being written.', 'draft');
});

describe('browsing the archive', () => {
  it('lists only completed theses, with public details', async () => {
    const res = await archive(admin);
    assert.equal(res.total, 2);
    assert.deepEqual(res.items.map((t) => t.id).sort(), [finishedId, overriddenId].sort());
    assert.deepEqual(res.years, [year]);

    const mangrove = res.items.find((t) => t.id === finishedId);
    assert.equal(mangrove.student_name, 'Fiona Finished');
    assert.equal(mangrove.adviser_name, 'Dr Archive');
    assert.ok(mangrove.manuscript_id, 'the approved final manuscript is linked');
    assert.equal(res.items.find((t) => t.id === overriddenId).manuscript_id, null);
    assert.ok(res.items.every((t) => !('email' in t) && !('adviser_email' in t)), 'no email addresses');
  });

  it('is open to every signed-in role, and no one else', async () => {
    assert.equal((await archive(working)).total, 2, 'a student still working can learn from finished theses');
    assert.equal((await archive(adviser)).total, 2);
    assert.equal((await api.get('/archive')).status, 401);
  });

  it('searches titles, abstracts, keywords, and student names, and filters by year', async () => {
    assert.deepEqual(await listed(working, '?search=aerial'), [finishedId]);
    assert.deepEqual(await listed(working, '?search=transport'), [overriddenId]);
    assert.deepEqual(await listed(working, '?search=Fiona'), [finishedId]);
    assert.deepEqual(await listed(working, '?search=Unfinished'), []);
    assert.equal((await archive(working, `?year=${year}`)).total, 2);
    assert.equal((await archive(working, '?year=1999')).total, 0);
  });

  it('opens a completed thesis, but not one still in progress', async () => {
    const res = await api.get(`/archive/${finishedId}`, { token: working.token });
    assert.equal(res.status, 200);
    assert.equal(res.data.title, 'Mangrove Mapping with Drones');
    assert.equal((await api.get(`/archive/${workingId}`, { token: finished.token })).status, 404);
    assert.equal((await api.get('/archive/abc', { token: finished.token })).status, 404);
  });
});

describe('downloading a final manuscript', () => {
  it('gives anyone signed in the approved final manuscript', async () => {
    const res = await api.get(`/archive/${finishedId}/manuscript`, { token: working.token });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /final\.pdf/);
  });

  it('has nothing for a thesis without one, or one not in the archive', async () => {
    assert.equal((await api.get(`/archive/${overriddenId}/manuscript`, { token: working.token })).status, 404);
    assert.equal((await api.get(`/archive/${workingId}/manuscript`, { token: finished.token })).status, 404);
  });
});

describe('keeping a thesis out of the archive', () => {
  const setArchived = (who, inArchive) => api.patch(`/theses/${finishedId}/archive`, { token: who.token, body: { inArchive } });

  it('lets an admin hide a thesis, with an audit record', async () => {
    const res = await setArchived(admin, false);
    assert.equal(res.status, 200);
    assert.equal(res.data.in_archive, 0);

    assert.deepEqual(await listed(working), [overriddenId]);
    assert.equal((await api.get(`/archive/${finishedId}`, { token: working.token })).status, 404);
    assert.equal((await api.get(`/archive/${finishedId}/manuscript`, { token: working.token })).status, 404);
    assert.equal((await api.get('/audit', { token: admin.token })).data.entries[0].action, 'thesis.archive_hidden');
  });

  it('is for admins only, and needs a yes or no', async () => {
    assert.equal((await setArchived(finished, true)).status, 403);
    assert.equal((await setArchived(adviser, true)).status, 403);
    assert.equal((await setArchived(admin, 'yes')).status, 400);
  });

  it('puts it back', async () => {
    assert.equal((await setArchived(admin, true)).status, 200);
    assert.equal((await archive(working)).total, 2);
  });
});
