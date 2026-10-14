import { json } from './_shared.js';
import { readEnvioEvents } from './_envio.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const token = process.env.ENVIO_API_TOKEN;
  const market = process.env.STANCE_MARKET_ADDRESS;
  const portfolio = process.env.STANCE_PORTFOLIO_ADDRESS;
  if (!token || !market || !portfolio) {
    return json(res, 503, { ok: false, error: 'envio_not_configured' });
  }

  try {
    const data = await readEnvioEvents({ market, portfolio, token, startBlock: process.env.STANCE_INDEX_START_BLOCK || 0 });
    const latest = data.activity[0] || null;
    return json(res, 200, {
      ok: true,
      provider: data.provider,
      network: 'monad-mainnet',
      chainId: 143,
      indexedHeight: data.indexedHeight,
      scannedFromBlock: data.startBlock,
      contracts: [market.toLowerCase(), portfolio.toLowerCase()],
      recentEvents: data.eventCount,
      counts: { stances: data.proofs.length, trails: data.tails.length, positions: data.positions.length, resolutions: data.resolutions.length, claims: data.claims.length },
      latestEvent: latest ? {
        address: latest.address,
        kind: latest.eventName,
        blockNumber: latest.blockNumber,
        transactionHash: latest.transactionHash
      } : null
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'envio_unavailable', detail: error.message });
  }
}
