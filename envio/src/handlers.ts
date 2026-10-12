import { indexer, type EvmOnEventContext } from "envio";

const emptyAccount = (id: string) => ({
  id: id.toLowerCase(), backVolume: 0n, fadeVolume: 0n, claims: 0n,
  claimedAmount: 0n, proofStances: 0n, tailsMade: 0n, tailsReceived: 0n,
});

const account = (context: EvmOnEventContext, id: string) =>
  context.AccountStat.getOrCreate(emptyAccount(id));

indexer.onEvent({ contract: "StanceMarket", event: "MarketCreated" }, async ({ event, context }) => {
  context.Market.set({
    id: event.params.marketId.toString(), thesisHash: event.params.thesisHash,
    closesAt: event.params.closesAt, outcome: 0, backPool: 0n, fadePool: 0n,
  });
});

indexer.onEvent({ contract: "StanceMarket", event: "PositionTaken" }, async ({ event, context }) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({
    ...market,
    backPool: market.backPool + (event.params.back ? event.params.amount : 0n),
    fadePool: market.fadePool + (event.params.back ? 0n : event.params.amount),
  });
  context.Position.set({
    id: `${event.transaction.hash}-${event.logIndex}`, marketId: event.params.marketId,
    account: event.params.account.toLowerCase(), side: event.params.back ? "BACK" : "FADE",
    amount: event.params.amount, transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
  });
  const stats = await account(context, event.params.account);
  context.AccountStat.set({
    ...stats,
    backVolume: stats.backVolume + (event.params.back ? event.params.amount : 0n),
    fadeVolume: stats.fadeVolume + (event.params.back ? 0n : event.params.amount),
  });
});

indexer.onEvent({ contract: "StanceMarket", event: "MarketResolved" }, async ({ event, context }) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (market) context.Market.set({ ...market, outcome: event.params.outcome });
});

indexer.onEvent({ contract: "StanceMarket", event: "Claimed" }, async ({ event, context }) => {
  const stats = await account(context, event.params.account);
  context.AccountStat.set({ ...stats, claims: stats.claims + 1n, claimedAmount: stats.claimedAmount + event.params.amount });
});

indexer.onEvent({ contract: "StancePortfolio", event: "ProofStancePublished" }, async ({ event, context }) => {
  context.ProofStance.set({
    id: event.params.stanceId, author: event.params.author.toLowerCase(),
    thesisHash: event.params.thesisHash, token: event.params.token.toLowerCase(),
    positionSize: event.params.positionSize, expiresAt: event.params.expiresAt,
    evidenceURI: event.params.evidenceURI,
  });
  const stats = await account(context, event.params.author);
  context.AccountStat.set({ ...stats, proofStances: stats.proofStances + 1n });
});

indexer.onEvent({ contract: "StancePortfolio", event: "TailRecorded" }, async ({ event, context }) => {
  context.Tail.set({
    id: `${event.transaction.hash}-${event.logIndex}`, follower: event.params.follower.toLowerCase(),
    caller: event.params.caller.toLowerCase(), stanceId: event.params.stanceId,
    amount: event.params.amount, transactionHash: event.transaction.hash,
  });
  const [follower, caller] = await Promise.all([
    account(context, event.params.follower), account(context, event.params.caller),
  ]);
  context.AccountStat.set({ ...follower, tailsMade: follower.tailsMade + 1n });
  context.AccountStat.set({ ...caller, tailsReceived: caller.tailsReceived + 1n });
});
