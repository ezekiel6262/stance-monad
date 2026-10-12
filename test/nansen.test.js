import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNansenRequest } from '../api/nansen.js';

test('forces profiler requests to Monad using singular chain', () => {
  assert.deepEqual(
    buildNansenRequest('profiler/address/labels', {
      address: '0x123',
      chain: 'ethereum',
      chains: ['base'],
      pagination: { page: 1, per_page: 100 }
    }),
    {
      address: '0x123',
      chain: 'monad',
      pagination: { page: 1, per_page: 25 }
    }
  );
});

test('forces Smart Money requests to Monad using chains array', () => {
  assert.deepEqual(
    buildNansenRequest('smart-money/netflow', { chain: 'ethereum' }),
    { chains: ['monad'] }
  );
});
