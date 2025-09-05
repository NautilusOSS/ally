import { DexAdapter, Pool, Quote, Route, Token } from './types';
import { 
  getAmountOut, 
  getPriceImpact, 
  calculateTwoHopAmountOut, 
  calculateTwoHopPriceImpact,
  scaleAmount,
  unscaleAmount
} from './math';
import { HumbleAdapter } from './adapters/humble';
import { PactAdapter } from './adapters/pact';

export class Router {
  private adapters: DexAdapter[];
  private commonTokens: string[] = ['VOI', 'USDC']; // Common intermediate tokens for two-hop routes

  constructor() {
    this.adapters = [
      new HumbleAdapter(),
      new PactAdapter(),
    ];
  }

  async getBestQuote(
    from: string,
    to: string,
    amountIn: string,
    slippageBps: number = 50
  ): Promise<Quote> {
    const allPools: Pool[] = [];
    
    // Fetch pools from all adapters
    for (const adapter of this.adapters) {
      const pools = await adapter.fetchPools([]);
      allPools.push(...pools);
    }

    const routes: Route[] = [];

    // 1. Direct routes on each DEX
    for (const adapter of this.adapters) {
      const directRoute = await this.quoteDirect(adapter, from, to, amountIn, allPools);
      if (directRoute) {
        routes.push(directRoute);
      }
    }

    // 2. Two-hop routes via common intermediate tokens
    for (const intermediateToken of this.commonTokens) {
      if (intermediateToken === from || intermediateToken === to) continue;
      
      const twoHopRoute = await this.quoteTwoHop(from, intermediateToken, to, amountIn, allPools);
      if (twoHopRoute) {
        routes.push(twoHopRoute);
      }
    }

    // 3. Cross-DEX two-hop routes
    for (const intermediateToken of this.commonTokens) {
      if (intermediateToken === from || intermediateToken === to) continue;
      
      const crossDexRoute = await this.quoteCrossDexTwoHop(from, intermediateToken, to, amountIn, allPools);
      if (crossDexRoute) {
        routes.push(crossDexRoute);
      }
    }

    if (routes.length === 0) {
      throw new Error('No routes found');
    }

    // Find the best route (highest amount out)
    const bestRoute = routes.reduce((best, current) => 
      parseFloat(current.totalAmountOut) > parseFloat(best.totalAmountOut) ? current : best
    );

    // Create compared routes for display
    const comparedRoutes = routes.map(route => ({
      label: this.getRouteLabel(route),
      amountOut: unscaleAmount(route.totalAmountOut, 6), // Assuming 6 decimals
      routeType: route.routeType,
    }));

    return {
      amountIn,
      amountOut: unscaleAmount(bestRoute.totalAmountOut, 6),
      path: bestRoute.steps.map(step => ({
        dex: step.dex,
        from: step.from,
        to: step.to,
        poolId: step.poolId,
      })),
      priceImpactPct: bestRoute.priceImpactPct,
      feesEstimated: bestRoute.feesEstimated,
      warnings: this.generateWarnings(bestRoute),
      routeType: bestRoute.routeType,
      comparedRoutes,
      timestamp: Date.now(),
    };
  }

  private async quoteDirect(
    adapter: DexAdapter,
    from: string,
    to: string,
    amountIn: string,
    allPools: Pool[]
  ): Promise<Route | null> {
    const pools = allPools.filter(pool => pool.dex === adapter.name);
    const pool = adapter.findDirectPool(from, to, pools);
    
    if (!pool) return null;

    const scaledAmountIn = scaleAmount(amountIn, 6); // Assuming 6 decimals
    const reserves = this.getPoolReserves(pool, from);
    
    const amountOut = getAmountOut(
      scaledAmountIn,
      reserves.reserveIn,
      reserves.reserveOut,
      pool.feePct
    );

    const priceImpact = getPriceImpact(
      scaledAmountIn,
      reserves.reserveIn,
      reserves.reserveOut,
      pool.feePct
    );

    return {
      steps: [{
        dex: adapter.name,
        from,
        to,
        poolId: pool.id,
        amountIn: scaledAmountIn,
        amountOut,
      }],
      totalAmountOut: amountOut,
      priceImpactPct: priceImpact,
      feesEstimated: {
        lpFeePct: pool.feePct,
      },
      routeType: 'DIRECT',
    };
  }

