import { DexAdapter, Pool, Token } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class PactAdapter implements DexAdapter {
  name = 'PACT' as const;
  private pools: Pool[] = [];
  private mockDataPath: string;

  constructor() {
    this.mockDataPath = path.join(__dirname, '../../mocks/pact.pools.json');
  }

  async fetchPools(tokens: Token[]): Promise<Pool[]> {
    // In production, this would fetch from PactFi API
    // For MVP, we'll use mock data
    try {
      const mockData = JSON.parse(fs.readFileSync(this.mockDataPath, 'utf8'));
      this.pools = mockData;
      return this.pools;
    } catch (error) {
      console.warn('Failed to load PactFi mock data:', error);
      return [];
    }
  }

  findDirectPool(from: string, to: string, pools: Pool[]): Pool | null {
    return pools.find(pool => 
      (pool.tokenA.address === from && pool.tokenB.address === to) ||
      (pool.tokenA.address === to && pool.tokenB.address === from)
    ) || null;
  }

  getPoolReserves(pool: Pool, tokenIn: string): { reserveIn: string; reserveOut: string } {
    const isTokenA = pool.tokenA.address === tokenIn;
    return {
      reserveIn: isTokenA ? pool.reserveA : pool.reserveB,
      reserveOut: isTokenA ? pool.reserveB : pool.reserveA,
    };
  }
}
