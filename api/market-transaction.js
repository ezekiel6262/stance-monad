import { encodeFunctionData, isAddress, parseAbi } from 'viem';
import { json, requirePost } from './_shared.js';

const MARKET = process.env.STANCE_MARKET_ADDRESS || '0x6f9103855b1c699f3ce1eb5105415cd2f6ca796e';
const AUSD = process.env.AUSD_ADDRESS || '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a';
const erc20Abi = parseAbi(['function approve(address spender,uint256 amount) returns (bool)']);
const marketAbi = parseAbi(['function takePosition(uint256 marketId,bool back,uint256 amount)']);

export function buildMarketPositionTransactions(body) {
  const wallet = String(body.wallet || '');
  const amount = String(body.amount || '');
  const marketId = String(body.marketId || '');
  if (!isAddress(wallet)) throw new Error('Connect a valid Monad wallet');
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) throw new Error('Enter a valid AUSD amount');
  if (!/^\d+$/.test(marketId) || BigInt(marketId) <= 0n) throw new Error('Choose a valid prediction market');
  if (typeof body.back !== 'boolean') throw new Error('Choose Back or Fade');
  return {
    action: 'take-position', chainId: 143, wallet, marketId: Number(marketId), back: body.back, amount,
    transactions: [
      { chainId: 143, from: wallet, to: AUSD, value: '0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [MARKET, BigInt(amount)] }) },
      { chainId: 143, from: wallet, to: MARKET, value: '0', data: encodeFunctionData({ abi: marketAbi, functionName: 'takePosition', args: [BigInt(marketId), body.back, BigInt(amount)] }) }
    ]
  };
}

export default function handler(req, res) {
  if (!requirePost(req, res)) return;
  try { return json(res, 200, { ok: true, ...buildMarketPositionTransactions(req.body || {}) }); }
  catch (error) { return json(res, 400, { ok: false, error: 'invalid_market_position', detail: error.message }); }
}
