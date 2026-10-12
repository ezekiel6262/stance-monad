import { json, rpc, MONAD_CHAIN_ID } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  try {
    const [chainIdHex, blockHex] = await Promise.all([rpc('eth_chainId'), rpc('eth_blockNumber')]);
    const chainId = Number.parseInt(chainIdHex, 16);
    return json(res, chainId === MONAD_CHAIN_ID ? 200 : 502, {
      ok: chainId === MONAD_CHAIN_ID,
      network: 'monad-mainnet',
      chainId,
      latestBlock: Number.parseInt(blockHex, 16)
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'monad_unavailable', detail: error.message });
  }
}
