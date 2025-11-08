# Ally - Voi DEX Aggregator

A simple & intuitive DEX aggregator for Voi that finds the best routes across HumbleSwap and PactFi.

## Features

- **Simple Interface**: One input, one output, best route clearly shown
- **Multi-DEX Support**: HumbleSwap, PactFi, and Swap-API (swap200 contracts) integration
- **Smart Routing**: Direct routes and two-hop routes via common intermediates
- **Price Impact Analysis**: Real-time price impact calculations
- **Route Comparison**: Compare multiple routes side-by-side
- **Swap-API Integration**: Support for ARC200 token swaps with automatic wrap/unwrap

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Fastify API server
- **SDK**: Shared types, AMM math, and DEX adapters
- **Testing**: Vitest for unit tests
- **Monorepo**: pnpm workspaces

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start development servers**:
   ```bash
   pnpm dev
   ```
   This runs:
   - API server on http://localhost:3001
   - Web app on http://localhost:3000

3. **Run tests**:
   ```bash
   pnpm test
   ```

## Project Structure

```
ally/
├── apps/
│   ├── api/                 # Fastify API server
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   └── index.ts     # Server entry point
│   │   └── package.json
│   └── web/                 # Next.js frontend
│       ├── app/             # App Router pages
│       ├── styles/          # Global styles
│       └── package.json
├── packages/
│   └── sdk/                 # Shared SDK
│       ├── src/
│       │   ├── adapters/    # DEX adapters
│       │   ├── types.ts     # TypeScript types
│       │   ├── math.ts      # AMM calculations
│       │   └── router.ts    # Routing logic
│       ├── mocks/           # Mock pool data
│       └── tokens.voi.json  # Token list
└── package.json             # Root package.json
```

## API Endpoints

### GET /api/quote

Get the best quote for a token swap.

**Parameters**:
- `from`: Source token address
- `to`: Destination token address  
- `amount`: Amount to swap
- `slippageBps`: Slippage tolerance in basis points (default: 50)
- `swapApiPoolIds`: Optional comma-separated list of swap-api pool IDs to include in routing

**Example**:
```
GET /api/quote?from=VOI&to=BUIDL&amount=100&slippageBps=50
```

**Response**:
```json
{
  "amountIn": "100",
  "amountOut": "49.925",
  "path": [
    {
      "dex": "HUMBLE",
      "from": "VOI",
      "to": "BUIDL", 
      "poolId": "humble-voi-buidl"
    }
  ],
  "priceImpactPct": 0.15,
  "feesEstimated": {
    "lpFeePct": 0.3
  },
  "routeType": "DIRECT",
  "comparedRoutes": [...],
  "timestamp": 1703123456789
}
```

### POST /api/quote/swap-api

Get a quote directly from swap-api for a specific pool.

**Request Body**:
```json
{
  "address": "4LI2Z52C3WKIPFTVMCUJ5LSYU4KLUA6JNMQAQQRI6RAVIMZWAPI52F5YKY",
  "inputToken": 395614,
  "outputToken": 390001,
  "amount": "100000",
  "poolId": "395553",
  "slippageTolerance": 0.01
}
```

**Response**: Same format as `/api/quote`

**Note**: The swap-api supports underlying ASA IDs (e.g., `302190` for USDC, `0` for VOI) and automatically handles wrapping/unwrapping to ARC200 tokens.

### GET /api/health

Health check endpoint.

## Development

### Adding New DEXes

1. Create a new adapter in `packages/sdk/src/adapters/`
2. Implement the `DexAdapter` interface
3. Add mock data in `packages/sdk/mocks/`
4. Register the adapter in `packages/sdk/src/router.ts`
5. Update types in `packages/sdk/src/types.ts` to include the new DEX name

### Swap-API Integration

The swap-api adapter integrates with the [swap-api](https://github.com/xarmian/swap-api) service which uses ulujs to interact with swap200 contracts on the Voi Network. 

**Features**:
- Supports ARC200 token swaps
- Automatic wrap/unwrap for ASA↔ARC200 conversions
- Uses AMM constant product formula for pricing
- Requires poolId to be specified (pools are not auto-discovered)

**Usage**:
- Use `GET /api/quote?swapApiPoolIds=395553,401594` to include swap-api pools in routing
- Use `POST /api/quote/swap-api` for direct swap-api quotes with a specific poolId

### Testing

Run unit tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `VOI_TOKEN_LIST`: Path to token list JSON
- `HUMBLE_INDEXER_URL`: HumbleSwap API endpoint
- `PACT_INDEXER_URL`: PactFi API endpoint
- `SWAP_API_URL`: Swap-API base URL (default: https://swap-api-iota.vercel.app)
- `API_PORT`: API server port (default: 3001)
- `WEB_PORT`: Web app port (default: 3000)

## Mock Data

The MVP includes mock pool data for development:

- **HumbleSwap**: VOI/USDC, USDC/BUIDL, VOI/BUIDL pools
- **PactFi**: VOI/USDC, USDC/BUIDL, VOI/WVOI pools

## Token List

Supported tokens (in `packages/sdk/tokens.voi.json`):
- VOI (Voi)
- USDC (USD Coin)
- BUIDL (BUIDL Token)
- WVOI (Wrapped Voi)
- ALGO (Algorand)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License
