import { json, requirePost } from './_shared.js';

export default function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (process.env.REAL_MONEY_ENABLED !== 'true') {
    return json(res, 423, {
      ok: false,
      error: 'real_money_locked',
      message: 'The generic execution endpoint is disabled. Live actions use scoped Kuru and Stance contract endpoints and are signed by the connected wallet.',
      required: ['audited contracts', 'Privy policies', 'Kuru router', 'Envio indexer', 'treasury multisig']
    });
  }
  return json(res, 501, {
    ok: false,
    error: 'client_signature_required',
    message: 'Use a scoped trade or contract endpoint. Every real transaction must be simulated and signed by the connected wallet; the server never holds a user key.'
  });
}
