import Big from 'big.js';

// Configure Big.js for financial calculations
Big.DP = 18; // Decimal places
Big.RM = Big.roundHalfUp; // Rounding mode

export function scaleAmount(amount: string, decimals: number): string {
  const bigAmount = new Big(amount);
  const scaleFactor = new Big(10).pow(decimals);
  return bigAmount.mul(scaleFactor).toFixed(0);
}

export function unscaleAmount(amount: string, decimals: number): string {
  const bigAmount = new Big(amount);
  const scaleFactor = new Big(10).pow(decimals);
  return bigAmount.div(scaleFactor).toFixed();
}

export function getAmountOut(
  amountIn: string,
  reserveIn: string,
  reserveOut: string,
  feePct: number = 0.3
): string {
  const amountInBig = new Big(amountIn);
  const reserveInBig = new Big(reserveIn);
  const reserveOutBig = new Big(reserveOut);

  // Apply fee (0.3% = 997/1000)
  const feeMultiplier = new Big(1000 - feePct * 10).div(1000);
  const amountInWithFee = amountInBig.mul(feeMultiplier);

  // Constant product formula: (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
  const numerator = amountInWithFee.mul(reserveOutBig);
  const denominator = reserveInBig.mul(1000).add(amountInWithFee);

  return numerator.div(denominator).toFixed(0);
}

export function getPriceImpact(
  amountIn: string,
  reserveIn: string,
  reserveOut: string,
  feePct: number = 0.3
): number {
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, feePct);
  
  // Calculate mid price (reserveOut / reserveIn)
  const midPrice = new Big(reserveOut).div(reserveIn);
  
  // Calculate actual price (amountOut / amountIn)
  const actualPrice = new Big(amountOut).div(amountIn);
  
  // Price impact = (midPrice - actualPrice) / midPrice
  const priceImpact = midPrice.sub(actualPrice).div(midPrice);
  
  return priceImpact.mul(100).toNumber(); // Convert to percentage
}

export function applySlippage(amountOut: string, slippageBps: number): string {
  const amountOutBig = new Big(amountOut);
  const slippageMultiplier = new Big(10000 - slippageBps).div(10000);
  return amountOutBig.mul(slippageMultiplier).toFixed(0);
}

export function calculateTwoHopAmountOut(
  amountIn: string,
  firstHop: {
    reserveIn: string;
    reserveOut: string;
    feePct: number;
  },
  secondHop: {
    reserveIn: string;
    reserveOut: string;
    feePct: number;
  }
): string {
  // First hop
  const firstHopOut = getAmountOut(
    amountIn,
    firstHop.reserveIn,
    firstHop.reserveOut,
    firstHop.feePct
  );

  // Second hop using first hop output as input
  const secondHopOut = getAmountOut(
    firstHopOut,
    secondHop.reserveIn,
    secondHop.reserveOut,
    secondHop.feePct
  );

  return secondHopOut;
}

export function calculateTwoHopPriceImpact(
  amountIn: string,
  firstHop: {
    reserveIn: string;
    reserveOut: string;
    feePct: number;
  },
  secondHop: {
    reserveIn: string;
    reserveOut: string;
    feePct: number;
  }
): number {
  const amountOut = calculateTwoHopAmountOut(amountIn, firstHop, secondHop);
  
  // Calculate effective mid price through both hops
  const firstHopMidPrice = new Big(firstHop.reserveOut).div(firstHop.reserveIn);
  const secondHopMidPrice = new Big(secondHop.reserveOut).div(secondHop.reserveIn);
  const effectiveMidPrice = firstHopMidPrice.mul(secondHopMidPrice);
  
  // Calculate actual price
  const actualPrice = new Big(amountOut).div(amountIn);
  
  // Price impact
  const priceImpact = effectiveMidPrice.sub(actualPrice).div(effectiveMidPrice);
  
  return priceImpact.mul(100).toNumber();
}
