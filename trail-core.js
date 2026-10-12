import { createHash } from 'node:crypto';

export const TRAIL_FEE_BPS = 10;
export const IMPACT_STAGGER_BPS = 100;
export const IMPACT_BLOCK_BPS = 500;

const ASSETS = Object.freeze({
  MON: { route: 'Kuru', depthUsd: 2_000_000 },
  WMON: { route: 'Kuru', depthUsd: 2_000_000 },
  USDC: { route: 'Kuru', depthUsd: 5_000_000 },
  AUSD: { route: 'Kuru', depthUsd: 1_000_000 }
});

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value) {
  return `0x${createHash('sha256').update(stable(value)).digest('hex')}`;
}

export function canonicalStance(input) {
  return {
    title: input.title.trim(),
    stance: input.stance.trim(),
    mode: input.mode,
    instrument: input.instrument,
    horizon: input.horizon.trim(),
    entry: input.entry.trim(),
    target: input.target.trim(),
    invalidation: input.invalidation.trim(),
    conviction: input.conviction,
    positions: [...input.positions]
      .map(({ asset, weightBps, venue }) => ({ asset: asset.toUpperCase(), weightBps, venue }))
      .sort((a, b) => a.asset.localeCompare(b.asset) || a.venue.localeCompare(b.venue))
  };
}

export function assertWeights(weights) {
  if (!Array.isArray(weights) || weights.length === 0) throw new Error('Add at least one asset');
  if (weights.some(({ asset, weightBps }) => !asset || !Number.isInteger(weightBps) || weightBps < 0)) {
    throw new Error('Weights must be non-negative whole basis points');
  }
  if (new Set(weights.map(({ asset }) => asset.toUpperCase())).size !== weights.length) {
    throw new Error('Each asset can appear once');
  }
  if (weights.reduce((sum, row) => sum + row.weightBps, 0) !== 10_000) {
    throw new Error('Weights must total 100%');
  }
}

export function buildTrailPlan(input) {
  assertWeights(input.weights);
  const amountMicro = BigInt(input.amountMicro);
  if (amountMicro <= 0n) throw new Error('Amount must be positive');
  if (!['research', 'paper', 'live'].includes(input.trailType)) throw new Error('Invalid trail type');

  const warnings = [];
  let blocked = false;
  if (input.instrument === 'perps') {
    const leverage = input.leverage ?? 1;
    const cap = input.leverageCap ?? 3;
    warnings.push('Liquidation risk: a perpetual position can liquidate before the Stance resolves.');
    if (leverage > cap) {
      warnings.push(`Leverage ${leverage}x exceeds the ${cap}x cap.`);
      blocked = true;
    }
  }

  const orders = input.weights.map(({ asset, weightBps }) => {
    const symbol = asset.toUpperCase();
    const meta = ASSETS[symbol];
    const orderAmount = amountMicro * BigInt(weightBps) / 10_000n;
    const usd = Number(orderAmount) / 1_000_000;
    const impactBps = meta ? Math.min(10_000, Math.round((usd / meta.depthUsd) * 10_000)) : 10_000;
    const executable = Boolean(meta) && input.instrument === 'spot';
    if (input.trailType === 'live' && !executable) {
      warnings.push(`${symbol} has no approved live route; keep this leg paper-only.`);
      blocked = true;
    }
    return { asset: symbol, weightBps, amountMicro: orderAmount.toString(), route: meta?.route ?? 'Paper', impactBps, executable };
  });

  for (const order of orders) {
    if (!order.executable && input.trailType === 'live') continue;
    if (order.impactBps >= IMPACT_BLOCK_BPS) {
      warnings.push(`${order.asset} is estimated to move available depth by at least 5%; reduce the size.`);
      blocked = true;
    } else if (order.impactBps >= IMPACT_STAGGER_BPS) {
      warnings.push(`${order.asset} should be split into smaller clips.`);
    }
  }

  const plan = {
    version: 1,
    network: 'monad-mainnet',
    chainId: 143,
    sourcePortfolioId: input.sourcePortfolioId,
    sourceStanceId: input.sourceStanceId,
    trailType: input.trailType,
    instrument: input.instrument,
    amountMicro: amountMicro.toString(),
    feeMicro: (amountMicro * BigInt(TRAIL_FEE_BPS) / 10_000n).toString(),
    orders,
    staggered: orders.some((order) => order.impactBps >= IMPACT_STAGGER_BPS && order.impactBps < IMPACT_BLOCK_BPS),
    blocked,
    warnings
  };
  return { ...plan, planHash: contentHash(plan) };
}
