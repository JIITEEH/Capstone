import './setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import app from '../src/app.js';
import { startApi } from './helpers.js';

const api = await startApi();

const attempt = (address) =>
  api.post('/auth/reset-password', {
    body: { token: 'not-a-real-token', password: 'long-enough-password' },
    headers: { 'X-Forwarded-For': address },
  });

describe('facing the internet directly (TRUST_PROXY unset)', () => {
  it('trusts no proxy by default', () => {
    assert.equal(app.get('trust proxy'), false);
  });

  it('ignores a forged X-Forwarded-For, so a client cannot dodge a limit by inventing addresses', async () => {
    for (let i = 0; i < 10; i += 1) {
      await attempt(`203.0.113.${i + 1}`);
    }
    // Every request came from the same real address, whatever the header claimed
    assert.equal((await attempt('198.51.100.99')).status, 429);
  });
});
