# Stance Envio indexer

This HyperIndex v3 indexer tracks the deployed Stance contracts on Monad mainnet and produces the GraphQL data used by portfolios and Caller Score.

1. Run `npm install` and `npm run check`.
2. Connect this repository in Envio Cloud with `envio/` as the indexer directory.
3. Deploy and set the resulting GraphQL URL as `ENVIO_GRAPHQL_URL` in Vercel.

The contracts are exact-match verified, but the escrow has not received an independent security audit; real-money mode remains disabled.
