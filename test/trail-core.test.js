import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTrailPlan, canonicalStance, contentHash } from '../trail-core.js';

describe('Stance commitments', () => {
  it('hashes equivalent position order identically', () => {
    const stance = { title: 'MON adoption', stance: 'MON usage grows', mode: 'swing', instrument: 'spot', horizon: '30d', entry: 'now', target: '2x', invalidation: '-25%', conviction: 4, positions: [
      { asset: 'USDC', weightBps: 3000, venue: 'Kuru' }, { asset: 'MON', weightBps: 7000, venue: 'Kuru' }
    ] };
    assert.equal(contentHash(canonicalStance(stance)), contentHash(canonicalStance({ ...stance, positions: [...stance.positions].reverse() })));
  });
});

describe('Trail Portfolio plans', () => {
  it('creates an attributed Monad plan', () => {
    const plan = buildTrailPlan({ sourcePortfolioId: '0x01', sourceStanceId: '0x02', trailType: 'paper', instrument: 'spot', amountMicro: '100000000', weights: [{ asset: 'MON', weightBps: 7000 }, { asset: 'USDC', weightBps: 3000 }] });
    assert.equal(plan.chainId, 143);
    assert.match(plan.planHash, /^0x[0-9a-f]{64}$/);
    assert.equal(plan.feeMicro, '100000');
  });

  it('blocks unsupported live assets', () => {
    const plan = buildTrailPlan({ sourcePortfolioId: '0x01', sourceStanceId: '0x02', trailType: 'live', instrument: 'spot', amountMicro: '100000000', weights: [{ asset: 'BTC', weightBps: 10000 }] });
    assert.equal(plan.blocked, true);
  });
});
