# Atomic groups (ACR)

## Boundary

- **Swap execution uses a single atomic group produced by the router/Swap-API; all transactions in the group must be signed and submitted together.**
- UI does not build the group; it receives an array of unsigned transactions and passes them to the wallet for signing, then submits the signed group.

## Allowed

- Receiving `unsignedTransactions` (e.g. base64[]) from quote API.
- Decoding to `Uint8Array[]` and passing to `signTransactions`.
- Submitting the full signed array with `sendRawTransaction(stxns).do()` (no partial submit).

## Forbidden

- Submitting a subset of the group or reordering.
- Building or modifying the group in the frontend.

## Source reference (Ally)

- Swap-API returns `unsignedTransactions`; `handleSwap` decodes each base64 to Uint8Array, calls `signTransactions(txnsToSign)`, then `algodClient.sendRawTransaction(stxns).do()`.
