import { describe, expect } from "bun:test";
import { newTestRuntime, test } from "@chainlink/cre-sdk/test";
import { onCronTrigger, initWorkflow } from "./main";
import type { Config } from "./main";

describe("onCronTrigger", () => {
  test("resolves an objective stance when source quorum agrees", async () => {
    const config: Config = {
      schedule: "*/5 * * * *", stanceId: "btc-above-100k", metric: "BTC_USD",
      operator: ">=", threshold: 100000, quorum: 2,
      observations: [
        { source: "market-a", value: 101200, observedAt: "2026-10-13T00:00:00Z" },
        { source: "market-b", value: 100900, observedAt: "2026-10-13T00:00:02Z" },
        { source: "market-c", value: 99800, observedAt: "2026-10-13T00:00:03Z" },
      ],
    };
    const runtime = newTestRuntime();
    runtime.config = config;

    const result = JSON.parse(onCronTrigger(runtime));

    expect(result.outcome).toBe("BACK");
    expect(result.votes).toEqual({ back: 2, fade: 1, total: 3 });
    const logs = runtime.getLogs();
    expect(logs.join("\n")).toContain("resolved BACK");
  });

  test("fails closed when evidence quorum is unavailable", async () => {
    const runtime = newTestRuntime();
    runtime.config = {
      schedule: "*/5 * * * *", stanceId: "mon-above-3", metric: "MON_USD",
      operator: ">=", threshold: 3, quorum: 2,
      observations: [{ source: "market-a", value: 3.1, observedAt: "2026-10-13T00:00:00Z" }],
    } satisfies Config;
    expect(() => onCronTrigger(runtime)).toThrow("INSUFFICIENT_QUORUM");
  });
});

describe("initWorkflow", () => {
  test("returns one handler with correct cron schedule", async () => {
    const testSchedule = "0 0 * * *";
    const config: Config = {
      schedule: testSchedule, stanceId: "test", metric: "TEST", operator: ">=",
      threshold: 1, quorum: 1,
      observations: [{ source: "test", value: 1, observedAt: "2026-10-13T00:00:00Z" }],
    };

    const handlers = initWorkflow(config);

    expect(handlers).toBeArray();
    expect(handlers).toHaveLength(1);
    expect(handlers[0].trigger.config.schedule).toBe(testSchedule);
  });

  test("handler executes onCronTrigger and returns result", async () => {
    const config: Config = {
      schedule: "*/5 * * * *", stanceId: "test", metric: "TEST", operator: ">=",
      threshold: 1, quorum: 1,
      observations: [{ source: "test", value: 1, observedAt: "2026-10-13T00:00:00Z" }],
    };
    const runtime = newTestRuntime();
    runtime.config = config;
    const handlers = initWorkflow(config);

    const result = handlers[0].fn(runtime, {});

    expect(result).toBe(onCronTrigger(runtime));
  });
});
