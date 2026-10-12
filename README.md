# Stance on Monad

Stance is a Monad-native conviction market where users can Back or Fade takes, publish wallet-backed Proof Stances with explicit targets, create attributed Trail Portfolios from public allocations, and build portable Receipts.

## Current product

- Interactive stance feed with Back, Fade, and Tail flows
- Stance portfolios with canonical thesis commitments and attributed Trail Portfolio plans
- Proof Stances with Monad wallet selection and thesis targets
- Receipts portfolio with calibration, performance, and Said vs Did history
- Live Rooms, Tribes, Duels, alerts, wallet, and resolution states
- Monad-only interface and transaction language

## Production integrations

The deployed integration layer now exposes live health and readiness endpoints:

- `GET /api/monad` verifies Monad mainnet chain ID `143` and the latest block
- `GET /api/perpl` reads Perpl's public Monad context
- `GET /api/envio` reads current Monad height and recent Stance contract events through Envio HyperSync
- `GET /api/integrations` reports configuration readiness without exposing secrets
- `POST /api/nansen` provides an allow-listed, Monad-only server proxy
- `POST /api/kuru-quote` obtains a wallet-bound Kuru Flow quote
- `POST /api/kuru-transaction` returns ordered approval and swap requests for wallet signing
- `POST /api/execute` fails closed until audited contracts, wallet policies and routing are configured
- `POST /api/trail-plan` builds an immutable, risk-checked Trail Portfolio plan for Monad; live legs are restricted to approved Kuru assets

`contracts/` contains a compile-verified escrow, the deployed Proof/Tail receipt registry, and a separate portfolio-lineage registry for Stance and Trail Portfolio commitments. The new registry is not audited or deployed. `envio/` contains the post-deployment indexing schema and contract event configuration.

Copy `.env.example` into Vercel environment variables. Secrets must never be committed. `REAL_MONEY_ENABLED` remains `false` until the contracts and transaction flow have passed security review.

## Run locally

Serve this directory with any static web server and open `index.html`.

