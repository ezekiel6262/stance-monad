import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceOfData, formatAusd } from '../api/ausd.js';

test('encodes an AUSD balanceOf call for a Monad wallet', () => {
  assert.equal(
    balanceOfData('0xB96f92E221935E4b0E0d7e927dF2E8e74147F785'),
    '0x70a08231000000000000000000000000b96f92e221935e4b0e0d7e927df2e8e74147f785'
  );
});

test('formats six-decimal AUSD balances without floating point', () => {
  assert.equal(formatAusd('0x00'), '0');
  assert.equal(formatAusd('0x989680'), '10');
  assert.equal(formatAusd('1234567'), '1.234567');
});
