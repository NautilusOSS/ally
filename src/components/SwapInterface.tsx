import { useState, useEffect, useMemo } from 'react';
import type {
  TokenConfig,
  PoolConfig,
  ApiConfig,
  AppConfig,
} from '../lib/config';
import { useWallet, WalletId } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';

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
  const [expandedRouteCards, setExpandedRouteCards] = useState<Set<number>>(
    new Set()
  );

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

  const handleGetQuote = async () => {
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
      // Reset expanded route cards when new quote is fetched
      setExpandedRouteCards(new Set());
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
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3">
                      Route Breakdown
                    </h4>
                    {/* Multi-pool route breakdown */}
                    {(quote as any).swapApiData?.route?.pools &&
                    (quote as any).swapApiData.route.pools.length > 0 ? (
                      <div className="space-y-2">
                        {(quote as any).swapApiData.route.pools.map(
                          (pool: any, index: number) => {
                            const poolInputDisplay = (
                              parseFloat(pool.inputAmount) /
                              Math.pow(10, fromTokenInfo?.decimals || 0)
                            ).toFixed(6);
                            const poolOutputDisplay = (
                              parseFloat(pool.outputAmount) /
                              Math.pow(10, toTokenInfo?.decimals || 0)
                            ).toFixed(6);
                            const isExpanded = expandedRouteCards.has(index);
                            const toggleExpanded = () => {
                              const newExpanded = new Set(expandedRouteCards);
                              if (isExpanded) {
                                newExpanded.delete(index);
                              } else {
                                newExpanded.add(index);
                              }
                              setExpandedRouteCards(newExpanded);
                            };

                            return (
                              <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                              >
                                <button
                                  onClick={toggleExpanded}
                                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-gray-700">
                                      {pool.dex} Pool {pool.poolId}
                                    </span>
                                    <span className="text-gray-500">
                                      {poolInputDisplay}{' '}
                                      {fromTokenInfo?.symbol || fromToken} →{' '}
                                      {poolOutputDisplay}{' '}
                                      {toTokenInfo?.symbol || toToken}
                                    </span>
                                  </div>
                                  <svg
                                    className={`h-4 w-4 text-gray-500 transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
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
                                </button>
                                {isExpanded && (
                                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          Pool ID:
                                        </span>
                                        <span className="font-mono text-gray-900">
                                          {pool.poolId}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          DEX:
                                        </span>
                                        <span className="text-gray-900">
                                          {pool.dex}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          Input Amount:
                                        </span>
                                        <span className="font-mono text-gray-900">
                                          {poolInputDisplay}{' '}
                                          {fromTokenInfo?.symbol || fromToken}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          Output Amount:
                                        </span>
                                        <span className="font-mono text-gray-900">
                                          {poolOutputDisplay}{' '}
                                          {toTokenInfo?.symbol || toToken}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
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
    </div>
  );
}
