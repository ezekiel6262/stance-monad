import { json, rpc } from './_shared.js';

export const AUSD_ADDRESS = '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function balanceOfData(address) {
  if (!ADDRESS.test(address || '')) throw new Error('invalid_wallet');
  return `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
}

export function formatAusd(raw) {
  const value = BigInt(raw);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const wallet = String(req.query?.wallet || '');
  if (!ADDRESS.test(wallet)) return json(res, 400, { ok: false, error: 'invalid_wallet' });

  try {
    const raw = await rpc('eth_call', [{ to: AUSD_ADDRESS, data: balanceOfData(wallet) }, 'latest']);
    return json(res, 200, {
      ok: true,
      network: 'monad-mainnet',
      token: { issuer: 'Agora', symbol: 'AUSD', decimals: 6, address: AUSD_ADDRESS },
      wallet,
      balanceRaw: BigInt(raw).toString(),
      balance: formatAusd(raw)
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'ausd_balance_failed', detail: error.message });
  }
}
