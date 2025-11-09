# Ally - Voi DEX Aggregator

A simple & intuitive DEX aggregator for Voi that finds the best routes across HumbleSwap and nomadex.

## Features

- **Simple Interface**: One input, one output, best route clearly shown
- **Multi-DEX Support**: HumbleSwap, nomadex, and Swap-API (swap200 contracts) integration
- **Smart Routing**: Direct routes and two-hop routes via common intermediates
- **Price Impact Analysis**: Real-time price impact calculations
- **Route Comparison**: Compare multiple routes side-by-side
- **Swap-API Integration**: Support for ARC200 token swaps with automatic wrap/unwrap

## Tech Stack

- **Frontend**: Vite + React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Wallet Integration**: @txnlab/use-wallet-react for Algorand/Voi wallet connections
  - Supports Pera, Defly, Lute, and other Algorand wallets via WalletConnect
- **Build Tool**: Vite
- **Package Manager**: npm
- **Deployment**: AWS Amplify
- **Version Management**: Automated version tracking with prebuild scripts

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   This runs the web app on http://localhost:3999

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Preview production build**:
   ```bash
   npm run preview
   ```

## Project Structure

```
ally/
├── src/
│   ├── components/          # React components
│   │   ├── SwapInterface.tsx
│   │   ├── VersionDisplay.tsx
│   │   └── WalletConnectModal.tsx
│   ├── lib/
│   │   └── config.ts        # Configuration loading utilities
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
├── public/
│   └── config/              # Configuration files (JSON)
│       ├── api.json         # API endpoints configuration
│       ├── app.json         # App settings
│       ├── pools.json       # DEX pool configurations
│       └── tokens.json      # Token list
├── config/                  # Source config files (copied to public/)
│   └── README.md            # Configuration documentation
├── scripts/                 # Build and utility scripts
│   ├── setup-version-management.sh
│   └── update-version.cjs
├── docs/                    # Documentation
│   └── PROMPT.md            # Development prompt
├── dist/                    # Production build output
├── vite.config.ts           # Vite configuration
├── tailwind.config.cjs      # Tailwind CSS configuration
├── amplify.yml              # AWS Amplify deployment config
└── package.json
```

## Configuration

The app is configuration-driven using JSON files in the `public/config/` directory:

- **`api.json`**: API endpoint configurations for external services
- **`app.json`**: Application settings including token whitelists
- **`pools.json`**: DEX pool configurations for HumbleSwap and nomadex
- **`tokens.json`**: Token metadata including addresses, symbols, and decimals

These files are loaded at runtime and can be updated without rebuilding the application.

## Development

### Wallet Integration

The app uses `@txnlab/use-wallet-react` for wallet connections. Supports:
- **Pera Wallet**: Algorand wallet integration
- **Defly Wallet**: Mobile-first Algorand wallet
- **Lute Wallet**: Primary wallet integration via WalletConnect
- **Other Algorand wallets**: Via WalletConnect protocol

The app is configured for the Voi mainnet network.

### Version Management

The project includes automated version management:
- Version is displayed in the UI via the `VersionDisplay` component
- Version is automatically incremented (patch version) before each build via `prebuild` script
- Version is stored in `package.json` and exposed via `VITE_APP_VERSION` environment variable
- Setup script available: `npm run setup-version`

### Adding New Tokens

1. Add token metadata to `config/tokens.json`
2. Ensure the token is included in pool configurations in `config/pools.json`
3. Optionally add to token whitelist in `config/app.json` if using whitelisting

### Configuration Updates

Configuration files in `config/` are copied to `public/config/` during build. For development, you can edit files directly in `public/config/` to see changes immediately.

### Code Quality

Run linting:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

Type checking:
```bash
npm run type-check
```

## DEX Integration

The app integrates with multiple DEXes on the Voi network:

- **HumbleSwap**: Supports wrapped token pools with automatic wrap/unwrap
- **nomadex**: Direct token pair pools
- **Swap-API**: ARC200 token swaps via swap200 contracts

Pool configurations are defined in `config/pools.json` and can be updated without code changes.

## Features Implemented

- ✅ On-chain execution: Full swap execution via wallet integration
- ✅ Wallet connect: Real wallet integration with multiple wallet support
- ✅ Pool selection: Users can select specific pools
- ✅ Swap-API integration: Leverages external routing service
- ✅ Multi-DEX support: HumbleSwap, Nomadex, and swap200 contracts
- ✅ ARC200 support: Automatic wrap/unwrap handling
- ✅ Expandable route cards: Collapsible cards showing detailed pool breakdown
- ✅ Route comparison: Side-by-side comparison of available routes
- ✅ Version display: Shows app version in UI
- ✅ Automated version management: Patch version auto-increments on build

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License
