# Open questions (POS extraction — Ally)

1. **Swap-API contract ownership**  
   App IDs and logic for swap200/HumbleSwap/Nomadex are not in the frontend. Where are they defined (Swap-API repo, chain config)? Needed for POS config and ACR.

2. **Fee and MBR funding**  
   Who funds fees and MBR for the atomic group—user, relayer, or included in Swap-API-built txns? Not visible in frontend.

3. **Deadline / validity round**  
   Quote request does not send a deadline; is it enforced by Swap-API or contracts? TBD for POS transaction docs.

4. **Account switching**  
   use-wallet-react exposes activeAccount; there is no explicit "switch account" UI in Ally. Is multi-account switching required for POS?

5. **Pera / Defly as first-class**  
   Ally uses Lute + WalletConnect; App.tsx has a fallback using `window.algorand`. Should POS support Pera/Defly natively or only via WalletConnect?

6. **Token whitelist**  
   app.json has optional tokenWhitelist; public/config/tokens.json is a subset of config/tokens.json. Which token set is canonical for POS (full list vs whitelist)?

7. **Voi API**  
   api.json has voiApi.baseUrl and endpoints.pools; no usage found in src. Is this dead config or used elsewhere (e.g. future pool discovery)?

8. **Confirmation rounds**  
   waitForConfirmation(algodClient, res.txid, 4). Is 4 rounds the product requirement or should it be configurable?

9. **Error retry**  
   No automatic retry on submit or sign failure. Should POS define a retry policy (e.g. for network errors)?

10. **History / analytics**  
    No indexer or history view. Should POS plan for a shared indexing capability and where would it plug in (router, separate module)?
