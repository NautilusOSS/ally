# Tokens capability (ACR)

## Boundary

- **Token metadata (symbol, decimals, name, id) MUST come from a token module or config service; UI must not hardcode token lists or decimals.**
- ARC200 and native tokens are identified by tokenId/ASA id; wrapped tokens (e.g. wVOI, wUSDC) are part of the same token config.

## Allowed

- Loading token list from config (e.g. tokens.json) or token module API.
- Resolving token by tokenId, symbol, or address via token module.
- Using decimals and symbol for display and base-unit conversion in UI.

## Forbidden

- Hardcoding token ids or decimals in components.
- Bypassing token config for display or conversion.

## Source reference (Ally)

- `loadTokensConfig()` in `src/lib/config.ts` fetches `/config/tokens.json`; returns `TokenConfig[]` with tokenId, symbol, decimals, name.
- Token ids in use: 0 (VOI), 302190 (USDC), 390001 (wVOI), 395614 (wUSDC), 420069 (UNIT). Whitelist optional via app.json tokenWhitelist.
