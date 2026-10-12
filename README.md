# Stance on Monad

Stance is a Monad-native conviction market where users can Back or Fade takes, publish wallet-backed Proof Stances with explicit thesis targets, Tail verified calls, and build portable Receipts.

## Current product

- Interactive stance feed with Back, Fade, and Tail flows
- Proof Stances with Monad wallet selection and thesis targets
- Receipts portfolio with calibration, performance, and Said vs Did history
- Live Rooms, Tribes, Duels, alerts, wallet, and resolution states
- Monad-only interface and transaction language

## Production integrations

The deployed integration layer now exposes live health and readiness endpoints:

- `GET /api/monad` verifies Monad mainnet chain ID `143` and the latest block
- `GET /api/perpl` reads Perpl's public Monad context
- `GET /api/integrations` reports configuration readiness without exposing secrets
- `POST /api/nansen` provides an allow-listed, Monad-only server proxy
- `POST /api/execute` fails closed until audited contracts, wallet policies and routing are configured

Copy `.env.example` into Vercel environment variables. Secrets must never be committed. `REAL_MONEY_ENABLED` remains `false` until the contracts and transaction flow have passed security review.

## Run locally

Serve this directory with any static web server and open `index.html`.

