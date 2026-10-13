# Stance Objective Resolution CRE Workflow

This Chainlink Runtime Environment workflow resolves objective Stances from a configured evidence set. It evaluates every observation against the rule, requires an explicit quorum, fails closed when quorum is unavailable, and emits deterministic JSON suitable for hashing and later on-chain submission.

Current status: local CRE simulation only. Chainlink deployment access is commercially gated, and Monad is not configured here as a CRE write target. Do not represent this workflow as deployed.

From `stance-cre`:

```bash
bun install --cwd ./objective-stance
cre workflow simulate objective-stance --target staging-settings --non-interactive --trigger-index 0
```

The staging fixture resolves `btc-above-100k-2026-10-13` as `BACK` with a 2-of-3 evidence quorum. Production configuration intentionally contains no observations so it fails closed until real evidence adapters are configured.
