Cursor Prompt — Build Ally, a simple & intuitive DEX aggregator for Voi

You are an expert TypeScript full-stack engineer.
Create a minimal, production-ready MVP called Ally (Voi DEX Aggregator).

Goals

Simple & intuitive: one input, one output, best route clearly shown.

MVP: off-chain quoting only (no on-chain execution yet).

DEX coverage: start with HumbleSwap and PactFi via lightweight adapters.

Routing: best of (a) single-hop on either DEX, (b) two-hop via a common intermediate (e.g., VOI or USDC).

Standards: ARC-200 token metadata (symbol, decimals) handled cleanly.

Tech

Monorepo with pnpm workspaces:

apps/web: Next.js 14 (App Router, TypeScript).

apps/api: Fastify + TypeScript; exposes /quote.

packages/sdk: shared types, pool math, router, and DEX adapters.

Styling: Tailwind CSS.

Lint/format: ESLint + Prettier.

Testing: Vitest + happy-path tests for routing math.

UX (keep it extremely simple)

Title: Ally — your trading ally on Voi.

Inputs:

“From” token (select), amount

“To” token (select)
[Get Quote] button

Output card shows:

Best amount out

Route (e.g., HumbleSwap direct, or PactFi: VOI→USDC→BUIDL)

Estimated price impact and route breakdown

Link-style secondary options: “Compare routes”

Empty state copy: “Pick tokens, enter an amount, and let Ally find the best route.”

Data assumptions

Provide a tiny in-repo token list for Voi (JSON) with a few sample tokens (VOI, USDC, BUIDL, WVOI etc.).

Provide mockable indexer endpoints via .env (don’t hard-depend on live infra). If env is missing, seed with sample pool snapshots (JSON) for HumbleSwap & PactFi to make quotes work offline.

API

GET /quote?from=VOI&to=BUIDL&amount=123.45&slippageBps=50

Returns:

type Quote = {
  amountIn: string; // normalized decimal string
  amountOut: string;
  path: Array<{ dex: 'HUMBLE'|'PACT'; from: string; to: string; poolId: string }>;
  priceImpactPct: number;
  feesEstimated: { lpFeePct: number; protocolFeePct?: number };
  warnings?: string[];
  routeType: 'DIRECT' | 'TWO_HOP';
  comparedRoutes: Array<{label:string; amountOut:string; routeType:string}>;
  timestamp: number;
}


Handle token decimals correctly; use BigInt where helpful; avoid floating-point drift.

Packages (implementation details)
packages/sdk

types.ts: Token, Pool, DexAdapter interface.

math.ts: x*y=k AMM math helpers: getAmountOut, priceImpact, slippage helpers.

adapters/humble.ts and adapters/pact.ts:

fetchPools(tokens: Token[]): Promise<Pool[]> (from env indexer URL or local mocks)

findDirectPool(from, to): Pool | null

router.ts:

quoteDirect(adapters[], from, to, amountIn)

quoteTwoHop(adapters[], from, mid, to, amountIn) with candidate mids from a small allowlist (e.g., VOI, USDC).

bestQuote(...) that compares: Humble direct, Pact direct, Humble two-hop, Pact two-hop, and cross-DEX two-hop (e.g., Humble first hop + Pact second hop).

Return consistent Quote per schema.

apps/api

Fastify server with CORS.

Route /quote → parse params → call bestQuote → return JSON.

Environment:

VOI_TOKEN_LIST=./packages/sdk/tokens.voi.json
HUMBLE_INDEXER_URL=http://localhost:4001/mock-humble.json
PACT_INDEXER_URL=http://localhost:4001/mock-pact.json


Include a /health endpoint.

apps/web

Next.js page app/page.tsx with:

Minimal token pickers (from token list), numeric amount input

Call /quote and render the result card

“Compare routes” toggles a small table of the comparedRoutes

Nice touches:

Input validation (disable button if invalid)

Loading state on button

Error toast on API failure

Branding: small Ally logo (text logo ok), dark-blue theme.

File tree (sketch)
ally/
  apps/
    api/
      src/index.ts
      src/routes/quote.ts
      src/routes/health.ts
    web/
      app/page.tsx
      styles/globals.css
  packages/
    sdk/
      src/types.ts
      src/math.ts
      src/router.ts
      src/adapters/humble.ts
      src/adapters/pact.ts
      tokens.voi.json
      mocks/
        humble.pools.json
        pact.pools.json
  package.json
  pnpm-workspace.yaml
  .eslintrc.cjs
  .prettierrc
  tsconfig.json
  .env.example
  README.md

Core logic specs

Pool math (constant-product):

amountOut = (amountIn * 997 * rOut) / (rIn*1000 + amountIn*997) style fee model configurable per adapter.

Compute price impact vs mid-price.

Slippage: apply slippageBps guard to produce “min amount out” (shown but not needed for off-chain).

Two-hop: simulate sequentially with output of hop1 as input to hop2; consider fee on each hop.

Cross-DEX two-hop supported (e.g., first hop on Humble, second hop on Pact).

Decimals: use a fixed-precision BigInt utility (e.g., scale by 10^decimals).

Tests (Vitest)

Unit tests for:

getAmountOut correctness vs hand-computed examples.

bestQuote picks higher amountOut when direct vs two-hop compete.

Price impact increases when reserves shrink.

Test with mock pools for VOI/USDC, USDC/BUIDL on both DEXes.

Commands

pnpm i

pnpm -w run dev (concurrently run apps/api on 3001 and apps/web on 3000)

pnpm -w run test

Non-goals (explicitly exclude for MVP)

On-chain execution / router contract

Limit orders, RFQ, MEV protection

Real wallet connect (add later); for now, read-only quoting

Acceptance criteria

With only mocks configured, entering From: VOI, To: BUIDL, Amount: 100 returns a valid Quote and a visible route card.

Toggling “Compare routes” shows at least 3 alternative simulated routes with amounts.

Swapping token direction updates the quote and preserves UX polish (loading, errors, disabled states).

Stretch (if time remains)

Add a “copy shareable quote URL” feature (/quote?...) from the UI.

Save last selections in localStorage.

Build now.