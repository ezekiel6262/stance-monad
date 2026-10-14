import { createPublicClient, defineChain, formatUnits, http, isAddress, parseAbi } from 'viem';
import { json, MONAD_CHAIN_ID, MONAD_RPC_URL } from './_shared.js';
import { readEnvioEvents } from './_envio.js';

const MARKET = process.env.STANCE_MARKET_ADDRESS || '0x6f9103855b1c699f3ce1eb5105415cd2f6ca796e';
const PORTFOLIO = process.env.STANCE_PORTFOLIO_ADDRESS || '0x4e2c91fe23e2415d110c9af24474dc1b21c3aeb9';

const chain = defineChain({
  id: MONAD_CHAIN_ID,
  name: 'Monad Mainnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC_URL] } }
});

const marketAbi = parseAbi([
  'function marketCount() view returns (uint256)',
  'function markets(uint256) view returns (bytes32 thesisHash, uint64 closesAt, uint8 outcome, uint256 backPool, uint256 fadePool)',
  'function backStake(uint256,address) view returns (uint256)',
  'function fadeStake(uint256,address) view returns (uint256)',
  'function claimed(uint256,address) view returns (bool)',
  'event PositionTaken(uint256 indexed marketId, address indexed account, bool back, uint256 amount)',
  'event MarketResolved(uint256 indexed marketId, uint8 outcome)',
  'event Claimed(uint256 indexed marketId, address indexed account, uint256 amount)'
]);

const portfolioAbi = parseAbi([
  'event ProofStancePublished(address indexed author, bytes32 indexed stanceId, bytes32 indexed thesisHash, address token, uint256 positionSize, uint64 expiresAt, string evidenceURI)',
  'event TailRecorded(address indexed follower, address indexed caller, bytes32 indexed stanceId, uint256 amount)'
]);

const value = amount => formatUnits(amount, 6);
const serialiseLog = log => ({
  blockNumber: Number(log.blockNumber),
  transactionHash: log.transactionHash,
  logIndex: Number(log.logIndex),
  ...Object.fromEntries(Object.entries(log.args || {}).map(([key, item]) => [key, typeof item === 'bigint' ? item.toString() : item]))
});

export async function readLiveState(wallet) {
  const client = createPublicClient({ chain, transport: http(MONAD_RPC_URL, { timeout: 12_000 }) });
  const latestBlock = await client.getBlockNumber();
  const count = await client.readContract({ address: MARKET, abi: marketAbi, functionName: 'marketCount' });
  const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1));
  const marketRows = await Promise.all(ids.map(async marketId => {
    const [record, backStake, fadeStake, claimed] = await Promise.all([
      client.readContract({ address: MARKET, abi: marketAbi, functionName: 'markets', args: [marketId] }),
      wallet ? client.readContract({ address: MARKET, abi: marketAbi, functionName: 'backStake', args: [marketId, wallet] }) : 0n,
      wallet ? client.readContract({ address: MARKET, abi: marketAbi, functionName: 'fadeStake', args: [marketId, wallet] }) : 0n,
      wallet ? client.readContract({ address: MARKET, abi: marketAbi, functionName: 'claimed', args: [marketId, wallet] }) : false
    ]);
    return {
      marketId: Number(marketId), thesisHash: record[0], closesAt: Number(record[1]), outcome: Number(record[2]),
      backPool: value(record[3]), fadePool: value(record[4]), totalPool: value(record[3] + record[4]),
      wallet: wallet ? { backStake: value(backStake), fadeStake: value(fadeStake), claimed } : null
    };
  }));

  const fromBlock = latestBlock > 250_000n ? latestBlock - 250_000n : 0n;
  const eventQuery = async (address, abi, eventName, args) => {
    try { return await client.getContractEvents({ address, abi, eventName, args, fromBlock, toBlock: latestBlock }); }
    catch { return []; }
  };
  const walletFilter = wallet || undefined;
  let indexed;
  try {
    indexed = await readEnvioEvents({ market: MARKET, portfolio: PORTFOLIO, wallet, token: process.env.ENVIO_API_TOKEN, startBlock: process.env.STANCE_INDEX_START_BLOCK || 0 });
  } catch (error) {
    const [proofs, tails, positions, resolutions, claims] = await Promise.all([
      eventQuery(PORTFOLIO, portfolioAbi, 'ProofStancePublished'), eventQuery(PORTFOLIO, portfolioAbi, 'TailRecorded'),
      eventQuery(MARKET, marketAbi, 'PositionTaken', wallet ? { account: walletFilter } : undefined),
      eventQuery(MARKET, marketAbi, 'MarketResolved'), eventQuery(MARKET, marketAbi, 'Claimed', wallet ? { account: walletFilter } : undefined)
    ]);
    indexed = { provider: 'Monad RPC fallback', indexedHeight: Number(latestBlock), startBlock: Number(fromBlock), eventCount: proofs.length + tails.length + positions.length + resolutions.length + claims.length, error: error.message,
      proofs: proofs.map(serialiseLog).reverse(), tails: tails.map(serialiseLog).reverse(), positions: positions.map(serialiseLog).reverse(), resolutions: resolutions.map(serialiseLog).reverse(), claims: claims.map(serialiseLog).reverse(), activity: [] };
  }

  return {
    ok: true, source: indexed.provider, chainId: MONAD_CHAIN_ID, latestBlock: Number(latestBlock),
    indexedFromBlock: Number(fromBlock), contracts: { market: MARKET, portfolio: PORTFOLIO }, wallet: wallet || null,
    envio: { provider: indexed.provider, indexedHeight: indexed.indexedHeight, startBlock: indexed.startBlock, eventCount: indexed.eventCount, fallback: Boolean(indexed.error), error: indexed.error || null },
    markets: marketRows, proofs: indexed.proofs, tails: indexed.tails, positions: indexed.positions, resolutions: indexed.resolutions, claims: indexed.claims,
    onchainActivity: indexed.activity.slice(0, 20)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const rawWallet = Array.isArray(req.query?.wallet) ? req.query.wallet[0] : req.query?.wallet;
  if (rawWallet && !isAddress(rawWallet)) return json(res, 400, { ok: false, error: 'invalid_wallet' });
  try { return json(res, 200, await readLiveState(rawWallet)); }
  catch (error) { return json(res, 502, { ok: false, error: 'monad_state_unavailable', detail: error.message }); }
}
