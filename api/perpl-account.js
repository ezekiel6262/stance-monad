import { json } from './_shared.js';
import { perplAuthHeaders } from './_perpl-auth.js';

function rows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.d)) return value.d;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function signedGet(base, target, apiKey, secret) {
  const response = await fetch(`${base}${target}`, {
    headers: perplAuthHeaders({ apiKey, secret, target }),
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Perpl returned ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function perplProviderIssue(error) {
  if (error?.status === 451) {
    return {
      code: 'origin_not_authorized',
      message: 'Perpl has not authorized this deployment origin for the enrolled API key.'
    };
  }

  return {
    code: 'provider_request_failed',
    message: 'Perpl account analytics are temporarily unavailable.'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const apiKey = process.env.PERPL_API_KEY;
  const secret = process.env.PERPL_API_KEY_SECRET;
  if (!apiKey || !secret) return json(res, 503, { ok: false, error: 'perpl_account_not_configured' });

  const base = (process.env.PERPL_API_URL || 'https://app.perpl.xyz/api').replace(/\/$/, '');
  try {
    const [wallet, positions] = await Promise.all([
      signedGet(base, '/v1/trading/wallet', apiKey, secret),
      signedGet(base, '/v1/trading/positions', apiKey, secret)
    ]);
    const accounts = rows(wallet?.as || wallet?.accounts || wallet);
    const openPositions = rows(positions);

    // Expose only proof-oriented aggregate facts, never balances or raw account data.
    return json(res, 200, {
      ok: true,
      provider: 'Perpl',
      network: 'monad-mainnet',
      authenticated: true,
      analytics: {
        accountCount: accounts.length,
        openPositionCount: openPositions.length,
        orderForwardingEnabled: accounts.some((account) => account?.fw === true)
      }
    });
  } catch (error) {
    const issue = perplProviderIssue(error);
    return json(res, error.status || 502, {
      ok: false,
      error: 'perpl_account_request_failed',
      providerStatus: error.status,
      providerIssue: issue.code,
      detail: issue.message
    });
  }
}
