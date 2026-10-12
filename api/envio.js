import { json } from './_shared.js';

const HYPERSYNC_URL = 'https://monad.hypersync.xyz';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const token = process.env.ENVIO_API_TOKEN;
  const addresses = [process.env.STANCE_MARKET_ADDRESS, process.env.STANCE_PORTFOLIO_ADDRESS]
    .filter(Boolean)
    .map((address) => address.toLowerCase());
  if (!token || addresses.length !== 2) {
    return json(res, 503, { ok: false, error: 'envio_not_configured' });
  }

  try {
    const heightResponse = await fetch(`${HYPERSYNC_URL}/height`, { signal: AbortSignal.timeout(8000) });
    if (!heightResponse.ok) throw new Error(`height_${heightResponse.status}`);
    const { height } = await heightResponse.json();
    const fromBlock = Math.max(0, height - 25_000);
    const queryResponse = await fetch(`${HYPERSYNC_URL}/query`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from_block: fromBlock,
        to_block: height + 1,
        logs: [{ address: addresses }],
        field_selection: { log: ['address', 'block_number', 'transaction_hash', 'topic0'] }
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!queryResponse.ok) throw new Error(`query_${queryResponse.status}`);
    const payload = await queryResponse.json();
    const logs = payload?.data?.logs || [];
    const latest = logs.at(-1) || null;
    return json(res, 200, {
      ok: true,
      provider: 'Envio HyperSync',
      network: 'monad-mainnet',
      chainId: 143,
      indexedHeight: height,
      scannedFromBlock: fromBlock,
      contracts: addresses,
      recentEvents: logs.length,
      latestEvent: latest ? {
        address: latest.address,
        blockNumber: latest.block_number,
        transactionHash: latest.transaction_hash,
        topic0: latest.topic0
      } : null
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'envio_unavailable', detail: error.message });
  }
}
