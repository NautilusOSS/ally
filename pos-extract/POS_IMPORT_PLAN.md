# POS import plan — Ally

Step-by-step plan to implement POS integration from the Ally extraction.

---

## 1. Modules to create in POS

| Order | Module | Scope |
|-------|--------|--------|
| 1 | **arc200-token** | Load tokens from config (or token service); expose token list and getToken(id/symbol). |
| 2 | **pool** | Load pools from config; expose pool list and getPoolsForPair(fromTokenId, toTokenId). |
| 3 | **wallet** | Wallet service/context: connect(walletId), disconnect(), signTransactions(txns), activeAccount, wallets, algodClient. Enforce ACR: no direct wallet SDK in UI. |
| 4 | **router** | getQuote(params) → call Swap-API /quote; executeSwap(unsignedTxns) → decode, sign via wallet service, submit via algod, waitForConfirmation. |

Dependencies: router depends on arc200-token, pool, wallet.

---

## 2. Actions / queries / events to implement

- **router**  
  - Actions: `getQuote`, `executeSwap` (see module-extract.json).  
  - Queries: quote (debounced or via useQuote hook calling Swap-API).  
  - Events: none.

- **arc200-token**  
  - Queries: loadTokensConfig, getToken(id).  
  - Actions/events: none.

- **pool**  
  - Queries: loadPoolsConfig, availablePoolsForPair(from, to).  
  - Actions/events: none.

- **wallet**  
  - Actions: connect, disconnect, signTransactions.  
  - Queries: activeAccount, wallets, activeWallet, algodClient.  
  - Events: none (optional: onAccountChange if POS supports it).

---

## 3. Runtime behaviors required

- **Wallet**  
  - Support Lute and WalletConnect (and optionally Pera/Defly per OPEN_QUESTIONS).  
  - Single connection flow via wallet service; no UI code calling wallet SDK directly (see acr-docs/frontend/docs/capabilities/wallet.md).  

- **Transactions**  
  - Atomic group from external source (Swap-API); frontend only decodes, signs, submits full group.  
  - Single submit path (optionally behind a transaction service).  
  - Confirmation: waitForConfirmation(algodClient, txid, rounds) with configurable rounds (default 4).  
  - See acr-docs/frontend/docs/capabilities/transactions.md and protocols/atomic-groups.md.  

- **Indexing**  
  - No indexer in Ally; tokens/pools from config, quote from Swap-API.  
  - When adding indexer later: single indexing service and add-indexer-query skill (see acr-docs/frontend/docs/capabilities/indexing.md and skills/add-indexer-query.md).  

- **Slippage**  
  - Passed in quote request (e.g. defaultSlippageTolerance 0.01); enforcement is backend/contract.  

- **Errors**  
  - WalletConnect session expiry: show "reconnect" message; no automatic retry unless POS defines policy (OPEN_QUESTIONS).  

---

## 4. ACR docs to include

- **Capabilities:**  
  - frontend/docs/capabilities/wallet.md  
  - frontend/docs/capabilities/transactions.md  
  - frontend/docs/capabilities/indexing.md  
  - frontend/docs/capabilities/tokens.md  

- **Protocols:**  
  - frontend/docs/protocols/atomic-groups.md  
  - frontend/docs/protocols/arc200.md  

- **Skills:**  
  - frontend/docs/skills/bind-action-form.md  
  - frontend/docs/skills/add-query-hook.md  
  - frontend/docs/skills/add-indexer-query.md  

Copy from `pos-extract/acr-docs/` into the POS repo under the same paths (or as specified by POS layout).

---

## 5. Minimal validation checklist

- [ ] Token list loads from config; UI shows correct symbol/decimals for VOI, USDC, wVOI, wUSDC, UNIT.  
- [ ] Pool list loads; filtering by from/to token yields correct availablePools (e.g. USDC/VOI, VOI/USDC, UNIT/VOI, VOI/UNIT).  
- [ ] Connect wallet (Lute or WalletConnect) via wallet service only; no direct `window.algorand` in UI.  
- [ ] Get quote: POST to Swap-API with inputToken, outputToken, amount, slippageTolerance, optional address and poolId; quote and unsignedTransactions returned.  
- [ ] Execute swap: decode base64 → Uint8Array[]; signTransactions(txns); sendRawTransaction(stxns); waitForConfirmation(txid, 4).  
- [ ] Swap success: user sees success message; quote/amount cleared.  
- [ ] Disconnect clears activeAccount and does not leave signing/submit path in broken state.  
- [ ] ACR: no wallet SDK, indexer, or raw algod calls from UI; tokens from token module/config.  
- [ ] Optional: useQuote(fromToken, toToken, amount, poolId) hook with 800ms debounce and single Swap-API call.

---

## 6. Config to externalize

- Network: voi-mainnet (algod baseServer, genesisHash, genesisId, caipChainId).  
- Swap-API: baseUrl, quote endpoint (see api.json).  
- WalletConnect: projectId (and siteName for Lute).  
- Tokens: tokens.json path or API.  
- Pools: pools.json path or API.  
- App: defaultSlippageTolerance, confirmation rounds (e.g. 4).

Once these are set, another agent or developer can implement the POS modules and UI against this plan and the ACR docs without changing the original Ally repo (read-only extraction).
