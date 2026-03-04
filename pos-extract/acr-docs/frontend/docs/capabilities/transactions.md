# Transactions capability (ACR)

## Boundary

- **Transaction building and submission MUST go through a transaction service or module; UI only triggers actions and displays status.**
- Atomic groups are built by a dedicated builder (or external API); UI must not construct raw transaction arrays.

## Allowed

- Requesting a quote/unsigned transactions from the router module or external Swap-API.
- Passing unsigned transactions (from trusted source) to wallet service for signing.
- Calling `algodClient.sendRawTransaction(stxns).do()` after signing (preferably via a transaction service that wraps algod).
- Waiting for confirmation via a single canonical method (e.g. `waitForConfirmation(algodClient, txid, rounds)` or POS equivalent).

## Forbidden

- Building atomic groups or encoding app-call args in UI code.
- Submitting transactions without going through the designated transaction/submit path.
- Using algod client directly from UI; wrap in transaction service.

## Source reference (Ally)

- Unsigned txns: from Swap-API `/quote` response (`unsignedTransactions` base64 array).
- Decode: base64 → Uint8Array in `SwapInterface.handleSwap`.
- Sign: `signTransactions(txnsToSign)` from useWallet.
- Submit: `algodClient.sendRawTransaction(stxns).do()` then `algosdk.waitForConfirmation(algodClient, res.txid, 4)`.
