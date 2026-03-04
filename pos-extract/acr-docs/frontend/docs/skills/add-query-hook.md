# Skill: Add query hook

## Boundary

- **Read-only data (tokens, pools, quote) must be accessed via query hooks or loaders that define where data comes from and refresh behavior.**
- New queries should be added as named hooks or loaders, not ad-hoc fetch in components.

## Allowed

- Implementing a hook (e.g. `useTokens()`, `usePools()`, `useQuote(params)`) that returns data, loading, error.
- Hooks call config loader or Swap-API; debouncing for quote is done inside the hook or a single place.
- UI components use the hook and do not fetch directly.

## Forbidden

- Fetching tokens, pools, or quote with raw `fetch` inside multiple components.
- Duplicating debounce or cache logic; centralize in the query hook or service.

## Source reference (Ally)

- Tokens/pools/api/app config: loaded in App.tsx loadConfigs (useEffect on mount).
- Quote: fetched in SwapInterface handleGetQuote with 800ms debounce in useEffect; no shared hook yet. POS should add e.g. useQuote(fromToken, toToken, amount, selectedPoolId) that encapsulates debounce and Swap-API call.
