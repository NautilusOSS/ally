'use client';

import { useState, useEffect } from 'react';
import { Quote } from '@ally/sdk';

// Mock token list - in production this would come from the SDK
const TOKENS = [
  { address: 'VOI', symbol: 'VOI', decimals: 6, name: 'Voi' },
  { address: 'USDC', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  { address: 'BUIDL', symbol: 'BUIDL', decimals: 6, name: 'BUIDL Token' },
  { address: 'WVOI', symbol: 'WVOI', decimals: 6, name: 'Wrapped Voi' },
  { address: 'ALGO', symbol: 'ALGO', decimals: 6, name: 'Algorand' },
];

export default function Home() {
  const [fromToken, setFromToken] = useState('VOI');
  const [toToken, setToToken] = useState('BUIDL');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const handleGetQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:3001/api/quote?from=${fromToken}&to=${toToken}&amount=${amount}&slippageBps=50`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get quote');
      }

      const quoteData = await response.json();
      setQuote(quoteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatRoute = (path: Quote['path']) => {
    if (path.length === 1) {
      return `${path[0].dex} Direct`;
    } else {
      const dexes = [...new Set(path.map(step => step.dex))];
      return dexes.length === 1 
        ? `${dexes[0]} Two-Hop` 
        : `Cross-DEX (${dexes.join(' → ')})`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Ally
          </h1>
          <p className="text-lg text-gray-600">
            Your trading ally on Voi
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {/* Input Card */}
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Get Quote
            </h2>
            
            <div className="space-y-4">
              {/* From Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From
                </label>
                <div className="flex gap-2">
                  <select
                    value={fromToken}
                    onChange={(e) => setFromToken(e.target.value)}
                    className="input-field flex-shrink-0 w-32"
                  >
                    {TOKENS.map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field"
                    step="0.000001"
                    min="0"
                  />
                </div>
              </div>

              {/* To Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To
                </label>
                <select
                  value={toToken}
                  onChange={(e) => setToToken(e.target.value)}
                  className="input-field"
                >
                  {TOKENS.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Get Quote Button */}
              <button
                onClick={handleGetQuote}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="btn-primary w-full"
              >
                {loading ? 'Getting Quote...' : 'Get Quote'}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="card mb-6 bg-red-50 border-red-200">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Quote Display */}
          {quote && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Best Route
              </h3>
              
              <div className="space-y-4">
                {/* Amount Out */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {parseFloat(quote.amountOut).toFixed(6)} {toToken}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    ≈ ${(parseFloat(quote.amountOut) * 0.5).toFixed(2)} USD
                  </div>
                </div>

                {/* Route Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">Route:</span>
                    <span className="text-sm font-mono bg-white px-2 py-1 rounded">
                      {formatRoute(quote.path)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">Price Impact:</span>
                    <span className={`text-sm font-medium ${
                      quote.priceImpactPct > 5 ? 'text-red-600' : 
                      quote.priceImpactPct > 2 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {quote.priceImpactPct.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Fees:</span>
                    <span className="text-sm text-gray-600">
                      {quote.feesEstimated.lpFeePct.toFixed(2)}% LP fee
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {quote.warnings && quote.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="text-yellow-800 text-sm">
                      <strong>Warnings:</strong>
                      <ul className="mt-1 list-disc list-inside">
                        {quote.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Compare Routes Button */}
                <button
                  onClick={() => setShowCompare(!showCompare)}
                  className="btn-secondary w-full"
                >
                  {showCompare ? 'Hide' : 'Compare'} Routes
                </button>

                {/* Compare Routes Table */}
                {showCompare && quote.comparedRoutes && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3">All Routes</h4>
                    <div className="space-y-2">
                      {quote.comparedRoutes.map((route, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                          <span className="text-sm font-medium text-gray-600">
                            {route.label}
                          </span>
                          <span className="text-sm font-mono text-gray-900">
                            {parseFloat(route.amountOut).toFixed(6)} {toToken}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!quote && !loading && !error && (
            <div className="card text-center">
              <p className="text-gray-500">
                Pick tokens, enter an amount, and let Ally find the best route.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
