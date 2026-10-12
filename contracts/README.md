# Stance contracts

These contracts are restricted to Monad mainnet and official Monad USDC at deployment time. Real-money mode must remain disabled until deployment, source verification, and an independent security review are complete.

## Test

```sh
forge test -vv
```

## Deploy

Use a dedicated Foundry keystore account; do not put a private key in `.env` or the command line.

```sh
export MONAD_RPC_URL=https://rpc.monad.xyz
export COLLATERAL_TOKEN_ADDRESS=0x754704Bc059F8C67012fEd69BC8A327a5aafb603
export RESOLVER_ADDRESS=<dedicated resolver or automation address>
export TREASURY_MULTISIG_ADDRESS=<multisig owner address>

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$MONAD_RPC_URL" \
  --account stance-deployer \
  --broadcast \
  --verify
```

After deployment, independently confirm the bytecode, owner, resolver, collateral, and chain ID. Then set `STANCE_MARKET_ADDRESS` and `STANCE_PORTFOLIO_ADDRESS` in Vercel. Keep `REAL_MONEY_ENABLED=false` until the production application has passed an end-to-end dry run.
