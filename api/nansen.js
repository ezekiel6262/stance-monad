import { json, requirePost } from './_shared.js';

const ALLOWED_ENDPOINTS = new Set([
  'smart-money/netflow',
  'smart-money/holdings',
  'smart-money/dex-trades',
  'profiler/address/labels',
  'profiler/address/pnl-summary'
]);

const PROFILER_ENDPOINTS = new Set([
  'profiler/address/labels',
  'profiler/address/pnl-summary'
]);

export function buildNansenRequest(endpoint, params = {}) {
  const body = { ...params };

  // Nansen's profiler endpoints accept a singular `chain`, while Smart Money
  // endpoints accept a `chains` array. Always force Monad regardless of input.
  delete body.chain;
  delete body.chains;
  if (PROFILER_ENDPOINTS.has(endpoint)) body.chain = 'monad';
  else body.chains = ['monad'];

  if (body.pagination) {
    body.pagination = {
      ...body.pagination,
      per_page: Math.min(Number(body.pagination.per_page) || 10, 25)
    };
  }

  return body;
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (!process.env.NANSEN_API_KEY) return json(res, 503, { ok: false, error: 'nansen_not_configured' });

  const endpoint = String(req.body?.endpoint || '');
  if (!ALLOWED_ENDPOINTS.has(endpoint)) return json(res, 400, { ok: false, error: 'unsupported_endpoint' });

  const body = buildNansenRequest(endpoint, req.body?.params);

  try {
    const response = await fetch(`https://api.nansen.ai/api/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: process.env.NANSEN_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return json(res, response.status, { ok: false, error: 'nansen_request_failed', data });
    return json(res, 200, { ok: true, data });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'nansen_unavailable', detail: error.message });
  }
}
