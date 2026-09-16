import './setup-trust-proxy.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import app from '../src/app.js';
import { startApi } from './helpers.js';

const api = await startApi();

// Reset-password allows 10 attempts per address per 15 minutes
const attempt = (address) =>
  api.post('/auth/reset-password', {
    body: { token: 'not-a-real-token', password: 'long-enough-password' },
    headers: { 'X-Forwarded-For': address },
  });

describe('behind a proxy (TRUST_PROXY=1)', () => {
  it('is configured to trust one proxy', () => {
    assert.equal(app.get('trust proxy'), 1);
  });

  it('gives each visitor their own limit instead of one shared by everyone', async () => {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await attempt('203.0.113.10')).status, 400, 'a wrong token, not yet limited');
    }
    assert.equal((await attempt('203.0.113.10')).status, 429, 'this visitor has used up their attempts');

    const someoneElse = await attempt('198.51.100.20');
    assert.equal(someoneElse.status, 400, 'a different visitor is not locked out by the first one');
  });
});
