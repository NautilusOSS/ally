// Config loader utilities

export interface TokenConfig {
  tokenId: string;
  symbol: string;
  decimals: number;
  name: string;
  address?: string; // For backward compatibility
  type?: string;
}

export interface TokensConfig {
  tokens: {
    [tokenId: string]: {
      symbol: string;
      name: string;
      decimals: number;
    };
  };
}

export interface ApiConfig {
  endpoints: {
    swapApi: {
      baseUrl: string;
      timeout: number;
      endpoints: {
        quote: string;
        pool: string;
        health: string;
      };
    };
    voiApi: {
      baseUrl: string;
      endpoints: {
        pools: string;
      };
    };
    localApi: {
      baseUrl: string;
      endpoints: {
        quote: string;
        swapApiQuote: string;
        health: string;
      };
    };
  };
  cache: {
    poolCacheDuration: number;
    enabled: boolean;
  };
}

export interface AppConfig {
  app: {
    name: string;
    description: string;
    version: string;
  };
  ui: {
    defaultSlippageTolerance: number;
    slippageToleranceOptions: number[];
    priceImpactWarningThreshold: number;
    priceImpactDangerThreshold: number;
    defaultAmountDecimals: number;
  };
  routing: {
    commonIntermediateTokens: string[];
    maxHops: number;
    enableCrossDexRouting: boolean;
  };
  dexes: {
    [key: string]: {
      name: string;
      displayName: string;
      feePct: number;
      enabled: boolean;
      autoDiscoverPools?: boolean;
    };
  };
  tokenWhitelist?: string[]; // Optional: Array of token IDs or symbols to whitelist
}

export interface PoolConfig {
  poolId: number;
  dex: string;
  name: string;
  tokens: {
    underlyingToWrapped?: { [key: string]: number };
    wrappedPair?: { tokA: number; tokB: number };
    unwrap?: number[];
    tokA?: { id: number; type: string };
    tokB?: { id: number; type: string };
  };
  slippageDefault: number;
  fee: number;
}

export interface PoolsConfig {
  pools: PoolConfig[];
}

// Load config from JSON files
export async function loadTokensConfig(): Promise<TokenConfig[]> {
  try {
    const response = await fetch('/config/tokens.json');
    const data: TokensConfig = await response.json();
    
    // Convert object format to array format
    const tokensArray: TokenConfig[] = Object.entries(data.tokens || {}).map(([tokenId, token]) => ({
      tokenId,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      address: token.symbol, // Use symbol as address for backward compatibility
    }));
    
    return tokensArray;
  } catch (error) {
    console.error('Failed to load tokens config:', error);
    // Return default tokens as fallback
    return [
      { tokenId: '0', symbol: 'VOI', decimals: 6, name: 'Voi', address: 'VOI', type: 'native' },
      { tokenId: '302190', symbol: 'USDC', decimals: 6, name: 'USD Coin', address: 'USDC', type: 'ASA' },
    ];
  }
}

export async function loadApiConfig(): Promise<ApiConfig> {
  try {
    const response = await fetch('/config/api.json');
    return await response.json();
  } catch (error) {
    console.error('Failed to load API config:', error);
    throw error;
  }
}

export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const response = await fetch('/config/app.json');
    return await response.json();
  } catch (error) {
    console.error('Failed to load app config:', error);
    throw error;
  }
}

export async function loadPoolsConfig(): Promise<PoolConfig[]> {
  try {
    const response = await fetch('/config/pools.json');
    const data: PoolsConfig = await response.json();
    return data.pools || [];
  } catch (error) {
    console.error('Failed to load pools config:', error);
    return [];
  }
}

