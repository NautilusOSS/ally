# Indexing capability (ACR)

## Boundary

- **Read-only chain or indexer data MUST be accessed through an indexing service or query layer; UI must not call indexer/algod read APIs directly.**
- If the app has no indexer usage, all read data is from config or external APIs; document that and keep a single place for future indexer integration.

## Allowed

- Loading static config (tokens, pools, app) from JSON or config service.
- Calling external APIs (e.g. Swap-API) for quotes and route data.
- Using indexer only via a dedicated service that exposes queries (e.g. history, analytics) when implemented.

## Forbidden

- Calling Algorand indexer HTTP API directly from UI or feature components.
- Scattering indexer URLs or lookup logic across components.

## Source reference (Ally)

- No indexer used. Token and pool data from `/config/tokens.json`, `/config/pools.json`. Quote and route from Swap-API. History/analytics: none.
