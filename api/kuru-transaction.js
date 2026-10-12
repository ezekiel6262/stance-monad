import { createPublicClient, encodeFunctionData, http, isAddress, parseAbi } from 'viem';
import { monad } from 'viem/chains';
import { json } from './_shared.js';

const SPENDER = process.env.KURU_SPENDER_ADDRESS || '0xb3e6778480b2E488385E8205eA05E20060B813cb';
const erc20 = parseAbi(['function allowance(address owner,address spender) view returns (uint256)', 'function approve(address spender,uint256 amount) returns (bool)']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const wallet = String(req.body?.wallet || '');
  const tokenIn = String(req.body?.tokenIn || '');
  const amountRaw = String(req.body?.amountRaw || '');
  const swap = req.body?.swap;
  if (!isAddress(wallet) || !isAddress(tokenIn) || !/^\d+$/.test(amountRaw) || !isAddress(swap?.to || '') || !/^0x[0-9a-fA-F]*$/.test(swap?.data || '')) {
    return json(res, 400, { ok: false, error: 'invalid_transaction_request' });
  }
  try {
    const client = createPublicClient({ chain: monad, transport: http(process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz') });
    const allowance = await client.readContract({ address: tokenIn, abi: erc20, functionName: 'allowance', args: [wallet, SPENDER] });
    const transactions = [];
    if (allowance < BigInt(amountRaw)) {
      transactions.push({ kind: 'approval', chainId: 143, from: wallet, to: tokenIn, value: '0', data: encodeFunctionData({ abi: erc20, functionName: 'approve', args: [SPENDER, BigInt(amountRaw)] }) });
    }
    transactions.push({ kind: 'swap', chainId: 143, from: wallet, to: swap.to, data: swap.data, value: String(swap.value || '0'), gas: swap.gas ? String(swap.gas) : undefined });
    return json(res, 200, { ok: true, venue: 'kuru-flow', requiresWalletSignature: true, transactions });
  } catch (error) {
    return json(res, 502, { ok: false, error: 'kuru_transaction_failed', detail: error.message });
  }
}
