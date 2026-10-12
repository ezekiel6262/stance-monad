import { json } from './_shared.js';
import { KURU_ENTRYPOINT, KURU_TOKENS } from './_kuru.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  return json(res, 200, {
    ok: true,
    chain: {
      id: 143,
      name: 'Monad Mainnet',
      nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
      rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://rpc.monad.xyz',
      blockExplorerUrl: 'https://monadscan.com'
    },
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || null,
    tokens: KURU_TOKENS,
    kuru: { entrypoint: KURU_ENTRYPOINT },
    contracts: {
      market: process.env.STANCE_MARKET_ADDRESS || null,
      portfolio: process.env.STANCE_PORTFOLIO_ADDRESS || null
    }
  });
}
