import { json, MONAD_CHAIN_ID } from './_shared.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const configured = (name) => Boolean(process.env[name]);
  return json(res, 200, {
    ok: true,
    network: { name: 'monad-mainnet', chainId: MONAD_CHAIN_ID },
    realMoneyEnabled: process.env.REAL_MONEY_ENABLED === 'true',
    services: {
      monad: true,
      agora: true,
      // Perpl public Monad market data is live without authentication. Account
      // analytics require a wallet-scoped Ed25519 API key and stay separate.
      perpl: true,
      perplAccount: configured('PERPL_API_KEY') && configured('PERPL_API_KEY_SECRET'),
      // Mera is a self-custodial browser SDK and does not require a project ID.
      mera: true,
      privy: configured('NEXT_PUBLIC_PRIVY_APP_ID') && configured('PRIVY_APP_SECRET'),
      nansen: configured('NANSEN_API_KEY'),
      kuru: true,
      envio: configured('ENVIO_GRAPHQL_URL') || configured('ENVIO_API_TOKEN'),
      chainlinkCre: configured('CRE_WORKFLOW_ID'),
      contracts: configured('STANCE_MARKET_ADDRESS') && configured('STANCE_PORTFOLIO_ADDRESS')
    }
  });
}
