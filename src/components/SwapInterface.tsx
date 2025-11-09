import { useState, useEffect, useMemo, useRef } from 'react';
import type {
  TokenConfig,
  PoolConfig,
  ApiConfig,
  AppConfig,
} from '../lib/config';
import { useWallet, WalletId } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import VersionDisplay from './VersionDisplay';

interface SwapInterfaceProps {
  // Token selection
  tokens: TokenConfig[];
  fromToken: string;
  toToken: string;
  fromTokenInfo: TokenConfig | null;
  toTokenInfo: TokenConfig | null;
  onFromTokenChange: (tokenId: string) => void;
  onToTokenChange: (tokenId: string) => void;
  onSwapTokens: () => void;

  // Amount input
  amount: string;
  onAmountChange: (amount: string) => void;

  // Pool selection
  availablePools: PoolConfig[];
  selectedPoolId: number | null;
  onPoolChange: (poolId: number | null) => void;

  // Configs
  apiConfig: ApiConfig | null;
  appConfig: AppConfig | null;

  // Route comparison
  showCompare: boolean;
  onToggleCompare: () => void;

  // Wallet & Swap
  walletAddress: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
}

export default function SwapInterface({
  tokens,
  fromToken,
  toToken,
  fromTokenInfo,
  toTokenInfo,
  onFromTokenChange,
  onToTokenChange,
  onSwapTokens,
  amount,
  onAmountChange,
  availablePools,
  selectedPoolId,
  onPoolChange,
  apiConfig,
  appConfig,
  showCompare,
  onToggleCompare,
  walletAddress,
  onConnectWallet,
  onDisconnectWallet,
}: SwapInterfaceProps) {
  const { activeAccount, signTransactions, algodClient, activeWallet } = useWallet();
  const isWalletConnected = !!activeAccount;
  const displayAddress = activeAccount?.address || walletAddress;

  // Quote state
  const [quote, setQuote] = useState<any | null>(null); // TODO: type this
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsignedTransactions, setUnsignedTransactions] = useState<string[]>(
    []
  );
  const [swapping, setSwapping] = useState(false);

  // Filter out fromToken from available tokens for toToken selection
  const availableToTokens = useMemo(
    () =>
      tokens.filter(
        (token) =>
          token.tokenId !== fromToken &&
          token.address !== fromToken &&
          token.symbol !== fromToken
      ),
    [tokens, fromToken]
  );

  // Auto-select first available token if current toToken matches fromToken
  useEffect(() => {
    if (
      tokens.length > 0 &&
      availableToTokens.length > 0 &&
      (toToken === fromToken ||
        tokens.find(
          (t) =>
            (t.tokenId === toToken ||
              t.address === toToken ||
              t.symbol === toToken) &&
            (t.tokenId === fromToken ||
              t.address === fromToken ||
              t.symbol === fromToken)
        ))
    ) {
      // Current toToken matches fromToken, select first available token
      onToTokenChange(availableToTokens[0].tokenId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, availableToTokens]);

  // Debounce timer ref for auto-fetching quotes
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fetch quotes with debouncing when amount, fromToken, or toToken changes
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch if amount is invalid
    if (!amount || parseFloat(amount) <= 0 || !fromToken || !toToken) {
      // Clear quote if amount becomes invalid
      if (!amount || parseFloat(amount) <= 0) {
        setQuote(null);
        setUnsignedTransactions([]);
      }
      return;
    }

    // Don't fetch if tokens are the same
    if (fromToken === toToken) {
      return;
    }

    // Set up debounced quote fetch (800ms delay)
    debounceTimerRef.current = setTimeout(() => {
      handleGetQuote();
    }, 800);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromToken, toToken, selectedPoolId]);

  const handleGetQuote = async () => {
    // Clear any pending debounced quote fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!tokens.length) {
        throw new Error('Tokens not loaded');
      }

      // Find token info (support both tokenId and address/symbol)
      const currentFromTokenInfo = tokens.find(
        (t) =>
          t.tokenId === fromToken ||
          t.address === fromToken ||
          t.symbol === fromToken
      );
      const currentToTokenInfo = tokens.find(
        (t) =>
          t.tokenId === toToken || t.address === toToken || t.symbol === toToken
      );

      if (!currentFromTokenInfo || !currentToTokenInfo) {
        throw new Error('Token not found');
      }

      // Convert amount to base units (multiply by 10^decimals)
      const amountInBaseUnits = (
        parseFloat(amount) * Math.pow(10, currentFromTokenInfo.decimals)
      ).toString();

      // Call swap-api directly
      // poolId is optional - if omitted, swap-api will auto-discover pools
      // address is optional - if omitted, returns quotes without unsignedTransactions
      const swapApiUrl =
        apiConfig?.endpoints.swapApi.baseUrl ||
        'https://swap-api-iota.vercel.app';
      const quoteEndpoint =
        apiConfig?.endpoints.swapApi.endpoints.quote || '/quote';

      const requestBody: any = {
        inputToken: parseInt(currentFromTokenInfo.tokenId),
        outputToken: parseInt(currentToTokenInfo.tokenId),
        amount: amountInBaseUnits,
        slippageTolerance: appConfig?.ui.defaultSlippageTolerance || 0.01,
      };

      // Add address if wallet is connected (needed for unsignedTransactions)
      // Prioritize activeAccount.address, fallback to walletAddress
      if (activeAccount?.address) {
        requestBody.address = activeAccount.address;
      } else if (walletAddress) {
        requestBody.address = walletAddress;
      }

      // Add poolId if one is selected
      if (selectedPoolId !== null) {
        requestBody.poolId = selectedPoolId.toString();
      }

      const response = await fetch(`${swapApiUrl}${quoteEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get quote');
      }

      const swapApiResponse = await response.json();

      // Convert swap-api response to our Quote format
      const routePools = swapApiResponse.route?.pools || [];

      // Convert amounts from base units to display units
      const amountInDisplay = (
        parseFloat(swapApiResponse.quote.inputAmount) /
        Math.pow(10, currentFromTokenInfo.decimals)
      ).toString();
      const amountOutDisplay = (
        parseFloat(swapApiResponse.quote.outputAmount) /
        Math.pow(10, currentToTokenInfo.decimals)
      ).toString();

      // Map DEX names from swap-api format to our format
      const mapDexName = (dex: string) => {
        if (dex === 'humbleswap') return 'HUMBLE';
        if (dex === 'nomadex') return 'NOMADEX';
        return 'SWAP_API';
      };

      const path =
        routePools.length > 0
          ? routePools.map((pool: any) => ({
              dex: mapDexName(pool.dex) as 'HUMBLE' | 'NOMADEX' | 'SWAP_API',
              from: currentFromTokenInfo.tokenId.toString(),
              to: currentToTokenInfo.tokenId.toString(),
              poolId: pool.poolId,
            }))
          : [
              {
                dex: 'SWAP_API' as const,
                from: currentFromTokenInfo.tokenId.toString(),
                to: currentToTokenInfo.tokenId.toString(),
                poolId: swapApiResponse.poolId || 'auto-discovered',
              },
            ];

      const quoteData: any = { // TODO: type this
        amountIn: amountInDisplay,
        amountOut: amountOutDisplay,
        path,
        priceImpactPct: swapApiResponse.quote.priceImpact * 100, // Convert to percentage
        feesEstimated: {
          lpFeePct: 0.3, // Default
        },
        warnings:
          swapApiResponse.quote.priceImpact > 0.05
            ? ['High price impact detected']
            : [],
        routeType: path.length > 1 ? 'TWO_HOP' : 'DIRECT',
        comparedRoutes: [],
        timestamp: Date.now(),
      };

      // Calculate exchange rate from display amounts (accounting for decimals)
      const exchangeRate =
        parseFloat(amountOutDisplay) / parseFloat(amountInDisplay);

      // Store additional swap-api data for display
      (quoteData as any).swapApiData = {
        rate: exchangeRate,
        poolId: swapApiResponse.poolId,
        route: swapApiResponse.route,
      };

      // Store unsigned transactions for wallet signing
      setUnsignedTransactions(swapApiResponse.unsignedTransactions || []);

      setQuote(quoteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapTokens = () => {
    onSwapTokens();
    // Clear quote when swapping
    setQuote(null);
    setUnsignedTransactions([]);
  };

  const handleDisconnect = async () => {
    try {
      if (activeWallet?.disconnect) {
        await activeWallet.disconnect();
      }
      if (onDisconnectWallet) {
        onDisconnectWallet();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to disconnect wallet'
      );
    }
  };

  const handleSwap = async () => {
    if (!activeAccount || unsignedTransactions.length === 0) {
      setError('Wallet not connected or no transactions to sign');
      return;
    }

    setSwapping(true);
    setError(null);

    try {
      // Verify wallet is still connected and session is valid
      if (!activeWallet) {
        throw new Error('Wallet session lost. Please reconnect your wallet.');
      }

      // For WalletConnect, check if the wallet has a valid connection
      // WalletConnect sessions can expire, so verify the connection is still active
      const isWalletConnect = activeWallet.id === WalletId.WALLETCONNECT || 
                               activeWallet.id?.toLowerCase().includes('walletconnect');
      if (isWalletConnect) {
        // Check if wallet is still connected by verifying activeAccount
        if (!activeAccount || !activeAccount.address) {
          throw new Error('WalletConnect session expired. Please reconnect your wallet.');
        }
      }

      // Decode base64 transactions to Uint8Array
      const txnsToSign = unsignedTransactions.map((txnBase64: string) => {
        const binaryString = atob(txnBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      });


      console.log({txnsToSign});
      // Sign all transactions as a group
      const stxns = await signTransactions(txnsToSign);

      if (!stxns || stxns.length === 0) {
        throw new Error('Transaction signing was cancelled or failed');
      }

      const res = await algodClient.sendRawTransaction(stxns).do();

      await algosdk.waitForConfirmation(algodClient, res.txid, 4);

      setError(null);
      alert(
        `Swap submitted successfully!\n\nTransaction ID: ${res.txid}\n\nPlease check your wallet for confirmation.`
      );

      // Clear quote and amount after successful swap
      setQuote(null);
      setUnsignedTransactions([]);
      onAmountChange('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign or submit transactions';
      
      // Check for WalletConnect session errors
      if (errorMessage.toLowerCase().includes('session') || 
          errorMessage.toLowerCase().includes('no session found')) {
        setError('WalletConnect session expired. Please reconnect your wallet and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setSwapping(false);
    }
  };

  const formatRoute = (path: any['path']) => { // TODO: type this
    if (path.length === 1) {
      return `${path[0].dex} Direct`;
    } else {
      const uniqueDexes = Array.from(new Set(path.map((step) => step.dex)));
      return uniqueDexes.length === 1
        ? `${uniqueDexes[0]} Two-Hop`
        : `Cross-DEX (${uniqueDexes.join(' → ')})`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Ally</h1>
          <p className="text-lg text-gray-600">Your trading ally on Voi</p>
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
                  You pay
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    className="input-field pr-32"
                    step="0.000001"
                    min="0"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <select
                      value={fromToken}
                      onChange={(e) => {
                        onFromTokenChange(e.target.value);
                      }}
                      className="bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer appearance-none text-right font-medium text-gray-700 pr-5"
                      disabled={!tokens.length}
                    >
                      {tokens.map((token) => (
                        <option key={token.tokenId} value={token.tokenId}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none h-4 w-4 text-gray-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center -my-2">
                <button
                  onClick={handleSwapTokens}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full transition-colors duration-200 border-2 border-gray-300 hover:border-gray-400"
                  disabled={!tokens.length}
                  title="Swap tokens"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              </div>

              {/* To Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  You receive
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={quote ? parseFloat(quote.amountOut).toFixed(6) : ''}
                    readOnly
                    className="input-field pr-32 bg-gray-50"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <select
                      value={toToken}
                      onChange={(e) => {
                        onToTokenChange(e.target.value);
                      }}
                      className="bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer appearance-none text-right font-medium text-gray-700 pr-5"
                      disabled={!tokens.length}
                    >
                      {availableToTokens.map((token) => (
                        <option key={token.tokenId} value={token.tokenId}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none h-4 w-4 text-gray-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Available Pools */}
              {availablePools.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pool (Optional)
                  </label>
                  <select
                    value={selectedPoolId || ''}
                    onChange={(e) =>
                      onPoolChange(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="input-field"
                  >
                    <option value="">Auto-discover (best route)</option>
                    {availablePools.map((pool) => (
                      <option key={pool.poolId} value={pool.poolId}>
                        {pool.name} - {pool.dex} (Pool {pool.poolId}) - Fee:{' '}
                        {pool.fee / 100}%
                      </option>
                    ))}
                  </select>
                  {availablePools.length > 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {availablePools.length} pools available. Select one or let
                      us find the best route.
                    </p>
                  )}
                </div>
              )}

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
                    {parseFloat(quote.amountOut).toFixed(6)}{' '}
                    {toTokenInfo?.symbol || toToken}
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

                  {(quote as any).swapApiData?.poolId != null && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">
                        Pool ID:
                      </span>
                      <span className="text-sm font-mono text-gray-600">
                        {(quote as any).swapApiData.poolId}
                      </span>
                    </div>
                  )}

                  {(quote as any).swapApiData?.rate != null && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">
                        Exchange Rate:
                      </span>
                      <span className="text-sm text-gray-600">
                        1 {fromTokenInfo?.symbol || fromToken} ={' '}
                        {(quote as any).swapApiData.rate.toFixed(6)}{' '}
                        {toTokenInfo?.symbol || toToken}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">
                      Price Impact:
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        quote.priceImpactPct > 5
                          ? 'text-red-600'
                          : quote.priceImpactPct > 2
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}
                    >
                      {quote.priceImpactPct.toFixed(4)}%
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
                  onClick={onToggleCompare}
                  className="btn-secondary w-full"
                >
                  {showCompare ? 'Hide' : 'Show'} Routes
                </button>

                {/* Route Breakdown Section */}
                {showCompare && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-700 mb-3 text-sm">
                      Route Breakdown
                    </h4>
                    {/* Multi-pool route breakdown */}
                    {(quote as any).swapApiData?.route?.pools &&
                    (quote as any).swapApiData.route.pools.length > 0 ? (
                      <>
                        <div className="pb-2 md:overflow-x-auto md:flex md:justify-center">
                          {(() => {
                          // Check if all pools are doing the same swap (fromToken -> toToken)
                          // This means both pools should have fromToken and toToken, and no intermediate token should be needed
                          const getPoolTokenIds = (poolCfg: any): number[] => {
                            const ids: number[] = [];
                            if (poolCfg.tokens.tokA?.id !== undefined) ids.push(poolCfg.tokens.tokA.id);
                            if (poolCfg.tokens.tokB?.id !== undefined) ids.push(poolCfg.tokens.tokB.id);
                            if (poolCfg.tokens.wrappedPair) {
                              ids.push(poolCfg.tokens.wrappedPair.tokA);
                              ids.push(poolCfg.tokens.wrappedPair.tokB);
                            }
                            // Also check underlying tokens for wrapped pairs
                            if (poolCfg.tokens.underlyingToWrapped) {
                              Object.values(poolCfg.tokens.underlyingToWrapped).forEach((id: any) => ids.push(id));
                              Object.keys(poolCfg.tokens.underlyingToWrapped).forEach((key: string) => {
                                const keyId = parseInt(key);
                                if (!isNaN(keyId)) ids.push(keyId);
                              });
                            }
                            return ids;
                          };

                          // Get token IDs - handle both numeric IDs and string identifiers
                          const fromTokenId = parseInt(fromToken) || 0;
                          const toTokenId = parseInt(toToken) || 0;
                          const fromTokenInfoId = fromTokenInfo ? parseInt(fromTokenInfo.tokenId) || 0 : 0;
                          const toTokenInfoId = toTokenInfo ? parseInt(toTokenInfo.tokenId) || 0 : 0;
                          
                          // Check if all pools support fromToken -> toToken directly
                          const allPoolsSameSwap = (quote as any).swapApiData.route.pools.every((pool: any) => {
                            const poolConfig = availablePools.find(p => p.poolId === pool.poolId);
                            if (!poolConfig) return false;
                            const poolTokens = getPoolTokenIds(poolConfig);
                            
                            // Check if pool contains both fromToken and toToken (by ID)
                            const hasFromToken = poolTokens.includes(fromTokenId) || 
                                              poolTokens.includes(fromTokenInfoId) ||
                                              (fromTokenId === 0 && poolTokens.some(id => id === 0 || id === 390001)); // VOI native/wrapped
                            const hasToToken = poolTokens.includes(toTokenId) || 
                                             poolTokens.includes(toTokenInfoId);
                            
                            return hasFromToken && hasToToken;
                          });
                          
                          // Also check: if all pools have fromToken as input and toToken as output in their display,
                          // they should be stacked (regardless of intermediate tokens in the route)
                          // This handles cases where the route uses intermediates but pools effectively do fromToken -> toToken
                          const allPoolsShowFromTo = (quote as any).swapApiData.route.pools.length > 1 &&
                            (quote as any).swapApiData.route.pools.every((pool: any, index: number) => {
                              // Calculate what tokens are being displayed for this pool
                              const isFirst = index === 0;
                              const isLast = index === (quote as any).swapApiData.route.pools.length - 1;
                              
                              // For stacked view, first pool should show fromToken input, last should show toToken output
                              // All pools in between should also effectively be doing fromToken -> toToken
                              return true; // If pool supports both tokens, it can do the swap
                            });
                          
                          // Stack if all pools support the same swap (fromToken -> toToken)
                          // This means they can all do the direct swap, so we stack them
                          if (allPoolsSameSwap && allPoolsShowFromTo && (quote as any).swapApiData.route.pools.length > 1) {
                            // Stacked view for same-direction pools
                            const totalInput = (quote as any).swapApiData.route.pools.reduce((sum: number, pool: any) => 
                              sum + parseFloat(pool.inputAmount), 0
                            ) / Math.pow(10, fromTokenInfo?.decimals || 6);
                            const totalOutput = (quote as any).swapApiData.route.pools.reduce((sum: number, pool: any) => 
                              sum + parseFloat(pool.outputAmount), 0
                            ) / Math.pow(10, toTokenInfo?.decimals || 6);

                            return (
                              <div className="flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-2 md:min-w-max">
                                {/* Starting Token */}
                                <div className="flex flex-col items-center">
                                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg px-2 py-1.5 shadow-md min-w-[110px] h-[70px] flex flex-col justify-center text-center">
                                    <div className="text-[10px] font-medium opacity-90 mb-0.5">
                                      You Pay
                                    </div>
                                    <div className="text-xs font-bold leading-tight">
                                      {parseFloat(amount).toFixed(6)}
                                    </div>
                                    <div className="text-[10px] font-medium mt-0.5">
                                      {fromTokenInfo?.symbol || fromToken}
                                    </div>
                                  </div>
                                </div>

                                {/* Arrow to Split */}
                                <div className="flex flex-col items-center">
                                  <svg
                                    className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                  </svg>
                                </div>

                                {/* Split Point and Stacked Pools */}
                                <div className="relative flex flex-col items-center gap-3 md:flex-row md:items-center" style={{ minHeight: '120px' }}>
                                  {/* Split/Merge Lines - positioned absolutely (hidden on small screens) */}
                                  <div className="hidden md:absolute md:left-0 md:top-0 md:bottom-0 md:flex md:items-center md:justify-center" style={{ width: '100px' }}>
                                    <svg width="100" height="100%" className="absolute inset-0">
                                      {/* Calculate positions based on number of pools */}
                                      {(() => {
                                        const numPools = (quote as any).swapApiData.route.pools.length;
                                        const poolHeight = 60; // Approximate height per pool
                                        const totalHeight = Math.max(120, numPools * poolHeight);
                                        const centerY = totalHeight / 2;
                                        const poolPositions = (quote as any).swapApiData.route.pools.map((_: any, i: number) => {
                                          const spacing = totalHeight / (numPools + 1);
                                          return spacing * (i + 1);
                                        });
                                        
                                        return (
                                          <>
                                            {/* Horizontal line from input arrow */}
                                            <line
                                              x1="0"
                                              y1={centerY}
                                              x2="20"
                                              y2={centerY}
                                              stroke="#9ca3af"
                                              strokeWidth="2"
                                            />
                                            {/* Vertical split line */}
                                            <line
                                              x1="20"
                                              y1={poolPositions[0]}
                                              x2="20"
                                              y2={poolPositions[poolPositions.length - 1]}
                                              stroke="#9ca3af"
                                              strokeWidth="2"
                                            />
                                            {/* Branches to each pool */}
                                            {poolPositions.map((y: number, i: number) => (
                                              <line
                                                key={`branch-${i}`}
                                                x1="20"
                                                y1={y}
                                                x2="60"
                                                y2={y}
                                                stroke="#9ca3af"
                                                strokeWidth="2"
                                              />
                                            ))}
                                            {/* Vertical merge line */}
                                            <line
                                              x1="60"
                                              y1={poolPositions[0]}
                                              x2="60"
                                              y2={poolPositions[poolPositions.length - 1]}
                                              stroke="#9ca3af"
                                              strokeWidth="2"
                                            />
                                            {/* Horizontal line to output arrow */}
                                            <line
                                              x1="60"
                                              y1={centerY}
                                              x2="100"
                                              y2={centerY}
                                              stroke="#9ca3af"
                                              strokeWidth="2"
                                            />
                                          </>
                                        );
                                      })()}
                                    </svg>
                                  </div>

                                  {/* Pools Stacked */}
                                  <div className="flex flex-col items-center gap-3 relative z-10 md:mx-0 md:static md:ml-[100px] md:mr-5">
                                    {(quote as any).swapApiData.route.pools.map((pool: any, index: number) => {
                                      const poolInputDisplay = (
                                        parseFloat(pool.inputAmount) / Math.pow(10, fromTokenInfo?.decimals || 6)
                                      ).toFixed(6);
                                      const poolOutputDisplay = (
                                        parseFloat(pool.outputAmount) / Math.pow(10, toTokenInfo?.decimals || 6)
                                      ).toFixed(6);

                                      return (
                                        <div key={index} className="flex items-center">
                                          <div className="bg-white border border-gray-300 rounded-md px-2 py-1.5 shadow-sm hover:shadow transition-shadow min-w-[110px] h-[70px] flex flex-col justify-center">
                                            <div className="text-center">
                                              <div className="text-[10px] font-semibold text-gray-600 mb-0.5">
                                                {pool.dex.toUpperCase()}
                                              </div>
                                              <div className="text-[10px] font-mono text-gray-500">
                                                Pool {pool.poolId}
                                              </div>
                                              <div className="mt-1 pt-1 border-t border-gray-200">
                                                <div className="text-[10px] text-gray-600 leading-tight">
                                                  In: {poolInputDisplay} {fromTokenInfo?.symbol || ''}
                                                </div>
                                                <div className="text-[10px] text-gray-600 leading-tight">
                                                  Out: {poolOutputDisplay} {toTokenInfo?.symbol || ''}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Arrow from Merge */}
                                <div className="flex flex-col items-center">
                                  <svg
                                    className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                  </svg>
                                </div>

                                {/* Ending Token */}
                                <div className="flex flex-col items-center">
                                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg px-2 py-1.5 shadow-md min-w-[110px] h-[70px] flex flex-col justify-center text-center">
                                    <div className="text-[10px] font-medium opacity-90 mb-0.5">
                                      You Receive
                                    </div>
                                    <div className="text-xs font-bold leading-tight">
                                      {parseFloat(quote.amountOut).toFixed(6)}
                                    </div>
                                    <div className="text-[10px] font-medium mt-0.5">
                                      {toTokenInfo?.symbol || toToken}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Linear view for different-direction pools
                          return (
                            <div className="flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-1.5 md:min-w-max">
                              {/* Starting Token */}
                              <div className="flex flex-col items-center">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg px-2 py-1.5 shadow-md min-w-[110px] h-[70px] flex flex-col justify-center text-center">
                                  <div className="text-[10px] font-medium opacity-90 mb-0.5">
                                    You Pay
                                  </div>
                                  <div className="text-xs font-bold leading-tight">
                                    {parseFloat(amount).toFixed(6)}
                                  </div>
                                  <div className="text-[10px] font-medium mt-0.5">
                                    {fromTokenInfo?.symbol || fromToken}
                                  </div>
                                </div>
                              </div>

                              {/* Arrow from starting token */}
                              <div className="flex flex-col items-center">
                                <svg
                                  className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                                  />
                                </svg>
                              </div>

                              {/* Pools with connecting arrows */}
                              {(quote as any).swapApiData.route.pools.map(
                            (pool: any, index: number) => {
                              const isLastPool = index === (quote as any).swapApiData.route.pools.length - 1;
                              const isFirstPool = index === 0;
                              
                              // Determine input and output tokens for this pool
                              // Check if pool has explicit token fields from API
                              const poolInputTokenId = pool.inputToken || (isFirstPool ? fromToken : null);
                              const poolOutputTokenId = pool.outputToken || (isLastPool ? toToken : null);
                              
                              // Find token info objects
                              const poolInputTokenInfo = isFirstPool 
                                ? fromTokenInfo 
                                : (poolInputTokenId 
                                    ? tokens.find(t => t.tokenId === poolInputTokenId.toString() || t.address === poolInputTokenId?.toString()) 
                                    : null);
                              
                              const poolOutputTokenInfo = isLastPool 
                                ? toTokenInfo 
                                : (poolOutputTokenId 
                                    ? tokens.find(t => t.tokenId === poolOutputTokenId.toString() || t.address === poolOutputTokenId?.toString())
                                    : null);

                              // For multi-hop: determine intermediate token
                              // The intermediate token is the output of this pool (which becomes input of next pool)
                              let intermediateTokenInfo = null;
                              if (!isLastPool) {
                                // First try to use explicit output token from API
                                if (poolOutputTokenInfo) {
                                  intermediateTokenInfo = poolOutputTokenInfo;
                                } else {
                                  // For two-hop routes, find the token that connects pool1 and pool2
                                  const nextPool = (quote as any).swapApiData.route.pools[index + 1];
                                  if (nextPool) {
                                    const currentPoolConfig = availablePools.find(p => p.poolId === pool.poolId);
                                    const nextPoolConfig = availablePools.find(p => p.poolId === nextPool.poolId);
                                    
                                    if (currentPoolConfig && nextPoolConfig) {
                                      // Get tokens from both pools
                                      const getPoolTokenIds = (poolCfg: any): number[] => {
                                        const ids: number[] = [];
                                        if (poolCfg.tokens.tokA?.id !== undefined) ids.push(poolCfg.tokens.tokA.id);
                                        if (poolCfg.tokens.tokB?.id !== undefined) ids.push(poolCfg.tokens.tokB.id);
                                        if (poolCfg.tokens.wrappedPair) {
                                          ids.push(poolCfg.tokens.wrappedPair.tokA);
                                          ids.push(poolCfg.tokens.wrappedPair.tokB);
                                        }
                                        return ids;
                                      };
                                      
                                      const currentTokens = getPoolTokenIds(currentPoolConfig);
                                      const nextTokens = getPoolTokenIds(nextPoolConfig);
                                      
                                      // Find the token that's in both pools but not fromToken or toToken
                                      const fromTokenId = parseInt(fromToken) || 0;
                                      const toTokenId = parseInt(toToken) || 0;
                                      
                                      const connectingTokenId = currentTokens.find(id => 
                                        nextTokens.includes(id) && 
                                        id !== fromTokenId && 
                                        id !== toTokenId
                                      );
                                      
                                      if (connectingTokenId !== undefined) {
                                        intermediateTokenInfo = tokens.find(t => 
                                          t.tokenId === connectingTokenId.toString() || 
                                          parseInt(t.tokenId) === connectingTokenId ||
                                          parseInt(t.address) === connectingTokenId
                                        ) || null;
                                      }
                                    }
                                  }
                                  
                                  // Fallback: use common intermediate tokens
                                  if (!intermediateTokenInfo) {
                                    const possibleIntermediate = tokens.find(t => {
                                      const commonIntermediates = appConfig?.routing.commonIntermediateTokens || [];
                                      return commonIntermediates.includes(t.symbol) && 
                                             t.tokenId !== fromToken && 
                                             t.tokenId !== toToken &&
                                             t.address !== fromToken &&
                                             t.address !== toToken;
                                    });
                                    intermediateTokenInfo = possibleIntermediate || null;
                                  }
                                }
                              }

                              // Check if this is a split route (both pools doing fromToken -> toToken)
                              // by checking if both pools support the same swap
                              const isSplitRoute = (quote as any).swapApiData.route.pools.length > 1;
                              let bothPoolsSameSwap = false;
                              if (isSplitRoute) {
                                // Check if both pools can do fromToken -> toToken
                                const poolConfig = availablePools.find(p => p.poolId === pool.poolId);
                                if (poolConfig) {
                                  const getPoolTokenIds = (poolCfg: any): number[] => {
                                    const ids: number[] = [];
                                    if (poolCfg.tokens.tokA?.id !== undefined) ids.push(poolCfg.tokens.tokA.id);
                                    if (poolCfg.tokens.tokB?.id !== undefined) ids.push(poolCfg.tokens.tokB.id);
                                    if (poolCfg.tokens.wrappedPair) {
                                      ids.push(poolCfg.tokens.wrappedPair.tokA);
                                      ids.push(poolCfg.tokens.wrappedPair.tokB);
                                    }
                                    return ids;
                                  };
                                  const poolTokens = getPoolTokenIds(poolConfig);
                                  const fromTokenId = parseInt(fromToken) || 0;
                                  const toTokenId = parseInt(toToken) || 0;
                                  // Check if this pool supports fromToken -> toToken
                                  bothPoolsSameSwap = poolTokens.includes(fromTokenId) && poolTokens.includes(toTokenId);
                                }
                              }
                              
                              // For split routes where both pools do fromToken -> toToken, always show fromToken/toToken
                              // Otherwise use the detected tokens
                              const displayInputToken = (isSplitRoute && bothPoolsSameSwap) 
                                ? fromTokenInfo 
                                : (poolInputTokenInfo || fromTokenInfo);
                              const displayOutputToken = (isSplitRoute && bothPoolsSameSwap) 
                                ? toTokenInfo 
                                : (poolOutputTokenInfo || toTokenInfo);
                              
                              // Calculate display amounts using correct decimals
                              const inputDecimals = displayInputToken?.decimals || fromTokenInfo?.decimals || 6;
                              const outputDecimals = displayOutputToken?.decimals || toTokenInfo?.decimals || 6;
                              
                              const poolInputDisplay = (
                                parseFloat(pool.inputAmount) / Math.pow(10, inputDecimals)
                              ).toFixed(6);

                              const poolOutputDisplay = (
                                parseFloat(pool.outputAmount) / Math.pow(10, outputDecimals)
                              ).toFixed(6);

                              return (
                                <div key={index} className="flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-1.5">
                                  {/* Arrow before pool (not for first pool) */}
                                  {index > 0 && (
                                    <div className="flex flex-col items-center">
                                      <svg
                                        className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                                        />
                                      </svg>
                                    </div>
                                  )}

                                  {/* Pool Card */}
                                  <div className="flex flex-col items-center">
                                    <div className="bg-white border border-gray-300 rounded-md px-2 py-1.5 shadow-sm hover:shadow transition-shadow min-w-[110px] h-[70px] flex flex-col justify-center">
                                      <div className="text-center">
                                        <div className="text-[10px] font-semibold text-gray-600 mb-0.5">
                                          {pool.dex.toUpperCase()}
                                        </div>
                                        <div className="text-[10px] font-mono text-gray-500">
                                          Pool {pool.poolId}
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-gray-200">
                                          <div className="text-[10px] text-gray-600 leading-tight">
                                            In: {poolInputDisplay} {displayInputToken?.symbol || fromTokenInfo?.symbol || ''}
                                          </div>
                                          <div className="text-[10px] text-gray-600 leading-tight">
                                            Out: {poolOutputDisplay} {displayOutputToken?.symbol || toTokenInfo?.symbol || ''}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}

                          {/* Arrow after last pool */}
                          <div className="flex flex-col items-center">
                            <svg
                              className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                              />
                            </svg>
                          </div>

                          {/* Ending Token */}
                          <div className="flex flex-col items-center">
                            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg px-2 py-1.5 shadow-md min-w-[110px] h-[70px] flex flex-col justify-center text-center">
                              <div className="text-[10px] font-medium opacity-90 mb-0.5">
                                You Receive
                              </div>
                              <div className="text-xs font-bold leading-tight">
                                {parseFloat(quote.amountOut).toFixed(6)}
                              </div>
                              <div className="text-[10px] font-medium mt-0.5">
                                {toTokenInfo?.symbol || toToken}
                              </div>
                            </div>
                          </div>
                            </div>
                          );
                          })()}
                        </div>
                      </>
                    ) : quote.comparedRoutes ? (
                      <div className="space-y-2">
                        {quote.comparedRoutes.map((route, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0"
                          >
                            <span className="text-sm font-medium text-gray-600">
                              {route.label}
                            </span>
                            <span className="text-sm font-mono text-gray-900">
                              {parseFloat(route.amountOut).toFixed(6)}{' '}
                              {toTokenInfo?.symbol || toToken}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No route breakdown available
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Swap Button - Bottom of Page */}
          {quote && (
            <div className="card mb-6">
              <div className="space-y-4">
                {!isWalletConnected ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Connect your wallet to execute the swap
                    </p>
                    <button
                      onClick={onConnectWallet}
                      className="btn-primary w-full"
                    >
                      Connect Wallet
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Supported: Voi Wallet, Lute Wallet, and other Algorand
                      wallets
                    </p>
                  </div>
                ) : unsignedTransactions.length === 0 ? (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-600">Connected:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-900">
                          {displayAddress
                            ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                            : 'Connected'}
                        </span>
                        <button
                          onClick={handleDisconnect}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-100"
                          title="Disconnect wallet"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Get a new quote to receive unsigned transactions for
                      signing.
                    </p>
                    <button
                      onClick={handleGetQuote}
                      className="btn-secondary w-full"
                    >
                      Get Quote with Transactions
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-600">Connected:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-900">
                          {displayAddress
                            ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                            : 'Connected'}
                        </span>
                        <button
                          onClick={handleDisconnect}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-100"
                          title="Disconnect wallet"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mb-3 text-center font-medium">
                      Use at your own risk. Always verify transaction details before confirming.
                    </p>
                    <button
                      onClick={handleSwap}
                      disabled={
                        swapping ||
                        !isWalletConnected ||
                        unsignedTransactions.length === 0
                      }
                      className="btn-primary w-full text-lg py-3"
                    >
                      {swapping
                        ? 'Signing & Submitting...'
                        : `Swap ${fromTokenInfo?.symbol || ''} → ${toTokenInfo?.symbol || ''}`}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      You will be prompted to sign {unsignedTransactions.length}{' '}
                      transaction
                      {unsignedTransactions.length !== 1 ? 's' : ''} in your
                      wallet
                    </p>
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

      {/* Footer */}
      <footer className="mt-16 pt-8 pb-8 border-t-2 border-gray-300 bg-white/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
          <div className="text-center sm:text-left">
            <p className="text-gray-700 font-medium mb-1">
              Ally - Simple & intuitive DEX aggregator for Voi
            </p>
            <p className="text-sm text-gray-500">
              Powered by{' '}
              <a
                href="https://voi.humble.sh/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 underline transition-colors"
              >
                HumbleSwap
              </a>
              {' & '}
              <a
                href="https://voi.nomadex.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 underline transition-colors"
              >
                Nomadex
              </a>
            </p>
          </div>
          <div className="text-center">
            <VersionDisplay />
          </div>
        </div>
      </footer>
    </div>
  );
}
