# POS Integration Summary — Ally (Voi DEX Aggregator)

## Source app

- **Name:** Ally  
- **Role:** DEX aggregator for Voi; integrates HumbleSwap, Nomadex, and Swap-API (swap200/ARC200).  
- **Stack:** Vite, React 18, TypeScript, Tailwind; `@txnlab/use-wallet-react`, `algosdk`, `lute-connect`, WalletConnect.  
- **Network:** Voi mainnet (genesisId: voimain-v1.0).

## Module candidates (POS)

| Module       | Purpose | Actions | Queries | Key config |
|-------------|---------|---------|---------|------------|
| **router**  | Quote + execute swap | getQuote, executeSwap | quote (Swap-API) | swapApi baseUrl, quote endpoint |
| **arc200-token** | Token list + metadata | — | loadTokensConfig | token_ids, tokens.json |
| **pool**    | Pool list + filter by pair | — | loadPoolsConfig, availablePoolsForPair | pool_ids, pools.json |
| **wallet**  | Connect, disconnect, sign | connect, disconnect, signTransactions | activeAccount, wallets | Lute, WalletConnect, network |

- **Events:** None extracted (no ARC4 logs or indexer filters in frontend).  
- **uiBlocks:** SwapInterface (inputs, quote, route breakdown, swap CTA), WalletConnectModal, token/pool selectors.

## Runtime behaviors

- **Wallet:** Lute + WalletConnect via WalletManager; fallback path uses `window.algorand`. Connection via modal; disconnect via activeWallet.disconnect.  
- **Transactions:** Atomic group from Swap-API (base64); frontend decodes → signTransactions → sendRawTransaction → waitForConfirmation(4). No local group building; fee/MBR TBD (Swap-API).  
- **Indexing:** No indexer; tokens/pools from static config; quote from Swap-API.

## ACR docs produced

- **Capabilities:** wallet, transactions, indexing, tokens.  
- **Protocols:** atomic-groups, arc200.  
- **Skills:** bind-action-form, add-query-hook, add-indexer-query.

## Artifacts list (pos-extract/)

1. `POS_INTEGRATION_SUMMARY.md` (this file)  
2. `module-extract.json`  
3. `runtime-extract.json`  
4. `acr-docs/` (frontend/docs/capabilities, protocols, skills)  
5. `OPEN_QUESTIONS.md`  
6. `POS_IMPORT_PLAN.md`

## Punch list (high level)

- [ ] Implement POS modules: router, arc200-token, pool, wallet.  
- [ ] Wallet: single wallet service; remove direct `window.algorand` from UI.  
- [ ] Transactions: single submit path; optional transaction service wrapping algod.  
- [ ] Quote: optional useQuote hook with debounce and Swap-API behind router.  
- [ ] Add indexer only via indexing service + add-indexer-query skill when needed.  
- [ ] Validate against ACR docs (wallet, transactions, indexing, tokens, atomic-groups, arc200).
