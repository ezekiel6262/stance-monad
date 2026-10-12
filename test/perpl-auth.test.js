import test from 'node:test';
import assert from 'node:assert/strict';

import { perplAuthHeaders, perplCanonical } from '../api/_perpl-auth.js';

test('builds the documented Perpl canonical request', () => {
  assert.equal(
    perplCanonical({ target: '/v1/trading/positions', timestamp: '1', nonce: 'abc' }),
    '143\nGET\n/v1/trading/positions\n1\nabc\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
});

test('creates all Perpl Ed25519 authentication headers', () => {
  const headers = perplAuthHeaders({
    apiKey: 'key',
    secret: '11'.repeat(32),
    target: '/v1/trading/wallet'
  });
  assert.equal(headers['X-API-Key'], 'key');
  assert.ok(headers['X-API-Timestamp']);
  assert.ok(headers['X-API-Nonce']);
  assert.ok(headers['X-API-Signature']);
});
