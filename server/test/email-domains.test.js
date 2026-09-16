import './setup-email-domains.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PASSWORD, startApi } from './helpers.js';

const api = await startApi();

const signUp = (email) =>
  api.post('/auth/register', { body: { name: 'Domain Test', email, program: 'BS CS', password: PASSWORD } });

describe('sign-up limited to school email domains (ALLOWED_EMAIL_DOMAINS)', () => {
  it('accepts an address on an allowed domain', async () => {
    assert.equal((await signUp('ana@tms.edu')).status, 201);
    assert.equal((await signUp('ben@students.tms.edu')).status, 201, 'a leading @ in the setting is fine');
  });

  it('refuses any other domain, and says which ones are allowed', async () => {
    const res = await signUp('someone@gmail.com');
    assert.equal(res.status, 400);
    assert.match(res.data.error, /@tms\.edu or @students\.tms\.edu/);
  });

  it('is not fooled by a lookalike domain', async () => {
    assert.equal((await signUp('x@nottms.edu')).status, 400);
    assert.equal((await signUp('x@tms.edu.evil.example')).status, 400);
  });
});
