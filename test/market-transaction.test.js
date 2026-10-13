import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketPositionTransactions } from '../api/market-transaction.js';

const wallet = '0xB96f92E221935E4b0E0d7e927dF2E8e74147F785';

test('builds approval and Back position transactions on Monad', () => {
  const plan = buildMarketPositionTransactions({ wallet, marketId: 1, back: true, amount: '2500000' });
  assert.equal(plan.chainId, 143);
  assert.equal(plan.transactions.length, 2);
  assert.equal(plan.transactions[0].from, wallet);
  assert.equal(plan.transactions[1].to.toLowerCase(), '0x6f9103855b1c699f3ce1eb5105415cd2f6ca796e');
  assert.match(plan.transactions[1].data, /^0x[0-9a-f]+$/);
});

test('rejects an invalid prediction position', () => {
  assert.throws(() => buildMarketPositionTransactions({ wallet, marketId: 0, back: false, amount: '0' }));
});
