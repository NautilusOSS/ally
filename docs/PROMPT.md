Cursor Prompt — Build Ally, a simple & intuitive DEX aggregator for Voi

You are an expert TypeScript full-stack engineer.
Create a minimal, production-ready MVP called Ally (Voi DEX Aggregator).

Goals

Simple & intuitive: one input, one output, best route clearly shown.

MVP: off-chain quoting with on-chain execution support via wallet integration.

DEX coverage: HumbleSwap, nomadex, and Swap-API (swap200 contracts) integration.

Routing: leverages Swap-API service for best route discovery across DEXes, supporting direct and multi-hop routes.

Standards: ARC-200 token metadata (symbol, decimals) handled cleanly. Supports both ASA and ARC200 tokens with automatic wrap/unwrap.

Tech

Single-page application with Vite + React:

Frontend: Vite + React + TypeScript (not Next.js).

No separate API server: calls Swap-API service directly from frontend.

Config-based architecture: JSON config files in `/config` directory for tokens, pools, API endpoints, and app settings.

Wallet integration: @txnlab/use-wallet-react for Algorand wallet connections (Pera, Defly, Lute, etc.).

Styling: Tailwind CSS.

Lint/format: ESLint + Prettier.

Build: Vite for fast development and optimized production builds.

UX (keep it extremely simple)

Title: Ally — your trading ally on Voi.

Inputs:

“From” token (select), amount

“To” token (select)
[Get Quote] button

Output card shows:

Best amount out

Route (e.g., HumbleSwap direct, or nomadex: VOI→USDC→BUIDL)

Estimated price impact and route breakdown

Button to show/hide route breakdown: "Show Routes" / "Hide Routes"

Empty state copy: “Pick tokens, enter an amount, and let Ally find the best route.”

Data assumptions

Token list: JSON config file at `/config/tokens.json` with token metadata (tokenId, symbol, decimals, name).

Pool configuration: JSON config file at `/config/pools.json` defining available pools for HumbleSwap and Nomadex.

API configuration: JSON config file at `/config/api.json` defining Swap-API endpoints and settings.

App configuration: JSON config file at `/config/app.json` defining UI defaults, routing settings, and DEX configurations.

Swap-API Integration

