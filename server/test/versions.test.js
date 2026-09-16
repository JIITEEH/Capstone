import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

let adviser;
let student;
let thesisId;
let firstId;
let secondId;

before(async () => {
  adviser = await makeUser(api, { name: 'Dr Reyes', email: 'reyes@tms.edu', role: 'adviser' });
  student = await makeUser(api, { name: 'Bea Lim', email: 'bea@tms.edu' });
  const admin = await makeUser(api, { name: 'Admin', email: 'admin-v@tms.edu', role: 'admin' });

  const thesis = await api.post('/theses', { token: student.token, body: { title: 'Version tracking study' } });
  thesisId = thesis.data.id;
  await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
});

describe('submission versions', () => {
  it('calls a first upload version 1 of 1', async () => {
    const upload = await api.upload(student.token, thesisId, 'proposal');
    assert.equal(upload.status, 201);
    firstId = upload.data.id;

    const { data } = await api.get(`/submissions/${firstId}`, { token: adviser.token });
    assert.equal(data.submission.version, 1);
    assert.equal(data.submission.versionsAtStage, 1);
    assert.equal(data.previousVersion, null, 'a first attempt replaces nothing');
  });

  it('numbers a resubmission version 2 and links it to the feedback that prompted it', async () => {
    await api.patch(`/submissions/${firstId}/review`, {
      token: adviser.token,
      body: { decision: 'revisions_requested', feedback: 'Narrow the scope to three diseases.' },
    });

    const again = await api.upload(student.token, thesisId, 'proposal');
    assert.equal(again.status, 201);
    secondId = again.data.id;

    const { data } = await api.get(`/submissions/${secondId}`, { token: adviser.token });
    assert.equal(data.submission.version, 2);
    assert.equal(data.submission.versionsAtStage, 2);
    assert.equal(data.previousVersion.id, firstId);
    assert.equal(data.previousVersion.status, 'revisions_requested');
    assert.match(data.previousVersion.review_feedback, /Narrow the scope/);
    assert.equal(data.previousVersion.reviewer_name, 'Dr Reyes');
  });

  it('keeps the older version numbered 1 after a newer one exists', async () => {
    const { data } = await api.get(`/submissions/${firstId}`, { token: student.token });
    assert.equal(data.submission.version, 1);
    assert.equal(data.submission.versionsAtStage, 2);
  });

  it('counts versions per stage, not per thesis', async () => {
    await api.patch(`/submissions/${secondId}/review`, { token: adviser.token, body: { decision: 'approved' } });

    const chapters = await api.upload(student.token, thesisId, 'chapters_1_3');
    assert.equal(chapters.status, 201);

    const { data } = await api.get(`/submissions/${chapters.data.id}`, { token: adviser.token });
    assert.equal(data.submission.version, 1, 'a new stage starts again at version 1');
    assert.equal(data.previousVersion, null, 'the approved proposal is a different stage');
  });
});
