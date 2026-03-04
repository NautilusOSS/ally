# Skill: Add indexer query

## Boundary

- **When adding indexer-backed data (history, analytics), introduce a single indexing service or query layer and expose a hook or API; UI must not call the indexer directly.**
- Indexer base URL and filters must be configured in one place.

## Allowed

- Adding an indexing module or service that exposes e.g. `getAccountTxns(address, filters)`, `getPoolVolume(poolId)`, etc.
- Exposing a hook like `useAccountHistory(address)` or `usePoolStats(poolId)` that uses that service.
- Configuring indexer endpoint in api.json or env; reading it only in the indexing layer.

## Forbidden

- Calling indexer from UI components or from multiple places with different URLs.
- Hardcoding indexer host or app-id filters in components.

## Source reference (Ally)

- No indexer in current app. When adding: create frontend/docs/capabilities/indexing.md compliance (single service, no direct indexer calls from UI).
