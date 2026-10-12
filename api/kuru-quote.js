import { isAddress } from 'viem';
import { json } from './_shared.js';

const API_BASE = process.env.KURU_API_BASE_URL || 'https://ws.kuru.io/api';

function transactionFrom(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['buildResponse', 'build_response', 'transaction', 'tx', 'request', 'transactionRequest']) {
    if (value[key]) return transactionFrom(value[key]) || value[key];
  }
  for (const key of ['data', 'result', 'quote', 'swap']) {
    if (value[key]) { const nested = transactionFrom(value[key]); if (nested) return nested; }
  }
  const to = value.to || value.target || value.destination;
  const data = value.data || value.calldata || value.input;
  return isAddress(to || '') && /^0x[0-9a-fA-F]*$/.test(data || '') ? value : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const wallet = String(req.body?.wallet || '');
  const tokenIn = String(req.body?.tokenIn || '');
  const tokenOut = String(req.body?.tokenOut || '');
  const amount = String(req.body?.amountRaw || '');
  const slippageTolerance = Math.min(Math.max(Number(req.body?.slippageBps) || 50, 1), 500);
  if (![wallet, tokenIn, tokenOut].every(isAddress) || !/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    return json(res, 400, { ok: false, error: 'invalid_quote_request' });
  }
  try {
    const tokenResponse = await fetch(`${API_BASE}/generate-token`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_address: wallet }), signal: AbortSignal.timeout(8000)
    });
    if (!tokenResponse.ok) throw new Error(`Kuru token request returned ${tokenResponse.status}`);
    const { token } = await tokenResponse.json();
    if (!token) throw new Error('Kuru token response was incomplete');
    const quoteResponse = await fetch(`${API_BASE}/quote`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ userAddress: wallet, tokenIn, tokenOut, amount, slippageTolerance, autoSlippage: true }),
      signal: AbortSignal.timeout(12000)
    });
    const quote = await quoteResponse.json().catch(() => null);
    if (!quoteResponse.ok || quote?.status !== 'success') throw new Error(quote?.message || `Kuru quote returned ${quoteResponse.status}`);
    const transaction = transactionFrom(quote);
    if (!transaction) throw new Error('Kuru quote did not include a valid transaction');
    return json(res, 200, {
      ok: true, venue: 'kuru-flow', chainId: 143, wallet,
      outputRaw: String(quote.output), slippageBps: slippageTolerance,
      transaction: { from: wallet, to: transaction.to || transaction.target || transaction.destination, data: transaction.data || transaction.calldata || transaction.input, value: String(transaction.value || '0'), gas: transaction.gas ? String(transaction.gas) : undefined }
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'kuru_quote_failed', detail: error.message });
  }
}
