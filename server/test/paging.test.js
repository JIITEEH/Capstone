import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import * as User from '../src/database-queries/userModel.js';
import { PASSWORD, makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let adviser;
let students;

const get = async (path, who = admin) => {
  const res = await api.get(path, { token: who.token });
  assert.equal(res.status, 200, path);
  return res.data;
};
const ids = (rows) => rows.map((row) => row.id);

// A calendar day relative to today, in the server's time zone
function day(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

before(async () => {
  admin = await makeUser(api, { name: 'Paging Admin', email: 'p-admin@tms.edu', role: 'admin' });
  adviser = await makeUser(api, { name: 'Dr Paging', email: 'p-adviser@tms.edu', role: 'adviser' });

  // Every thesis starts in a term whose proposal was due yesterday, so each one begins overdue
  await api.post('/terms', {
    token: admin.token,
    body: { name: 'Paging term', startsOn: day(-30), endsOn: day(60), deadlines: { proposal: day(-1) } },
  });

  students = [];
  for (let i = 1; i <= 27; i++) {
    const email = `student${String(i).padStart(2, '0')}@tms.edu`;
    User.create({ name: `Student ${i}`, email, password: PASSWORD, role: 'student' });
    const token = (await api.login(email)).data.token;
    await api.post('/theses', { token, body: { title: `Thesis ${i}` } });
    students.push({ email, token });
  }
});

describe('paging users', () => {
  it('returns every account when no page is asked for', async () => {
    const all = await get('/users');
    assert.ok(Array.isArray(all));
    assert.equal(all.length, 29);
  });

  it('returns 25 at a time with the totals', async () => {
    const first = await get('/users?page=1');
    assert.deepEqual(
      { total: first.total, page: first.page, pages: first.pages, pageSize: first.pageSize, count: first.items.length },
      { total: 29, page: 1, pages: 2, pageSize: 25, count: 25 },
    );

    const second = await get('/users?page=2');
    assert.equal(second.items.length, 4);
    const seen = [...ids(first.items), ...ids(second.items)];
    assert.equal(new Set(seen).size, 29, 'no account appears on both pages');
    assert.deepEqual(seen, ids(await get('/users')), 'pages follow the same order as the full list');
  });

  it('counts only what the filters match', async () => {
    const students = await get('/users?role=student&page=1');
    assert.equal(students.total, 27);
    const search = await get('/users?search=Student%201&page=1');
    assert.equal(search.total, 11, 'Student 1 and Student 10 to 19');
  });

  it('shows the last page for a page past the end, and page 1 for nonsense', async () => {
    assert.equal((await get('/users?page=99')).page, 2);
    assert.equal((await get('/users?page=abc')).page, 1);
    assert.equal((await get('/users?page=-3')).page, 1);
    const none = await get('/users?search=nobody-matches&page=4');
    assert.deepEqual({ total: none.total, page: none.page, pages: none.pages, items: none.items }, { total: 0, page: 1, pages: 1, items: [] });
  });
});

describe('paging theses', () => {
  it('pages all theses for an admin', async () => {
    const second = await get('/theses?page=2');
    assert.equal(second.total, 27);
    assert.equal(second.items.length, 2);
    assert.ok(Array.isArray(await get('/theses')), 'without a page, the whole list as before');
  });

  it('counts overdue theses correctly', async () => {
    assert.equal((await get('/theses?deadline=overdue&page=1')).total, 27);

    const [first] = students;
    const thesis = (await get('/theses', first))[0];
    assert.equal((await api.upload(first.token, thesis.id, 'proposal')).status, 201);
    const overdue = await get('/theses?deadline=overdue&page=2');
    assert.equal(overdue.total, 26);
    assert.equal(overdue.items.length, 1);
  });

  it('keeps each role to its own theses', async () => {
    const theses = await get('/theses');
    for (const thesis of theses.slice(0, 3)) {
      await api.patch(`/theses/${thesis.id}/adviser`, { token: admin.token, body: { adviserId: adviser.id } });
    }
    const advisees = await get('/theses?page=1', adviser);
    assert.equal(advisees.total, 3);
    assert.equal((await get('/theses?page=1', students[5])).total, 1);
  });
});
