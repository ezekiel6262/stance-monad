import { encodeFunctionData, isAddress, keccak256, parseAbi, stringToHex } from 'viem';
import { json, requirePost } from './_shared.js';

const PORTFOLIO = process.env.STANCE_PORTFOLIO_ADDRESS || '0x4e2c91fe23e2415d110c9af24474dc1b21c3aeb9';
const abi = parseAbi([
  'function publishProofStance(bytes32 stanceId,bytes32 thesisHash,address token,uint256 positionSize,uint64 expiresAt,string evidenceURI)',
  'function recordTail(address caller,bytes32 stanceId,uint256 amount)'
]);

const positiveInteger = value => /^\d+$/.test(String(value)) && BigInt(value) > 0n;

export function buildPortfolioTransaction(body) {
  const wallet = String(body.wallet || '');
  if (!isAddress(wallet)) throw new Error('Connect a valid Monad wallet');
  if (body.action === 'publish') {
    const thesis = String(body.thesis || '').trim();
    const token = String(body.token || '');
    const positionSize = String(body.positionSize || '');
    const expiresAt = Number(body.expiresAt);
    const evidenceURI = String(body.evidenceURI || '').trim();
    if (thesis.length < 12 || thesis.length > 1000) throw new Error('Stance must be 12–1000 characters');
    if (!isAddress(token) || !positiveInteger(positionSize)) throw new Error('Token and position size are required');
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('Expiry must be in the future');
    if (!/^https:\/\//i.test(evidenceURI) || evidenceURI.length > 500) throw new Error('Evidence must be a secure transaction or position URL');
    const thesisHash = keccak256(stringToHex(thesis));
    const stanceId = keccak256(stringToHex(`${wallet.toLowerCase()}|${thesisHash}|${evidenceURI}`));
    return {
      action: 'publish', chainId: 143, from: wallet, to: PORTFOLIO, value: '0', stanceId, thesisHash,
      data: encodeFunctionData({ abi, functionName: 'publishProofStance', args: [stanceId, thesisHash, token, BigInt(positionSize), BigInt(expiresAt), evidenceURI] })
    };
  }
  if (body.action === 'trail') {
    const caller = String(body.caller || '');
    const stanceId = String(body.stanceId || '');
    const amount = String(body.amount || '');
    if (!isAddress(caller) || !/^0x[0-9a-fA-F]{64}$/.test(stanceId) || !positiveInteger(amount)) throw new Error('Caller, Stance ID, and amount are required');
    if (caller.toLowerCase() === wallet.toLowerCase()) throw new Error('You cannot Trail your own Stance');
    return {
      action: 'trail', chainId: 143, from: wallet, to: PORTFOLIO, value: '0', stanceId,
      data: encodeFunctionData({ abi, functionName: 'recordTail', args: [caller, stanceId, BigInt(amount)] })
    };
  }
  throw new Error('Unsupported Portfolio action');
}

export default function handler(req, res) {
  if (!requirePost(req, res)) return;
  try { return json(res, 200, { ok: true, transaction: buildPortfolioTransaction(req.body || {}) }); }
  catch (error) { return json(res, 400, { ok: false, error: 'invalid_portfolio_transaction', detail: error.message }); }
}