The app uses the Swap-API service (https://swap-api-iota.vercel.app) for routing and quotes:

POST /quote endpoint accepts:
- inputToken: token ID (number)
- outputToken: token ID (number)
- amount: amount in base units (string)
- poolId: optional pool ID (string) - if omitted, auto-discovers best pool
- address: optional wallet address (string) - if provided, returns unsigned transactions
- slippageTolerance: slippage tolerance (number, default 0.01)

Returns:
- quote: { inputAmount, outputAmount, rate, priceImpact }
- route: { pools: Array<{dex, poolId, inputAmount, outputAmount}> }
- poolId: selected pool ID
- unsignedTransactions: base64-encoded transactions (if address provided)

Quote Format (converted from Swap-API response):

type Quote = {
  amountIn: string; // normalized decimal string
  amountOut: string;
  path: Array<{ dex: 'HUMBLE'|'NOMADEX'|'SWAP_API'; from: string; to: string; poolId: string }>;
  priceImpactPct: number;
  feesEstimated: { lpFeePct: number; protocolFeePct?: number };
  warnings?: string[];
  routeType: 'DIRECT' | 'TWO_HOP';
  comparedRoutes: Array<{label:string; amountOut:string; routeType:string}>;
  timestamp: number;
  swapApiData?: {
    rate: number;
    poolId: string;
    route: any;
  };
}

Handle token decimals correctly; convert between display units and base units (10^decimals).

Implementation Details

Frontend Structure (src/):

App.tsx: Main app component that:
- Loads configs from `/config` directory (tokens, pools, API, app)
- Manages wallet connection state
- Handles token selection and pool filtering
- Renders SwapInterface and WalletConnectModal

components/SwapInterface.tsx: Main swap UI component that:
- Displays token selectors and amount input
- Shows available pools (optional pool selection)
- Calls Swap-API /quote endpoint
- Displays quote results with route breakdown
- Expandable route cards showing detailed pool information (DEX, pool ID, input/output amounts)
- Handles wallet connection and swap execution
- Shows route comparison table

components/WalletConnectModal.tsx: Modal for wallet selection and connection

lib/config.ts: Config loader utilities:
- loadTokensConfig(): Promise<TokenConfig[]>
- loadPoolsConfig(): Promise<PoolConfig[]>
- loadApiConfig(): Promise<ApiConfig>
- loadAppConfig(): Promise<AppConfig>

Config Files (config/):

tokens.json: Token metadata (tokenId, symbol, decimals, name)
pools.json: Pool configurations (poolId, dex, tokens, fee)
api.json: API endpoint configurations (Swap-API, Voi API, local API)
app.json: App settings (UI defaults, routing config, DEX settings)

Features:

Token selection: Dropdowns populated from tokens.json, filtered by available pools or whitelist
Pool selection: Optional pool selector when multiple pools available for token pair
Quote fetching: Direct POST to Swap-API /quote endpoint
Route display: Shows DEX name, pool ID, exchange rate, price impact
Swap execution: Signs and submits unsigned transactions via wallet
Wallet integration: Supports Pera, Defly, Lute, and other Algorand wallets via @txnlab/use-wallet-react

File tree (actual structure)
ally/
  src/
    App.tsx                    # Main app component
    main.tsx                    # React entry point
    index.css                   # Global styles
    components/
      SwapInterface.tsx         # Main swap UI
      WalletConnectModal.tsx    # Wallet connection modal
    lib/
      config.ts                 # Config loader utilities
  config/
    tokens.json                 # Token metadata
    pools.json                  # Pool configurations
    api.json                    # API endpoint configs
    app.json                    # App settings
    README.md                   # Config documentation
  public/
    config/                     # Config files (copied to dist)
      tokens.json
      pools.json
      api.json
      app.json
    _redirects                  # Netlify/Amplify redirects
  dist/                         # Build output
  package.json                  # Dependencies and scripts
  vite.config.ts                # Vite configuration
  tsconfig.json                 # TypeScript config
  tailwind.config.cjs          # Tailwind CSS config
  postcss.config.cjs            # PostCSS config
  .eslintrc.cjs                 # ESLint config
  .prettierrc                   # Prettier config
  amplify.yml                   # AWS Amplify deployment config
  README.md                     # Project documentation

Core logic specs

Routing: Handled by Swap-API service, which:
- Discovers pools across HumbleSwap, Nomadex, and swap200 contracts
- Finds best routes (direct or multi-hop)
- Handles ARC200 token wrapping/unwrapping automatically
- Returns unsigned transactions for execution

Token handling:
- Supports both ASA (Algorand Standard Assets) and ARC200 tokens
- Uses token IDs (numbers) for identification
- Converts between display units and base units (10^decimals)
- Swap-API automatically handles wrap/unwrap for ASA↔ARC200 conversions

Pool selection:
- Users can optionally select a specific pool
- If no pool selected, Swap-API auto-discovers best route
- Pool configs in pools.json define available pools for UI display

Swap execution:
- Receives unsigned transactions from Swap-API (base64 encoded)
- Decodes transactions and signs via wallet
- Submits signed transactions as atomic group
- Waits for confirmation before showing success

Config system:
- All configuration in JSON files under `/config`
- Loaded at runtime via fetch API
- Supports token whitelisting via app.json
- Pool filtering based on available tokens

Commands

npm install (or pnpm install)

npm run dev (runs Vite dev server on port 3999)

npm run build (builds for production to dist/)

npm run preview (preview production build)

npm run lint (run ESLint)

npm run format (format with Prettier)

npm run type-check (TypeScript type checking)

Features Implemented (beyond original MVP scope)

✅ On-chain execution: Full swap execution via wallet integration
✅ Wallet connect: Real wallet integration with @txnlab/use-wallet-react
✅ Pool selection: Users can select specific pools
✅ Swap-API integration: Leverages external routing service
✅ Multi-DEX support: HumbleSwap, Nomadex, and swap200 contracts
✅ ARC200 support: Automatic wrap/unwrap handling
✅ Expandable route cards: Collapsible cards showing detailed pool breakdown (DEX, pool ID, input/output amounts) with visual expand/collapse indicators

Non-goals (explicitly exclude)

Limit orders, RFQ, MEV protection

Custom routing algorithm (uses Swap-API instead)

Separate API server (calls Swap-API directly from frontend)

Acceptance criteria

✅ With Swap-API configured, entering From: VOI, To: USDC, Amount: 100 returns a valid Quote and a visible route card.

✅ Route display shows DEX name, pool ID, exchange rate, and price impact.

✅ Pool selection dropdown appears when multiple pools are available.

✅ Wallet connection works with Pera, Defly, Lute, and other Algorand wallets.

✅ Swap execution signs and submits transactions successfully.

✅ Swapping token direction updates the quote and preserves UX polish (loading, errors, disabled states).

✅ Config files are loaded from `/config` directory at runtime.

✅ Token list is filtered by available pools or whitelist configuration.

Current Implementation Status

✅ Single-page React app with Vite
✅ Swap-API integration for routing
✅ Wallet connection and swap execution
✅ Config-based architecture
✅ Pool selection UI
✅ Route display with breakdown
✅ Expandable route cards with detailed pool information
✅ Price impact warnings
✅ Error handling and loading states

Future Enhancements (stretch goals)

Add a "copy shareable quote URL" feature from the UI.

Save last selections in localStorage.

Enhance route comparison table (currently shows basic comparedRoutes, could be expanded with more detailt s).

Add transaction history tracking.

Add price charts and analytics.

---

## Incremental Update Tracking

**Last Commit Processed:** `359c3ac0e48321e633193a0a10bf5e8d9613d4dd`

**Commit Details:**
- **Author:** RedDev677067
- **Date:** Sat Nov 8 11:04:43 2025 -0700
- **Message:** feat(swap): enhance route breakdown with expandable cards
- **Description:**
  - Add expandable route cards with detailed pool information
  - Calculate exchange rate from display amounts for accuracy
  - Improve route breakdown UI with collapsible cards showing:
    - Pool ID, DEX, input/output amounts
    - Visual indicators for expanded/collapsed state
  - Reset expanded cards when fetching new quotes
  - Fix null checks for swapApiData properties
  - Update button text from "Compare Routes" to "Show Routes"
  - Support both swapApiData route pools and comparedRoutes display

*Note: When processing incremental updates, start from this commit and work forward through the git history.*