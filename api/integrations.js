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
      perpl: true,
      mera: true,
      privy: configured('NEXT_PUBLIC_PRIVY_APP_ID') && configured('PRIVY_APP_SECRET'),
      nansen: configured('NANSEN_API_KEY'),
      kuru: configured('KURU_API_URL') && configured('KURU_ROUTER_ADDRESS'),
      envio: configured('ENVIO_GRAPHQL_URL'),
      chainlinkCre: configured('CRE_WORKFLOW_ID'),
      contracts: configured('STANCE_FACTORY_ADDRESS') && configured('STANCE_MARKET_ADDRESS') && configured('CONVICTION_VAULT_ADDRESS')
    }
  });
}
