export const MONAD_CHAIN_ID = 143;
export const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';

export function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}

export function requirePost(req, res) {
  if (req.method === 'POST') return true;
  res.setHeader('allow', 'POST');
  json(res, 405, { ok: false, error: 'method_not_allowed' });
  return false;
}

export async function rpc(method, params = []) {
  const response = await fetch(MONAD_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Monad RPC returned ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Monad RPC error');
  return payload.result;
}
