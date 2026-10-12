import { json } from './_shared.js';

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
    tokens: {
      USDC: { address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', decimals: 6 },
      WMON: { address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A', decimals: 18 },
      AUSD: { address: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a', decimals: 6 }
    },
    contracts: {
      market: process.env.STANCE_MARKET_ADDRESS || null,
      portfolio: process.env.STANCE_PORTFOLIO_ADDRESS || null
    }
  });
}
