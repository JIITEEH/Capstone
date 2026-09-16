import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// Two theses with different advisers, so each role's results can be checked against the other's
let admin;
let santos;
let reyes;
let ana;
let ben;
let carl;
let loner;
let anaThesis;
let carlThesis;
let anaProposal;
let carlProposal;

const search = async (user, q) => {
  const res = await api.get(`/search?q=${encodeURIComponent(q)}`, { token: user.token });
  assert.equal(res.status, 200);
  return res.data;
};
const ids = (rows) => rows.map((row) => row.id).sort((a, b) => a - b);

before(async () => {
  admin = await makeUser(api, { name: 'Ada Admin', email: 'admin@tms.edu', role: 'admin' });
  santos = await makeUser(api, { name: 'Dr. Maria Santos', email: 'santos@tms.edu', role: 'adviser' });
  reyes = await makeUser(api, { name: 'Dr. Jose Reyes', email: 'reyes@tms.edu', role: 'adviser' });
  ana = await makeUser(api, { name: 'Ana Cruz', email: 'ana@tms.edu' });
  ben = await makeUser(api, { name: 'Ben Cruz', email: 'ben@tms.edu' });
  carl = await makeUser(api, { name: 'Carl Cruz', email: 'carl@tms.edu' });
  loner = await makeUser(api, { name: 'Lou Cruz', email: 'lou@tms.edu' });

  anaThesis = (await api.post('/theses', { token: ana.token, body: { title: 'Rice Disease Detection' } })).data.id;
  const invitation = await api.post(`/theses/${anaThesis}/invitations`, { token: ana.token, body: { email: 'ben@tms.edu' } });
  await api.post(`/invitations/${invitation.data.id}/accept`, { token: ben.token });
  await api.patch(`/theses/${anaThesis}/adviser`, { token: admin.token, body: { adviserId: santos.id } });

  carlThesis = (await api.post('/theses', { token: carl.token, body: { title: 'Flood Warning App' } })).data.id;
  await api.patch(`/theses/${carlThesis}/adviser`, { token: admin.token, body: { adviserId: reyes.id } });

  anaProposal = (await api.upload(ana.token, anaThesis, 'proposal', { name: 'rice_proposal.pdf' })).data.id;
  // The next stage opens once the proposal is approved
  await api.patch(`/submissions/${anaProposal}/review`, { token: santos.token, body: { decision: 'approved' } });
  await api.upload(ana.token, anaThesis, 'chapters_1_3', { name: 'rice_ch1-3.pdf' });
  carlProposal = (await api.upload(carl.token, carlThesis, 'proposal', { name: 'flood_proposal.pdf' })).data.id;
});

describe('searching as an admin', () => {
  it('finds every matching thesis, person, and submission', async () => {
    const results = await search(admin, 'cruz');
    assert.deepEqual(ids(results.theses), [anaThesis, carlThesis]);
    assert.deepEqual(ids(results.people), [ana.id, ben.id, carl.id, loner.id]);
    assert.equal(results.submissions.length, 3);
  });

  it('finds advisers and admins by email', async () => {
    assert.deepEqual(ids((await search(admin, 'santos@')).people), [santos.id]);
  });

  it("says which thesis a student belongs to", async () => {
    const [person] = (await search(admin, 'ben@tms')).people;
    assert.equal(person.thesis_id, anaThesis);
    assert.equal(person.role, 'student');
  });
});

describe('searching as an adviser', () => {
  it('only finds their advisees and their work', async () => {
    const results = await search(santos, 'cruz');
    assert.deepEqual(ids(results.theses), [anaThesis]);
    assert.deepEqual(ids(results.people), [ana.id, ben.id]);
    assert.ok(results.submissions.every((submission) => submission.thesis_id === anaThesis));
    assert.equal(results.submissions.length, 2);
  });

  it("doesn't find other advisers' students by name or email", async () => {
    const results = await search(santos, 'carl');
    assert.deepEqual(results, { theses: [], people: [], submissions: [] });
  });
});

describe('searching as a student', () => {
  it('finds their group, their adviser, and their own submissions', async () => {
    assert.deepEqual(ids((await search(ben, 'cruz')).people), [ana.id]);
    assert.deepEqual(ids((await search(ben, 'santos')).people), [santos.id]);
    assert.deepEqual(ids((await search(ben, 'rice')).theses), [anaThesis]);
    assert.deepEqual(ids((await search(ben, 'proposal')).submissions), [anaProposal]);
  });

  it("doesn't find anyone or anything outside their thesis", async () => {
    assert.deepEqual(await search(ana, 'flood'), { theses: [], people: [], submissions: [] });
    assert.deepEqual(ids((await search(ana, 'reyes')).people), []);
    assert.deepEqual(ids((await search(carl, 'proposal')).submissions), [carlProposal]);
  });

  it('finds nothing before joining a thesis', async () => {
    assert.deepEqual(await search(loner, 'cruz'), { theses: [], people: [], submissions: [] });
  });
});

describe('search terms', () => {
  it('matches stage names, with a hyphen standing in for the dash', async () => {
    const results = await search(santos, 'chapters 1-3');
    assert.equal(results.submissions.length, 1);
    assert.equal(results.submissions[0].stage, 'chapters_1_3');
  });

  it('treats % and _ as ordinary characters', async () => {
    // As wildcards, %% would match every submission and o_o the "opo" in "proposal"
    assert.equal((await search(admin, '%%')).submissions.length, 0);
    assert.equal((await search(admin, 'o_o')).submissions.length, 0);
    assert.equal((await search(admin, 'e_p')).submissions.length, 1);
  });

  it('returns nothing for terms shorter than two characters', async () => {
    assert.deepEqual(await search(admin, ' c '), { theses: [], people: [], submissions: [] });
  });

  it('requires signing in', async () => {
    assert.equal((await api.get('/search?q=cruz')).status, 401);
  });
});
