import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

let adviser;
let student;
let thesisId;
let firstId;

before(async () => {
  adviser = await makeUser(api, { name: 'Dr Cruz', email: 'cruz@tms.edu', role: 'adviser' });
  student = await makeUser(api, { name: 'Ana Sy', email: 'ana@tms.edu' });
  const admin = await makeUser(api, { name: 'Admin', email: 'admin-r@tms.edu', role: 'admin' });

  const thesis = await api.post('/theses', { token: student.token, body: { title: 'Resubmission study' } });
  thesisId = thesis.data.id;
  await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });

  const upload = await api.upload(student.token, thesisId, 'proposal');
  firstId = upload.data.id;
});

// canResubmit drives the "Upload a revised version" button on the submission page
describe('uploading a revised version from the submission itself', () => {
  it('is not offered while the submission is still waiting for review', async () => {
    const { data } = await api.get(`/submissions/${firstId}`, { token: student.token });
    assert.equal(data.canResubmit, false);
  });

  it('is offered to the student once revisions are requested', async () => {
    await api.patch(`/submissions/${firstId}/review`, {
      token: adviser.token,
      body: { decision: 'revisions_requested', feedback: 'Tighten the research questions.' },
    });

    const { data } = await api.get(`/submissions/${firstId}`, { token: student.token });
    assert.equal(data.canResubmit, true);
  });

  it('is never offered to the adviser reviewing it', async () => {
    const { data } = await api.get(`/submissions/${firstId}`, { token: adviser.token });
    assert.equal(data.canResubmit, false);
  });

  it('moves to the newest version once the student has resubmitted', async () => {
    const again = await api.upload(student.token, thesisId, 'proposal');
    assert.equal(again.status, 201);

    const older = await api.get(`/submissions/${firstId}`, { token: student.token });
    assert.equal(older.data.canResubmit, false, 'the superseded version stops offering it');

    const newest = await api.get(`/submissions/${again.data.id}`, { token: student.token });
    assert.equal(newest.data.canResubmit, false, 'the new version is pending review');

    await api.patch(`/submissions/${again.data.id}/review`, {
      token: adviser.token,
      body: { decision: 'revisions_requested', feedback: 'One more pass on the methodology.' },
    });

    const sentBack = await api.get(`/submissions/${again.data.id}`, { token: student.token });
    assert.equal(sentBack.data.canResubmit, true);

    const stillOlder = await api.get(`/submissions/${firstId}`, { token: student.token });
    assert.equal(stillOlder.data.canResubmit, false, 'only the newest version offers it');
  });

  it('stops once the stage is approved', async () => {
    const third = await api.upload(student.token, thesisId, 'proposal');
    await api.patch(`/submissions/${third.data.id}/review`, { token: adviser.token, body: { decision: 'approved' } });

    const { data } = await api.get(`/submissions/${third.data.id}`, { token: student.token });
    assert.equal(data.canResubmit, false);
  });
});
