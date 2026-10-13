import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioTransaction } from '../api/portfolio-transaction.js';

const wallet = '0xB96f92E221935E4b0E0d7e927dF2E8e74147F785';
const token = '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a';

test('builds a deterministic verified Stance transaction', () => {
  const input = { action: 'publish', wallet, thesis: 'MON usage will grow this quarter', token, positionSize: '1000000', expiresAt: Math.floor(Date.now() / 1000) + 3600, evidenceURI: 'https://monadscan.com/tx/0xabc' };
  const first = buildPortfolioTransaction(input);
  const second = buildPortfolioTransaction(input);
  assert.equal(first.stanceId, second.stanceId);
  assert.equal(first.chainId, 143);
  assert.match(first.data, /^0x[0-9a-f]+$/);
});

test('builds an attributed Trail transaction', () => {
  const plan = buildPortfolioTransaction({ action: 'trail', wallet, caller: '0x1111111111111111111111111111111111111111', stanceId: `0x${'22'.repeat(32)}`, amount: '5000000' });
  assert.equal(plan.action, 'trail');
  assert.equal(plan.to.toLowerCase(), '0x4e2c91fe23e2415d110c9af24474dc1b21c3aeb9');
});
