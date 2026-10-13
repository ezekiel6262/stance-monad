import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/live-state.js';

function response() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, end(v = '') { this.body = v; return this; } };
}

test('rejects a malformed wallet before reading Monad', async () => {
  const res = response();
  await handler({ method: 'GET', query: { wallet: 'not-an-address' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, 'invalid_wallet');
});

test('only exposes live state over GET', async () => {
  const res = response();
  await handler({ method: 'POST', query: {} }, res);
  assert.equal(res.statusCode, 405);
});
