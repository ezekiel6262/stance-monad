# Stance Envio indexer

This indexer is intentionally not deployable until the audited Monad contract addresses are known. After deployment:

1. Replace both zero addresses in `config.yaml`.
2. Set `start_block` to the deployment block.
3. Generate handlers with Envio HyperIndex v3 and implement the entity writes described by `schema.graphql`.
4. Deploy to Envio Cloud and set the resulting GraphQL URL as `ENVIO_GRAPHQL_URL` in Vercel.

Never point the production indexer at an unaudited deployment.
