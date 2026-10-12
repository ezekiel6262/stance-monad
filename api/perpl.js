import { json } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const base = (process.env.PERPL_API_URL || 'https://app.perpl.xyz/api').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/v1/pub/context`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Perpl returned ${response.status}`);
    return json(res, 200, { ok: true, network: 'monad-mainnet', data });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'perpl_unavailable', detail: error.message });
  }
}
