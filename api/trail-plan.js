import { json, requirePost } from './_shared.js';
import { buildTrailPlan, canonicalStance, contentHash } from '../trail-core.js';

export default function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object') throw new Error('Request body is required');
    const stance = body.stance ? canonicalStance(body.stance) : null;
    const plan = buildTrailPlan(body);
    return json(res, 200, {
      ok: true,
      terminology: { source: 'Stance', derivative: 'Trail Portfolio' },
      stanceHash: stance ? contentHash(stance) : null,
      plan
    });
  } catch (error) {
    return json(res, 400, { ok: false, error: 'invalid_trail_plan', detail: error.message });
  }
}
