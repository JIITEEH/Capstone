import './setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startApi } from './helpers.js';

const api = await startApi();

describe('security headers', () => {
  it('sends them with every response', async () => {
    const res = await api.get('/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  });

  it('locks the content security policy down to this origin', async () => {
    const policy = (await api.get('/health')).headers.get('content-security-policy');
    assert.match(policy, /default-src 'self'/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.match(policy, /object-src 'none'/);
  });

  it('sends them on errors too, where a response is easy to miss', async () => {
    const res = await api.get('/no-such-route');
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  it('leaves HSTS off outside production, where there is no HTTPS', async () => {
    const res = await api.get('/health');
    assert.equal(res.headers.get('strict-transport-security'), null);
  });
});
