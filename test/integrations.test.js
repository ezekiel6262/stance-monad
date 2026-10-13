import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/integrations.js';

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = JSON.stringify(value); return this; },
    end(value = '') { this.body = value; return this; }
  };
}

test('reports public Perpl data separately from wallet account access', () => {
  const priorKey = process.env.PERPL_API_KEY;
  const priorSecret = process.env.PERPL_API_KEY_SECRET;
  delete process.env.PERPL_API_KEY;
  delete process.env.PERPL_API_KEY_SECRET;

  const res = response();
  handler({ method: 'GET' }, res);
  const data = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(data.services.perpl, true);
  assert.equal(data.services.agora, true);
  assert.equal(data.services.perplAccount, false);
  assert.equal(data.services.mera, true);

  if (priorKey === undefined) delete process.env.PERPL_API_KEY;
  else process.env.PERPL_API_KEY = priorKey;
  if (priorSecret === undefined) delete process.env.PERPL_API_KEY_SECRET;
  else process.env.PERPL_API_KEY_SECRET = priorSecret;
});
