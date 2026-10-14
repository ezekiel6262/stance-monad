import { decodeEventLog, parseAbi } from 'viem';

export const HYPERSYNC_URL = 'https://monad.hypersync.xyz';

const eventAbi = parseAbi([
  'event MarketCreated(uint256 indexed marketId, bytes32 indexed thesisHash, uint64 closesAt)',
  'event PositionTaken(uint256 indexed marketId, address indexed account, bool back, uint256 amount)',
  'event MarketResolved(uint256 indexed marketId, uint8 outcome)',
  'event Claimed(uint256 indexed marketId, address indexed account, uint256 amount)',
  'event ProofStancePublished(address indexed author, bytes32 indexed stanceId, bytes32 indexed thesisHash, address token, uint256 positionSize, uint64 expiresAt, string evidenceURI)',
  'event TailRecorded(address indexed follower, address indexed caller, bytes32 indexed stanceId, uint256 amount)'
]);

const serialise = value => typeof value === 'bigint' ? value.toString() : value;

export function flattenHyperSyncLogs(payload) {
  return (payload?.data || []).flatMap(batch => batch?.logs || []);
}

export function decodeHyperSyncLog(log) {
  const topics = [log.topic0, log.topic1, log.topic2, log.topic3].filter(Boolean);
  const decoded = decodeEventLog({ abi: eventAbi, data: log.data || '0x', topics, strict: false });
  return {
    eventName: decoded.eventName,
    blockNumber: Number(log.block_number),
    transactionHash: log.transaction_hash,
    logIndex: Number(log.log_index || 0),
    address: log.address,
    ...Object.fromEntries(Object.entries(decoded.args || {}).map(([key, value]) => [key, serialise(value)]))
  };
}

export async function readEnvioEvents({ market, portfolio, wallet, token, startBlock = 0 }) {
  if (!token) throw new Error('envio_not_configured');
  const heightResponse = await fetch(`${HYPERSYNC_URL}/height`, { signal: AbortSignal.timeout(8000) });
  if (!heightResponse.ok) throw new Error(`envio_height_${heightResponse.status}`);
  const { height } = await heightResponse.json();
  const addresses = [market, portfolio].map(address => address.toLowerCase());
  const logs = [];
  let fromBlock = Number(startBlock) || 0;
  let pages = 0;
  while (fromBlock <= height && pages < 50) {
    const response = await fetch(`${HYPERSYNC_URL}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from_block: fromBlock,
        to_block: height + 1,
        logs: [{ address: addresses }],
        field_selection: { log: ['address', 'block_number', 'transaction_hash', 'log_index', 'data', 'topic0', 'topic1', 'topic2', 'topic3'] },
        join_mode: 'JoinNothing'
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`envio_query_${response.status}`);
    const payload = await response.json();
    logs.push(...flattenHyperSyncLogs(payload));
    const next = Number(payload.next_block);
    if (!next || next <= fromBlock || next > height) break;
    fromBlock = next;
    pages += 1;
  }
  const decoded = logs.map(log => {
    try { return decodeHyperSyncLog(log); } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  const same = address => !wallet || String(address).toLowerCase() === wallet.toLowerCase();
  return {
    provider: 'Envio HyperSync', indexedHeight: Number(height), startBlock: Number(startBlock) || 0,
    eventCount: decoded.length, pages: pages + 1,
    proofs: decoded.filter(event => event.eventName === 'ProofStancePublished'),
    tails: decoded.filter(event => event.eventName === 'TailRecorded'),
    positions: decoded.filter(event => event.eventName === 'PositionTaken' && same(event.account)),
    resolutions: decoded.filter(event => event.eventName === 'MarketResolved'),
    claims: decoded.filter(event => event.eventName === 'Claimed' && same(event.account)),
    activity: decoded
  };
}
