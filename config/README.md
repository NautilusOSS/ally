# Configuration Files

This directory contains JSON configuration files for the Ally DEX aggregator.

## Files

### `tokens.json`
Token configuration including token IDs, decimals, and metadata.
- Used by the frontend to populate token selectors
- Contains swap-api token IDs for routing

### `api.json`
API endpoint configuration.
- Defines base URLs and endpoints for:
  - Swap API (swap-api-iota.vercel.app)
  - VOI API (pool data)
  - Local API (development)
- Cache settings

### `app.json`
Application configuration.
- UI defaults (slippage tolerance, price impact thresholds)
- Routing settings (intermediate tokens, max hops)
- DEX configurations (fees, display names)

### `pools.json`
Known pool configurations.
- Pool IDs and metadata
- Token mappings for pools
- Pool discovery settings

## Usage

### Frontend
Config files are served from `/public/config/` and loaded at runtime:

```typescript
import { 
  loadTokensConfig, 
  loadApiConfig, 
  loadAppConfig, 
  loadPoolsConfig 
} from '../lib/config';

const tokens = await loadTokensConfig();
const pools = await loadPoolsConfig();
const apiConfig = await loadApiConfig();
const appConfig = await loadAppConfig();
```

### Backend
Config files can be imported directly in Node.js:

```typescript
import tokensConfig from '../config/tokens.json';
import apiConfig from '../config/api.json';
```

## Adding New Tokens

1. Add token entry to `config/tokens.json`
2. Include `tokenId` for swap-api integration
3. Copy updated file to `public/config/tokens.json` (or it will be copied automatically during build)

## Environment-Specific Configs

For different environments (dev, staging, prod), you can:
- Use environment variables to override config values
- Create environment-specific config files (e.g., `api.prod.json`)
- Use a config loader that merges base config with environment overrides

