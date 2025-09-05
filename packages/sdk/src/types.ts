export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export interface Pool {
  id: string;
  dex: 'HUMBLE' | 'PACT';
  tokenA: Token;
  tokenB: Token;
  reserveA: string; // BigInt string
  reserveB: string; // BigInt string
  feePct: number; // e.g., 0.3 for 0.3%
}

export interface Quote {
  amountIn: string; // normalized decimal string
  amountOut: string;
  path: Array<{
    dex: 'HUMBLE' | 'PACT';
    from: string;
    to: string;
    poolId: string;
  }>;
  priceImpactPct: number;
  feesEstimated: {
    lpFeePct: number;
    protocolFeePct?: number;
  };
  warnings?: string[];
  routeType: 'DIRECT' | 'TWO_HOP';
  comparedRoutes: Array<{
    label: string;
    amountOut: string;
    routeType: string;
  }>;
  timestamp: number;
}

export interface DexAdapter {
  name: 'HUMBLE' | 'PACT';
  fetchPools(tokens: Token[]): Promise<Pool[]>;
  findDirectPool(from: string, to: string, pools: Pool[]): Pool | null;
}

export interface RouteStep {
  dex: 'HUMBLE' | 'PACT';
  from: string;
  to: string;
  poolId: string;
  amountIn: string;
  amountOut: string;
}

export interface Route {
  steps: RouteStep[];
  totalAmountOut: string;
  priceImpactPct: number;
  feesEstimated: {
    lpFeePct: number;
    protocolFeePct?: number;
  };
  routeType: 'DIRECT' | 'TWO_HOP';
}
