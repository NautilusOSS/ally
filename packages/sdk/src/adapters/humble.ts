import { DexAdapter, Pool, Token } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class HumbleAdapter implements DexAdapter {
  name = 'HUMBLE' as const;
  private pools: Pool[] = [];
  private mockDataPath: string;

  constructor() {
    this.mockDataPath = path.join(__dirname, '../../mocks/humble.pools.json');
  }

  async fetchPools(tokens: Token[]): Promise<Pool[]> {
    // In production, this would fetch from HumbleSwap API
    // For MVP, we'll use mock data
    try {
      const mockData = JSON.parse(fs.readFileSync(this.mockDataPath, 'utf8'));
      this.pools = mockData;
      return this.pools;
    } catch (error) {
      console.warn('Failed to load HumbleSwap mock data:', error);
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
