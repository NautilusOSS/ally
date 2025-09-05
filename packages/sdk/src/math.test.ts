import { describe, it, expect } from 'vitest';
import { getAmountOut, getPriceImpact, scaleAmount, unscaleAmount } from './math';

describe('AMM Math', () => {
  describe('getAmountOut', () => {
    it('should calculate correct amount out for simple swap', () => {
      const amountIn = '1000000'; // 1 token with 6 decimals
      const reserveIn = '1000000000000'; // 1M tokens
      const reserveOut = '500000000000'; // 500K tokens
      
      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, 0.3);
      
      // Should be approximately 499.25 tokens (accounting for 0.3% fee)
      expect(parseFloat(amountOut)).toBeCloseTo(499250000, -3);
    });

    it('should handle zero amount in', () => {
      const amountOut = getAmountOut('0', '1000000000000', '500000000000', 0.3);
      expect(amountOut).toBe('0');
    });
  });

  describe('getPriceImpact', () => {
    it('should calculate price impact correctly', () => {
      const amountIn = '1000000';
      const reserveIn = '1000000000000';
      const reserveOut = '500000000000';
      
      const priceImpact = getPriceImpact(amountIn, reserveIn, reserveOut, 0.3);
      
      // Should be a small positive percentage
      expect(priceImpact).toBeGreaterThan(0);
      expect(priceImpact).toBeLessThan(1);
    });
  });

  describe('scaleAmount', () => {
    it('should scale amount correctly', () => {
      const scaled = scaleAmount('1.5', 6);
      expect(scaled).toBe('1500000');
    });

    it('should handle zero', () => {
      const scaled = scaleAmount('0', 6);
      expect(scaled).toBe('0');
    });
  });

  describe('unscaleAmount', () => {
    it('should unscale amount correctly', () => {
      const unscaled = unscaleAmount('1500000', 6);
      expect(unscaled).toBe('1.5');
    });

    it('should handle zero', () => {
      const unscaled = unscaleAmount('0', 6);
      expect(unscaled).toBe('0');
    });
  });
});
