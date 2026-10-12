import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function perplCanonical({ chainId = 143, method = 'GET', target, timestamp, nonce, body = '' }) {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  return [chainId, method.toUpperCase(), target, timestamp, nonce, bodyHash].join('\n');
}

export function perplAuthHeaders({ apiKey, secret, target, method = 'GET', body = '' }) {
  const seed = Buffer.from(String(secret || '').replace(/^0x/, ''), 'hex');
  if (seed.length !== 32) throw new Error('invalid_perpl_secret');

  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString('base64url');
  const canonical = perplCanonical({ method, target, timestamp, nonce, body });
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  });
  const signature = sign(null, Buffer.from(canonical), privateKey).toString('base64url');

  return {
    accept: 'application/json',
    'X-API-Key': apiKey,
    'X-API-Timestamp': timestamp,
    'X-API-Nonce': nonce,
    'X-API-Signature': signature
  };
}
