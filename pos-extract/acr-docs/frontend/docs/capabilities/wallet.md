# Wallet capability (ACR)

## Boundary

- **UI must not call wallet SDK directly; use wallet service.**
- All connection, disconnect, and signing flows MUST go through a single wallet service/context provided by POS.

## Allowed

- Calling wallet service: `connect(walletId)`, `disconnect()`, `signTransactions(txns: Uint8Array[])`.
- Reading from wallet service: `activeAccount`, `wallets`, `activeWallet`, `algodClient`.
- Displaying connection state and account address in UI.

## Forbidden

- Accessing `window.algorand` or any wallet-specific global from UI or feature code.
- Instantiating WalletConnect or Lute clients directly in components.
- Bypassing the wallet service for signing or account access.

## Source reference (Ally)

- Connection: `WalletConnectModal` uses `useWallet().wallets` and `wallet.connect()`.
- Signing: `SwapInterface` uses `useWallet().signTransactions`, `algodClient`, `activeAccount`.
- Fallback in App.tsx that uses `window.algorand` is a regression risk; POS should provide one path via wallet service only.
