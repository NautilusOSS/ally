import { describe, it, expect, beforeEach } from 'vitest';
import { Router } from './router';
import { Pool } from './types';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe('getBestQuote', () => {
    it('should find direct route when available', async () => {
      // Mock the adapters to return known pools
      const mockPools: Pool[] = [
        {
          id: 'test-pool',
          dex: 'HUMBLE',
          tokenA: { address: 'VOI', symbol: 'VOI', decimals: 6, name: 'Voi' },
          tokenB: { address: 'USDC', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
          reserveA: '1000000000000',
          reserveB: '500000000000',
          feePct: 0.3,
        },
      ];

      // Mock the fetchPools method
      const mockAdapter = {
        name: 'HUMBLE' as const,
        fetchPools: async () => mockPools,
        findDirectPool: (from: string, to: string, pools: Pool[]) => {
          return pools.find(pool => 
            (pool.tokenA.address === from && pool.tokenB.address === to) ||
            (pool.tokenA.address === to && pool.tokenB.address === from)
          ) || null;
        },
      };

      // Replace the adapters with our mock
      (router as any).adapters = [mockAdapter];

      const quote = await router.getBestQuote('VOI', 'USDC', '100', 50);

      expect(quote).toBeDefined();
      expect(quote.routeType).toBe('DIRECT');
      expect(quote.path).toHaveLength(1);
      expect(quote.path[0].dex).toBe('HUMBLE');
      expect(quote.path[0].from).toBe('VOI');
      expect(quote.path[0].to).toBe('USDC');
    });

    it('should throw error when no routes found', async () => {
      // Mock empty pools
      const mockAdapter = {
        name: 'HUMBLE' as const,
        fetchPools: async () => [],
        findDirectPool: () => null,
      };

      (router as any).adapters = [mockAdapter];

      await expect(router.getBestQuote('VOI', 'NONEXISTENT', '100', 50))
        .rejects.toThrow('No routes found');
    });
  });
});