  private async quoteTwoHop(
    from: string,
    intermediate: string,
    to: string,
    amountIn: string,
    allPools: Pool[]
  ): Promise<Route | null> {
    // Find pools for both hops on the same DEX
    for (const adapter of this.adapters) {
      const pools = allPools.filter(pool => pool.dex === adapter.name);
      
      const firstPool = adapter.findDirectPool(from, intermediate, pools);
      const secondPool = adapter.findDirectPool(intermediate, to, pools);
      
      if (!firstPool || !secondPool) continue;

      const scaledAmountIn = scaleAmount(amountIn, 6);
      const firstReserves = this.getPoolReserves(firstPool, from);
      const secondReserves = this.getPoolReserves(secondPool, intermediate);

      const firstHopOut = getAmountOut(
        scaledAmountIn,
        firstReserves.reserveIn,
        firstReserves.reserveOut,
        firstPool.feePct
      );

      const secondHopOut = getAmountOut(
        firstHopOut,
        secondReserves.reserveIn,
        secondReserves.reserveOut,
        secondPool.feePct
      );

      const priceImpact = calculateTwoHopPriceImpact(
        scaledAmountIn,
        {
          reserveIn: firstReserves.reserveIn,
          reserveOut: firstReserves.reserveOut,
          feePct: firstPool.feePct,
        },
        {
          reserveIn: secondReserves.reserveIn,
          reserveOut: secondReserves.reserveOut,
          feePct: secondPool.feePct,
        }
      );

      return {
        steps: [
          {
            dex: adapter.name,
            from,
            to: intermediate,
            poolId: firstPool.id,
            amountIn: scaledAmountIn,
            amountOut: firstHopOut,
          },
          {
            dex: adapter.name,
            from: intermediate,
            to,
            poolId: secondPool.id,
            amountIn: firstHopOut,
            amountOut: secondHopOut,
          },
        ],
        totalAmountOut: secondHopOut,
        priceImpactPct: priceImpact,
        feesEstimated: {
          lpFeePct: (firstPool.feePct + secondPool.feePct) / 2,
        },
        routeType: 'TWO_HOP',
      };
    }

    return null;
  }

  private async quoteCrossDexTwoHop(
    from: string,
    intermediate: string,
    to: string,
    amountIn: string,
    allPools: Pool[]
  ): Promise<Route | null> {
    // Try all combinations of DEXes for two-hop routes
    for (let i = 0; i < this.adapters.length; i++) {
      for (let j = 0; j < this.adapters.length; j++) {
        if (i === j) continue; // Skip same DEX combinations

        const firstAdapter = this.adapters[i];
        const secondAdapter = this.adapters[j];
        
        const firstPools = allPools.filter(pool => pool.dex === firstAdapter.name);
        const secondPools = allPools.filter(pool => pool.dex === secondAdapter.name);
        
        const firstPool = firstAdapter.findDirectPool(from, intermediate, firstPools);
        const secondPool = secondAdapter.findDirectPool(intermediate, to, secondPools);
        
        if (!firstPool || !secondPool) continue;

        const scaledAmountIn = scaleAmount(amountIn, 6);
        const firstReserves = this.getPoolReserves(firstPool, from);
        const secondReserves = this.getPoolReserves(secondPool, intermediate);

        const firstHopOut = getAmountOut(
          scaledAmountIn,
          firstReserves.reserveIn,
          firstReserves.reserveOut,
          firstPool.feePct
        );

        const secondHopOut = getAmountOut(
          firstHopOut,
          secondReserves.reserveIn,
          secondReserves.reserveOut,
          secondPool.feePct
        );

        const priceImpact = calculateTwoHopPriceImpact(
          scaledAmountIn,
          {
            reserveIn: firstReserves.reserveIn,
            reserveOut: firstReserves.reserveOut,
            feePct: firstPool.feePct,
          },
          {
            reserveIn: secondReserves.reserveIn,
            reserveOut: secondReserves.reserveOut,
            feePct: secondPool.feePct,
          }
        );

        return {
          steps: [
            {
              dex: firstAdapter.name,
              from,
              to: intermediate,
              poolId: firstPool.id,
              amountIn: scaledAmountIn,
              amountOut: firstHopOut,
            },
            {
              dex: secondAdapter.name,
              from: intermediate,
              to,
              poolId: secondPool.id,
              amountIn: firstHopOut,
              amountOut: secondHopOut,
            },
          ],
          totalAmountOut: secondHopOut,
          priceImpactPct: priceImpact,
          feesEstimated: {
            lpFeePct: (firstPool.feePct + secondPool.feePct) / 2,
          },
          routeType: 'TWO_HOP',
        };
      }
    }

    return null;
  }

  private getPoolReserves(pool: Pool, tokenIn: string): { reserveIn: string; reserveOut: string } {
    const isTokenA = pool.tokenA.address === tokenIn;
    return {
      reserveIn: isTokenA ? pool.reserveA : pool.reserveB,
      reserveOut: isTokenA ? pool.reserveB : pool.reserveA,
    };
  }

  private getRouteLabel(route: Route): string {
    if (route.routeType === 'DIRECT') {
      return `${route.steps[0].dex} Direct`;
    } else {
      const dexes = [...new Set(route.steps.map(step => step.dex))];
      if (dexes.length === 1) {
        return `${dexes[0]} Two-Hop`;
      } else {
        return `Cross-DEX (${dexes.join(' → ')})`;
      }
    }
  }

  private generateWarnings(route: Route): string[] {
    const warnings: string[] = [];
    
    if (route.priceImpactPct > 5) {
      warnings.push('High price impact detected');
    }
    
    if (route.steps.length > 1) {
      warnings.push('Multi-hop route may have higher slippage');
    }
    
    return warnings;
  }
}
