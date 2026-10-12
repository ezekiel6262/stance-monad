import test from 'node:test';
import assert from 'node:assert/strict';
import { perplProviderIssue } from '../api/perpl-account.js';

test('maps Perpl 451 to an origin authorization issue', () => {
  assert.deepEqual(perplProviderIssue({ status: 451 }), {
    code: 'origin_not_authorized',
    message: 'Perpl has not authorized this deployment origin for the enrolled API key.'
  });
});

test('does not expose arbitrary provider response details', () => {
  assert.deepEqual(perplProviderIssue({ status: 500, data: { secret: 'do-not-return' } }), {
    code: 'provider_request_failed',
    message: 'Perpl account analytics are temporarily unavailable.'
  });
});
