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
import ThemeToggle from './ThemeToggle';

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
    <div className="min-h-screen bg-gradient-to-br from-sand-100 via-sand-50 to-dune-100 dark:from-stone-900 dark:via-stone-800 dark:to-stone-700 oled:from-black oled:via-black oled:to-black oled:transition-none transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        {/* Theme Toggle - Top Right */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-5xl sm:text-6xl font-bold text-dune-800 dark:text-stone-200 oled:text-gray-400 oled:font-semibold mb-4 tracking-tight oled:transition-none transition-colors duration-200">Ally</h1>
          {/* Genie Lamp Icon */}
          <div className="flex justify-center mb-4">
            <svg
              width="96"
              height="96"
              viewBox="230 280 560 480"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-dune-800 dark:text-stone-200 oled:text-gray-400 oled:hover:scale-100 transition-all duration-300 hover:scale-105"
            >
              <path
                fill="currentColor"
                d="M 346.5,286.5 C 374.985,284.819 395.818,296.486 409,321.5C 419.317,349.253 415.65,374.92 398,398.5C 383.868,413.817 366.368,422.65 345.5,425C 331.472,425.814 317.472,426.814 303.5,428C 279.449,434.423 266.783,450.09 265.5,475C 266.05,482.235 267.05,489.402 268.5,496.5C 269.149,500.687 267.482,502.187 263.5,501C 250.759,491.905 242.259,479.738 238,464.5C 229.85,423.629 245.683,397.129 285.5,385C 303.79,382.742 321.79,379.075 339.5,374C 352.395,370.438 360.562,362.272 364,349.5C 365.238,337.392 360.405,328.558 349.5,323C 333.562,317.133 324.895,322.633 323.5,339.5C 323.972,344.028 324.639,348.528 325.5,353C 325.441,354.436 325.108,355.769 324.5,357C 311.398,356.573 303.898,349.74 302,336.5C 302.223,312.593 313.723,296.76 336.5,289C 339.991,288.262 343.325,287.429 346.5,286.5 Z"
              />
              <path
                fill="currentColor"
                d="M 507.5,426.5 C 530.623,426.789 541.457,438.456 540,461.5C 538.315,468.186 534.649,473.52 529,477.5C 528.502,480.482 528.335,483.482 528.5,486.5C 549.146,490.595 563.979,502.262 573,521.5C 576.629,523.829 580.296,526.163 584,528.5C 585.483,531.702 585.817,535.036 585,538.5C 584.167,540.667 582.667,542.167 580.5,543C 534.833,543.667 489.167,543.667 443.5,543C 436.529,538.449 435.862,533.116 441.5,527C 443.957,525.438 446.624,524.438 449.5,524C 457.224,507.943 469.224,496.276 485.5,489C 489.632,487.1 493.966,486.267 498.5,486.5C 498.813,483.753 498.48,481.086 497.5,478.5C 486.848,470.384 483.015,459.717 486,446.5C 490.196,436.465 497.363,429.798 507.5,426.5 Z"
              />
              <path
                fill="currentColor"
                d="M 701.5,491.5 C 726.4,487.758 747.9,494.425 766,511.5C 779.605,530.266 782.272,550.599 774,572.5C 766.22,587.947 754.72,599.78 739.5,608C 732.621,611.606 725.621,614.939 718.5,618C 700.645,623.674 682.979,629.84 665.5,636.5C 665.167,636.833 664.833,637.167 664.5,637.5C 671.101,640.877 673.268,646.211 671,653.5C 665.63,663.4 657.797,665.9 647.5,661C 639.845,654.567 637.012,646.4 639,636.5C 642.706,625.126 650.206,617.292 661.5,613C 675.033,608.267 688.7,603.934 702.5,600C 717.897,594.889 731.064,586.389 742,574.5C 749.809,561.547 750.476,548.214 744,534.5C 735.202,522.362 723.369,517.862 708.5,521C 694.363,524.473 682.863,531.973 674,543.5C 668.535,550.981 663.869,558.981 660,567.5C 652.726,587.989 645.06,608.322 637,628.5C 618.119,665.541 587.953,686.708 546.5,692C 542.19,695.341 541.356,699.508 544,704.5C 548.696,712.946 555.863,718.112 565.5,720C 582.33,720.315 594.497,727.815 602,742.5C 602.777,745.429 602.61,748.263 601.5,751C 542.167,751.667 482.833,751.667 423.5,751C 422.901,737.923 428.901,728.923 441.5,724C 452.79,722.513 463.457,719.18 473.5,714C 480.742,708.719 483.242,701.886 481,693.5C 440.183,686.508 404.683,669.008 374.5,641C 347.306,611.797 318.306,584.797 287.5,560C 275.833,551.667 264.167,543.333 252.5,535C 246.536,530.892 246.203,526.559 251.5,522C 267.5,521.333 283.5,521.333 299.5,522C 327.018,536.729 355.684,548.729 385.5,558C 403.09,564.73 420.756,565.063 438.5,559C 493.842,558.415 549.176,558.415 604.5,559C 611.327,557.587 617.327,554.587 622.5,550C 630.404,542.766 637.571,534.933 644,526.5C 659.433,508.541 678.6,496.874 701.5,491.5 Z"
              />
            </svg>
          </div>
          <p className="text-base sm:text-lg text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal font-medium transition-colors duration-200 oled:transition-none">Your trading ally on Voi</p>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {/* Input Card */}
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-dune-800 dark:text-stone-100 oled:text-gray-400 oled:font-semibold mb-4 transition-colors duration-200 oled:transition-none">
              Get Quote
            </h2>

            <div className="space-y-4">
              {/* From Token */}
              <div>
                <label className="block text-sm font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal mb-2 transition-colors duration-200 oled:transition-none">
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
                      className="bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer appearance-none text-right font-medium text-dune-700 pr-5"
                      disabled={!tokens.length}
                    >
                      {tokens.map((token) => (
                        <option key={token.tokenId} value={token.tokenId}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none h-4 w-4 text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal flex-shrink-0 transition-colors duration-200 oled:transition-none"
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
                  className="bg-sand-200 hover:bg-sand-300 dark:bg-stone-700 oled:bg-black oled:shadow-none dark:hover:bg-stone-600 oled:hover:bg-black text-dune-600 dark:text-stone-300 p-2 rounded-full transition-colors duration-200 oled:transition-none border-2 border-sand-300 dark:border-stone-600 oled:border-gray-900 hover:border-sand-400 dark:hover:border-stone-500"
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
                <label className="block text-sm font-medium text-dune-700 mb-2">
                  You receive
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={quote ? parseFloat(quote.amountOut).toFixed(6) : ''}
                    readOnly
                    className="input-field pr-32 bg-sand-100 dark:bg-stone-700 oled:bg-black oled:shadow-none"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <select
                      value={toToken}
                      onChange={(e) => {
                        onToTokenChange(e.target.value);
                      }}
                      className="bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer appearance-none text-right font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal pr-5 transition-colors duration-200 oled:transition-none"
                      disabled={!tokens.length}
                    >
                      {availableToTokens.map((token) => (
                        <option key={token.tokenId} value={token.tokenId}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none h-4 w-4 text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal flex-shrink-0 transition-colors duration-200 oled:transition-none"
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
                  <label className="block text-sm font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal mb-2 transition-colors duration-200 oled:transition-none">
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
                    <p className="text-xs text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal mt-1 transition-colors duration-200 oled:transition-none">
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
            <div className="card mb-6 bg-red-50 dark:bg-red-900/20 oled:bg-red-900/10 border-red-200 dark:border-red-800 oled:border-red-900">
              <p className="text-red-700 dark:text-red-400 oled:text-red-500 transition-colors duration-200 oled:transition-none">{error}</p>
            </div>
          )}

          {/* Quote Display */}
          {quote && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold text-dune-800 dark:text-stone-100 oled:text-gray-400 oled:font-semibold mb-4 transition-colors duration-200 oled:transition-none">
                Best Route
              </h3>

              <div className="space-y-4">
                {/* Amount Out */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {parseFloat(quote.amountOut).toFixed(6)}{' '}
                    {toTokenInfo?.symbol || toToken}
                  </div>
                  <div className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal mt-1 transition-colors duration-200 oled:transition-none">
                    ≈ ${(parseFloat(quote.amountOut) * 0.5).toFixed(2)} USD
                  </div>
                </div>

                {/* Route Info */}
                <div className="bg-sand-100 dark:bg-stone-700 oled:bg-black oled:shadow-none/50 rounded-lg p-4 transition-colors duration-200 oled:transition-none">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal transition-colors duration-200 oled:transition-none">Route:</span>
                    <span className="text-sm font-mono bg-sand-50 dark:bg-stone-800 oled:bg-black oled:shadow-none px-2 py-1 rounded transition-colors duration-200 oled:transition-none">
                      {formatRoute(quote.path)}
                    </span>
                  </div>

                  {(quote as any).swapApiData?.poolId != null && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal transition-colors duration-200 oled:transition-none">
                        Pool ID:
                      </span>
                      <span className="text-sm font-mono text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                        {(quote as any).swapApiData.poolId}
                      </span>
                    </div>
                  )}

                  {(quote as any).swapApiData?.rate != null && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal transition-colors duration-200 oled:transition-none">
                        Exchange Rate:
                      </span>
                      <span className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                        1 {fromTokenInfo?.symbol || fromToken} ={' '}
                        {(quote as any).swapApiData.rate.toFixed(6)}{' '}
                        {toTokenInfo?.symbol || toToken}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal transition-colors duration-200 oled:transition-none">
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
                    <span className="font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal transition-colors duration-200 oled:transition-none">Fees:</span>
                    <span className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                      {quote.feesEstimated.lpFeePct.toFixed(2)}% LP fee
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {quote.warnings && quote.warnings.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 oled:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 oled:border-yellow-900 rounded-lg p-3 transition-colors duration-200 oled:transition-none">
                    <div className="text-yellow-800 dark:text-yellow-400 oled:text-yellow-500 text-sm transition-colors duration-200 oled:transition-none">
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
                  <div className="bg-sand-100 dark:bg-stone-700 oled:bg-black oled:shadow-none/50 rounded-lg p-3 transition-colors duration-200 oled:transition-none">
                    <h4 className="font-medium text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal mb-3 text-sm transition-colors duration-200 oled:transition-none">
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
                                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 oled:from-gray-800 oled:to-gray-800 text-white rounded-lg px-2 py-1.5 shadow-md oled:shadow-none min-w-[110px] h-[70px] flex flex-col justify-center text-center">
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
                                    className="w-5 h-5 text-dune-500 dark:text-stone-400 rotate-90 md:rotate-0 transition-colors duration-200 oled:transition-none"
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
                                          <div className="bg-sand-50 dark:bg-stone-800 oled:bg-black oled:shadow-none border border-sand-300 dark:border-stone-600 oled:border-gray-900 rounded-md px-2 py-1.5 shadow-sm hover:shadow oled:hover:shadow-none transition-all min-w-[110px] h-[70px] flex flex-col justify-center">
                                            <div className="text-center">
                                              <div className="text-[10px] font-semibold text-dune-600 dark:text-stone-300 mb-0.5 transition-colors duration-200 oled:transition-none">
                                                {pool.dex.toUpperCase()}
                                              </div>
                                              <div className="text-[10px] font-mono text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                                                Pool {pool.poolId}
                                              </div>
                                              <div className="mt-1 pt-1 border-t border-sand-200 dark:border-stone-700 oled:border-gray-900 transition-colors duration-200 oled:transition-none">
                                                <div className="text-[10px] text-dune-600 dark:text-stone-300 leading-tight transition-colors duration-200 oled:transition-none">
                                                  In: {poolInputDisplay} {fromTokenInfo?.symbol || ''}
                                                </div>
                                                <div className="text-[10px] text-dune-600 dark:text-stone-300 leading-tight transition-colors duration-200 oled:transition-none">
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
                                    className="w-5 h-5 text-dune-500 dark:text-stone-400 rotate-90 md:rotate-0 transition-colors duration-200 oled:transition-none"
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
                                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 oled:from-gray-800 oled:to-gray-800 text-white rounded-lg px-2 py-1.5 shadow-md oled:shadow-none min-w-[110px] h-[70px] flex flex-col justify-center text-center">
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
                                <div className="bg-gradient-to-br from-primary-500 to-primary-600 oled:from-gray-800 oled:to-gray-800 text-white rounded-lg px-2 py-1.5 shadow-md oled:shadow-none min-w-[110px] h-[70px] flex flex-col justify-center text-center">
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
                                        className="w-5 h-5 text-dune-500 dark:text-stone-400 rotate-90 md:rotate-0 transition-colors duration-200 oled:transition-none"
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
                                    <div className="bg-sand-50 dark:bg-stone-800 oled:bg-black oled:shadow-none border border-sand-300 dark:border-stone-600 oled:border-gray-900 rounded-md px-2 py-1.5 shadow-sm hover:shadow oled:hover:shadow-none transition-all min-w-[110px] h-[70px] flex flex-col justify-center">
                                      <div className="text-center">
                                        <div className="text-[10px] font-semibold text-dune-600 dark:text-stone-300 mb-0.5 transition-colors duration-200 oled:transition-none">
                                          {pool.dex.toUpperCase()}
                                        </div>
                                        <div className="text-[10px] font-mono text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                                          Pool {pool.poolId}
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-sand-200 dark:border-stone-700 oled:border-gray-900 transition-colors duration-200 oled:transition-none">
                                          <div className="text-[10px] text-dune-600 dark:text-stone-300 leading-tight transition-colors duration-200 oled:transition-none">
                                            In: {poolInputDisplay} {displayInputToken?.symbol || fromTokenInfo?.symbol || ''}
                                          </div>
                                          <div className="text-[10px] text-dune-600 dark:text-stone-300 leading-tight transition-colors duration-200 oled:transition-none">
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
                            <div className="bg-gradient-to-br from-primary-500 to-primary-600 oled:from-gray-800 oled:to-gray-800 text-white rounded-lg px-2 py-1.5 shadow-md oled:shadow-none min-w-[110px] h-[70px] flex flex-col justify-center text-center">
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
                            className="flex justify-between items-center py-2 border-b border-sand-200 dark:border-stone-700 oled:border-gray-900 last:border-b-0 transition-colors duration-200 oled:transition-none"
                          >
                            <span className="text-sm font-medium text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                              {route.label}
                            </span>
                            <span className="text-sm font-mono text-dune-800 dark:text-stone-100 oled:text-gray-400 oled:font-semibold transition-colors duration-200 oled:transition-none">
                              {parseFloat(route.amountOut).toFixed(6)}{' '}
                              {toTokenInfo?.symbol || toToken}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
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
                    <p className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal mb-3 transition-colors duration-200 oled:transition-none">
                      Connect your wallet to execute the swap
                    </p>
                    <button
                      onClick={onConnectWallet}
                      className="btn-primary w-full"
                    >
                      Connect Wallet
                    </button>
                    <p className="text-xs text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal mt-2 text-center transition-colors duration-200 oled:transition-none">
                      Supported: Voi Wallet, Lute Wallet, and other Algorand
                      wallets
                    </p>
                  </div>
                ) : unsignedTransactions.length === 0 ? (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">Connected:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-dune-800 dark:text-stone-100 oled:text-gray-400 oled:font-semibold transition-colors duration-200 oled:transition-none">
                          {displayAddress
                            ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                            : 'Connected'}
                        </span>
                        <button
                          onClick={handleDisconnect}
                          className="text-dune-500 dark:text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-sand-200 dark:hover:bg-stone-700 oled:hover:bg-black"
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
                    <p className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal mb-3 transition-colors duration-200 oled:transition-none">
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
                      <span className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">Connected:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-dune-800 dark:text-stone-100 oled:text-gray-400 oled:font-semibold transition-colors duration-200 oled:transition-none">
                          {displayAddress
                            ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                            : 'Connected'}
                        </span>
                        <button
                          onClick={handleDisconnect}
                          className="text-dune-500 dark:text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-sand-200 dark:hover:bg-stone-700 oled:hover:bg-black"
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
                    <p className="text-xs text-amber-600 dark:text-amber-500 mb-3 text-center font-medium transition-colors duration-200 oled:transition-none">
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
                    <p className="text-xs text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal mt-2 text-center transition-colors duration-200 oled:transition-none">
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
              <p className="text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
                Pick tokens, enter an amount, and let Ally find the best route.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-8 pb-8 border-t-2 border-sand-300 dark:border-stone-700 oled:border-gray-900 bg-sand-50/50 dark:bg-stone-800 oled:bg-black oled:shadow-none/50 backdrop-blur-sm transition-colors duration-200 oled:transition-none">
        <div className="max-w-2xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
          <div className="text-center sm:text-left">
            <p className="text-dune-700 dark:text-stone-300 oled:text-gray-500 oled:font-normal font-medium mb-1 transition-colors duration-200 oled:transition-none">
              Ally - Simple & intuitive DEX aggregator for Voi
            </p>
            <p className="text-sm text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal transition-colors duration-200 oled:transition-none">
              Powered by{' '}
              <a
                href="https://voi.humble.sh/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal hover:text-dune-800 dark:hover:text-stone-200 underline transition-colors"
              >
                HumbleSwap
              </a>
              {' & '}
              <a
                href="https://voi.nomadex.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal hover:text-dune-800 dark:hover:text-stone-200 underline transition-colors"
              >
                Nomadex
              </a>
              {' • '}
              <a
                href="https://voi.network/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dune-600 dark:text-stone-400 oled:text-gray-600 oled:font-normal hover:text-dune-800 dark:hover:text-stone-200 underline transition-colors"
              >
                About Voi
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
