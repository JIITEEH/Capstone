import './setup.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { before, describe, it } from 'node:test';
import config from '../src/config/index.js';
import { makeUser, startApi } from './helpers.js';

const MB = 1024 * 1024;
const api = await startApi();

// Steps in this file build on each other, following one thesis from creation to deletion
let admin;
let adviser;
let otherAdviser;
let student;
let outsider;
let thesisId;
let proposalId;

before(async () => {
  admin = await makeUser(api, { name: 'Ada Admin', email: 'admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr. Maria Santos', email: 'santos@tms.edu', role: 'adviser' });
  otherAdviser = await makeUser(api, { name: 'Dr. Other', email: 'other@tms.edu', role: 'adviser' });
  student = await makeUser(api, { name: 'Sam Student', email: 'sam@tms.edu' });
  outsider = await makeUser(api, { name: 'Tia Outsider', email: 'tia@tms.edu' });
});

describe('creating and editing a thesis', () => {
  it('lets a student create one thesis', async () => {
    const res = await api.post('/theses', {
      token: student.token,
      body: { title: 'Smart Attendance System', abstract: 'Face recognition.', keywords: 'vision' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.status, 'draft');
    thesisId = res.data.id;

    const second = await api.post('/theses', { token: student.token, body: { title: 'Another' } });
    assert.equal(second.status, 409);
  });

  it('requires a title of 250 characters or fewer', async () => {
    assert.equal((await api.post('/theses', { token: outsider.token, body: { title: '   ' } })).status, 400);
    assert.equal((await api.post('/theses', { token: outsider.token, body: { title: 'x'.repeat(251) } })).status, 400);
  });

  it('lets the student edit their thesis', async () => {
    const res = await api.patch(`/theses/${thesisId}`, { token: student.token, body: { title: 'Smart Attendance v2' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.title, 'Smart Attendance v2');
  });

  it("only shows students their own thesis", async () => {
    const res = await api.get('/theses', { token: student.token });
    assert.deepEqual(
      res.data.map((thesis) => thesis.id),
      [thesisId],
    );
  });
});

describe('access control', () => {
  it('hides the thesis from other students and unassigned advisers', async () => {
    assert.equal((await api.get(`/theses/${thesisId}`, { token: outsider.token })).status, 404);
    assert.equal((await api.patch(`/theses/${thesisId}`, { token: outsider.token, body: { title: 'x' } })).status, 404);
    assert.equal((await api.get(`/theses/${thesisId}`, { token: adviser.token })).status, 404);
  });

  it('keeps thesis content editable by students only', async () => {
    assert.equal((await api.patch(`/theses/${thesisId}`, { token: adviser.token, body: { title: 'x' } })).status, 403);
  });

  it('lets only admins assign an active adviser', async () => {
    assert.equal(
      (await api.patch(`/theses/${thesisId}/adviser`, { token: student.token, body: { adviserId: adviser.id } })).status,
      403,
    );
    assert.equal(
      (await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: student.id } })).status,
      400,
    );

    const res = await api.patch(`/theses/${thesisId}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
    assert.equal(res.status, 200);
    assert.equal(res.data.adviser_id, adviser.id);
    assert.equal((await api.get(`/theses/${thesisId}`, { token: adviser.token })).status, 200);
  });

  it('lets admins search and filter theses', async () => {
    const found = await api.get('/theses?search=Attendance', { token: admin.token });
    assert.ok(found.data.some((thesis) => thesis.id === thesisId));
    const assigned = await api.get(`/theses?adviser=${adviser.id}`, { token: admin.token });
    assert.ok(assigned.data.some((thesis) => thesis.id === thesisId));
  });
});

describe('uploading submissions', () => {
  it('only accepts PDF, DOC, and DOCX files', async () => {
    const res = await api.upload(student.token, thesisId, 'proposal', { name: 'virus.exe' });
    assert.equal(res.status, 400);
  });

  it('rejects files over the upload limit with a clear message', async () => {
    const limitMb = config.maxUploadBytes / MB;
    const res = await api.upload(student.token, thesisId, 'proposal', { bytes: config.maxUploadBytes + MB });
    assert.equal(res.status, 400);
    assert.match(res.data.error, new RegExp(`${limitMb} MB`));
  });

  it('unlocks stages in order', async () => {
    const res = await api.upload(student.token, thesisId, 'final');
    assert.equal(res.status, 400);
    assert.match(res.data.error, /Proposal must be approved/);
  });

  it('accepts a proposal larger than the old 20 MB limit', async () => {
    const res = await api.upload(student.token, thesisId, 'proposal', { bytes: 21 * MB });
    assert.equal(res.status, 201);
    proposalId = res.data.id;

    const thesis = await api.get(`/theses/${thesisId}`, { token: student.token });
    assert.equal(thesis.data.thesis.status, 'under_review');
  });

  it('allows only one pending submission at a time', async () => {
    const res = await api.upload(student.token, thesisId, 'chapters_1_3');
    assert.equal(res.status, 400);
  });

  it('lets people with access download the file intact', async () => {
    assert.deepEqual(await api.download(student.token, proposalId), { status: 200, bytes: 21 * MB });
    assert.equal((await api.download(outsider.token, proposalId)).status, 404);
  });
});

describe('reviews and comments', () => {
  it('lets only the assigned adviser review', async () => {
    const body = { decision: 'approved' };
    assert.equal((await api.patch(`/submissions/${proposalId}/review`, { token: student.token, body })).status, 403);
    assert.equal((await api.patch(`/submissions/${proposalId}/review`, { token: admin.token, body })).status, 403);
    assert.equal((await api.patch(`/submissions/${proposalId}/review`, { token: otherAdviser.token, body })).status, 404);
  });

  it('requires feedback when requesting revisions', async () => {
    const res = await api.patch(`/submissions/${proposalId}/review`, {
      token: adviser.token,
      body: { decision: 'revisions_requested', feedback: '  ' },
    });
    assert.equal(res.status, 400);
  });

  it('approves a submission once and moves the thesis forward', async () => {
    const res = await api.patch(`/submissions/${proposalId}/review`, {
      token: adviser.token,
      body: { decision: 'approved', feedback: 'Good scope.' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'approved');

    const again = await api.patch(`/submissions/${proposalId}/review`, { token: adviser.token, body: { decision: 'approved' } });
    assert.equal(again.status, 400);

    const thesis = await api.get(`/theses/${thesisId}`, { token: student.token });
    assert.equal(thesis.data.thesis.status, 'in_progress');
  });

  it('lets the student and adviser comment, and admins only read', async () => {
    assert.equal((await api.post(`/submissions/${proposalId}/comments`, { token: student.token, body: { body: 'Thanks!' } })).status, 201);
    assert.equal((await api.post(`/submissions/${proposalId}/comments`, { token: adviser.token, body: { body: 'Proceed.' } })).status, 201);
    assert.equal((await api.post(`/submissions/${proposalId}/comments`, { token: admin.token, body: { body: 'Hi' } })).status, 403);
    assert.equal((await api.post(`/submissions/${proposalId}/comments`, { token: student.token, body: { body: '  ' } })).status, 400);

    const submission = await api.get(`/submissions/${proposalId}`, { token: admin.token });
    assert.equal(submission.data.comments.length, 2);
  });

  it('handles revisions and resubmission of the next stage', async () => {
    assert.equal((await api.upload(student.token, thesisId, 'final')).status, 400);

    const chapters = await api.upload(student.token, thesisId, 'chapters_1_3');
    assert.equal(chapters.status, 201);

    const review = await api.patch(`/submissions/${chapters.data.id}/review`, {
      token: adviser.token,
      body: { decision: 'revisions_requested', feedback: 'Expand the literature review.' },
    });
    assert.equal(review.status, 200);

    const thesis = await api.get(`/theses/${thesisId}`, { token: student.token });
    assert.equal(thesis.data.thesis.status, 'revisions_required');
    assert.equal((await api.upload(student.token, thesisId, 'chapters_1_3')).status, 201);
  });
});

describe('deleting a thesis', () => {
  it('lets only admins delete a thesis, removing its uploaded files', async () => {
    assert.equal((await api.delete(`/theses/${thesisId}`, { token: student.token })).status, 403);
    assert.ok(fs.readdirSync(config.uploadDir).length > 0);

    assert.equal((await api.delete(`/theses/${thesisId}`, { token: admin.token })).status, 204);
    assert.equal((await api.get(`/theses/${thesisId}`, { token: admin.token })).status, 404);
    assert.equal(fs.readdirSync(config.uploadDir).length, 0);
  });
});
