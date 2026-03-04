# Skill: Bind action to form

## Boundary

- **State-changing actions (e.g. swap) must be bound to the form through a single action handler; the handler receives validated inputs and calls the appropriate module/service.**
- Form state (amount, fromToken, toToken, selectedPoolId) is validated before calling getQuote or executeSwap.

## Allowed

- Form inputs update local/context state (amount, fromToken, toToken, pool).
- On submit/button click: validate inputs, then call router action (getQuote or executeSwap) with those inputs.
- Display errors and loading state from the action result.

## Forbidden

- Calling wallet sign or algod submit from inside the form component without going through the router/swap action.
- Duplicating validation logic across components; centralize in action or a small validation helper.

## Source reference (Ally)

- SwapInterface: amount, fromToken, toToken, selectedPoolId are props; handleGetQuote builds request from tokens + appConfig (slippage) + optional address/poolId; handleSwap uses unsignedTransactions from quote state and useWallet().signTransactions + algodClient.
