import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { toCsv } from '../src/helpers/csv.js';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

// Splits CSV into rows of cells, understanding quotes, so assertions check values, not formatting
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const body = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r') continue;
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  return rows;
}

describe('building CSV', () => {
  const columns = [{ header: 'Name', value: (r) => r.name }];

  it('quotes commas, quotes, and line breaks', () => {
    const csv = toCsv(columns, [{ name: 'Cruz, Ana' }, { name: 'The "best" thesis' }, { name: 'two\nlines' }]);
    assert.deepEqual(parseCsv(csv).slice(1).map((r) => r[0]), ['Cruz, Ana', 'The "best" thesis', 'two\nlines']);
  });

  it('starts with a byte-order mark so Excel reads it as UTF-8', () => {
    assert.ok(toCsv(columns, []).startsWith('\uFEFF'));
  });

  it('turns anything a spreadsheet would run as a formula into plain text', () => {
    const dangerous = ['=HYPERLINK("http://evil.example","Click")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1'];
    const cells = parseCsv(toCsv(columns, dangerous.map((name) => ({ name })))).slice(1).map((r) => r[0]);
    for (const value of cells) {
      assert.ok(value.startsWith("'"), `"${value}" must not start a formula`);
    }
  });

  it('leaves ordinary text and numbers alone', () => {
    const csv = toCsv([{ header: 'Count', value: (r) => r.n }, { header: 'Title', value: (r) => r.t }], [{ n: 42, t: 'Rice crops' }]);
    assert.deepEqual(parseCsv(csv)[1], ['42', 'Rice crops']);
  });
});

describe('exporting theses', () => {
  let admin;
  let adviser;

  before(async () => {
    admin = await makeUser(api, { name: 'Export Admin', email: 'export-admin@tms.edu', role: 'admin' });
    adviser = await makeUser(api, { name: 'Dr Mendoza', email: 'mendoza@tms.edu', role: 'adviser' });

    const ana = await makeUser(api, { name: 'Ana Export', email: 'ana-export@tms.edu', program: 'BS CS' });
    const t1 = await api.post('/theses', { token: ana.token, body: { title: 'Crop disease detection', keywords: 'ml, rice' } });
    await api.patch(`/theses/${t1.data.id}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });

    const mallory = await makeUser(api, { name: 'Mallory', email: 'mallory@tms.edu' });
    await api.post('/theses', { token: mallory.token, body: { title: '=HYPERLINK("http://evil.example","Open")' } });
  });

  it('downloads a dated CSV with a row per thesis', async () => {
    const res = await api.get('/theses/export.csv', { token: admin.token });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="theses-\d{4}-\d{2}-\d{2}\.csv"/);

    const rows = parseCsv(res.data);
    assert.deepEqual(rows[0], ['Title', 'Students', 'Program', 'Adviser', 'Current stage', 'Stages approved', 'Status', 'Term', 'Next due', 'Overdue', 'Keywords', 'Started', 'Last updated']);

    const crop = rows.find((r) => r[0] === 'Crop disease detection');
    assert.equal(crop[1], 'Ana Export');
    assert.equal(crop[2], 'BS CS');
    assert.equal(crop[3], 'Dr Mendoza');
    assert.equal(crop[4], 'Proposal', 'nothing approved yet, so the group is on the first stage');
    assert.equal(crop[5], '0 of 4');
    assert.equal(crop[6], 'Draft');
  });

  it('neutralises a thesis title written to run as a formula', async () => {
    const rows = parseCsv((await api.get('/theses/export.csv', { token: admin.token })).data);
    const attack = rows.find((r) => r[0].includes('HYPERLINK'));
    assert.ok(attack[0].startsWith("'="), 'opens as text in a spreadsheet, not as a live link');
  });

  it('exports only what the filters show', async () => {
    const rows = parseCsv((await api.get(`/theses/export.csv?adviser=${adviser.id}`, { token: admin.token })).data);
    assert.equal(rows.length, 2, 'the header plus the one thesis this adviser has');
    assert.equal(rows[1][0], 'Crop disease detection');
  });

  it('is for admins only', async () => {
    assert.equal((await api.get('/theses/export.csv', { token: adviser.token })).status, 403);
  });

  it('does not mistake export.csv for a thesis id', async () => {
    const res = await api.get('/theses/export.csv', { token: admin.token });
    assert.notEqual(res.status, 404);
  });
});

describe('exporting adviser workload', () => {
  it('lists each active adviser with their advisees and pending reviews', async () => {
    const admin = await makeUser(api, { name: 'Workload Admin', email: 'workload-admin@tms.edu', role: 'admin' });
    const res = await api.get('/users/advisers/export.csv', { token: admin.token });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /filename="adviser-workload-/);
    const rows = parseCsv(res.data);
    assert.deepEqual(rows[0], ['Adviser', 'Email', 'Department', 'Advisees', 'Waiting for review']);
    const mendoza = rows.find((r) => r[0] === 'Dr Mendoza');
    assert.equal(mendoza[3], '1');
  });

  it('is for admins only', async () => {
    const student = await makeUser(api, { name: 'Curious', email: 'curious@tms.edu' });
    assert.equal((await api.get('/users/advisers/export.csv', { token: student.token })).status, 403);
  });
});
