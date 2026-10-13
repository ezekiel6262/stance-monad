import { CronCapability, handler, Runner, type Runtime } from "@chainlink/cre-sdk";

export type Config = {
  schedule: string;
  stanceId: string;
  metric: string;
  operator: ">=" | "<=";
  threshold: number;
  quorum: number;
  observations: Array<{ source: string; value: number; observedAt: string }>;
};

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const { stanceId, metric, operator, threshold, quorum, observations } = runtime.config;
  if (observations.length < quorum) throw new Error("INSUFFICIENT_QUORUM");

  const votes = observations.map((observation) => ({
    ...observation,
    supports: operator === ">=" ? observation.value >= threshold : observation.value <= threshold,
  }));
  const backVotes = votes.filter((vote) => vote.supports).length;
  const fadeVotes = votes.length - backVotes;
  const outcome = backVotes >= quorum ? "BACK" : fadeVotes >= quorum ? "FADE" : "UNRESOLVED";
  const result = {
    version: 1,
    stanceId,
    metric,
    rule: { operator, threshold },
    outcome,
    quorum,
    votes: { back: backVotes, fade: fadeVotes, total: votes.length },
    evidence: votes.map(({ source, value, observedAt }) => ({ source, value, observedAt })),
  };

  runtime.log(`Stance ${stanceId} resolved ${outcome} with ${backVotes}/${votes.length} supporting observations.`);
  return JSON.stringify(result);
};

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability();

  return [
    handler(
      cron.trigger(
        { schedule: config.schedule }
      ),
      onCronTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
