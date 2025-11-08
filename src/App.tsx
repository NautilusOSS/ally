import { useState, useEffect } from 'react';
import {
  loadTokensConfig,
  loadApiConfig,
  loadAppConfig,
  loadPoolsConfig,
  type TokenConfig,
  type ApiConfig,
  type AppConfig,
  type PoolConfig,
} from './lib/config';
import {
  WalletProvider,
  WalletManager,
  WalletId,
  NetworkConfigBuilder,
} from '@txnlab/use-wallet-react';
import WalletConnectModal from './components/WalletConnectModal';
import SwapInterface from './components/SwapInterface';

function App() {
  const [tokens, setTokens] = useState<TokenConfig[]>([]);
  const [allTokens, setAllTokens] = useState<TokenConfig[]>([]); // All available tokens
  const [pools, setPools] = useState<PoolConfig[]>([]);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [fromToken, setFromToken] = useState('0'); // Use tokenId as default
  const [toToken, setToToken] = useState('302190'); // Use tokenId as default
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [fromTokenInfo, setFromTokenInfo] = useState<TokenConfig | null>(null);
  const [toTokenInfo, setToTokenInfo] = useState<TokenConfig | null>(null);
  const [availablePools, setAvailablePools] = useState<PoolConfig[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const networks = new NetworkConfigBuilder()
    .addNetwork('voi-mainnet', {
      algod: {
        token: '',
        baseServer: 'https://mainnet-api.voi.nodely.dev',
        port: '',
      },
      isTestnet: false,
      genesisHash: 'r20fSQI8gWe/kFZziNonSPCXLwcQmH/nxROvnnueWOk=',
      genesisId: 'voimain-v1.0',
      caipChainId: 'algorand:r20fSQI8gWe_kFZziNonSPCXLwcQmH_n',
    })
    .build();

  const manager = new WalletManager({
    wallets: [WalletId.LUTE],
    networks,
    defaultNetwork: 'voi-mainnet',
  });

  // Load configs on mount
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const [tokensData, poolsData, apiData, appData] = await Promise.all([
          loadTokensConfig(),
          loadPoolsConfig(),
          loadApiConfig(),
          loadAppConfig(),
        ]);
        setAllTokens(tokensData);
        setPools(poolsData);
        setApiConfig(apiData);
        setAppConfig(appData);

        // Get unique token IDs from pools
        const tokenIdsInPools = new Set<string>();
        poolsData.forEach((pool) => {
          // Handle humbleswap pools
          if (pool.tokens.underlyingToWrapped) {
            Object.keys(pool.tokens.underlyingToWrapped).forEach((id) =>
              tokenIdsInPools.add(id)
            );
            if (pool.tokens.wrappedPair) {
              tokenIdsInPools.add(pool.tokens.wrappedPair.tokA.toString());
              tokenIdsInPools.add(pool.tokens.wrappedPair.tokB.toString());
            }
          }
          // Handle nomadex pools
          if (pool.tokens.tokA)
            tokenIdsInPools.add(pool.tokens.tokA.id.toString());
          if (pool.tokens.tokB)
            tokenIdsInPools.add(pool.tokens.tokB.id.toString());
        });

        // Filter tokens based on whitelist (if provided) or pool availability
        let availableTokens = tokensData;
        
        // Apply whitelist if configured
        if (appData.tokenWhitelist && appData.tokenWhitelist.length > 0) {
          const whitelistSet = new Set(
            appData.tokenWhitelist.map((item) => item.toLowerCase())
          );
          availableTokens = tokensData.filter(
            (t) =>
              whitelistSet.has(t.tokenId.toLowerCase()) ||
              whitelistSet.has(t.symbol.toLowerCase())
          );
        } else {
          // If no whitelist, filter by pool availability
          availableTokens = tokensData.filter((t) =>
            tokenIdsInPools.has(t.tokenId)
          );
        }
        
        setTokens(availableTokens);

        // Set default token info
        const defaultFrom = availableTokens.find(
          (t) => t.tokenId === '0' || t.symbol === 'VOI'
        );
        const defaultTo = availableTokens.find(
          (t) => t.tokenId === '302190' || t.symbol === 'USDC'
        );
        if (defaultFrom) setFromTokenInfo(defaultFrom);
        if (defaultTo) setToTokenInfo(defaultTo);
      } catch (err) {
        console.error('Failed to load configs:', err);
        setError('Failed to load configuration');
      }
    };
    loadConfigs();
  }, []);

  // Update available pools when tokens change
  useEffect(() => {
    if (!fromTokenInfo || !toTokenInfo || !pools.length) {
      setAvailablePools([]);
      return;
    }

    const fromId = parseInt(fromTokenInfo.tokenId);
    const toId = parseInt(toTokenInfo.tokenId);

    const matchingPools = pools.filter((pool) => {
      // Check humbleswap pools
      if (pool.tokens.underlyingToWrapped) {
        // Collect all token IDs that can be used in this pool
        const tokenIds = new Set<number>();
        
        // Add underlying token IDs (keys of underlyingToWrapped)
        Object.keys(pool.tokens.underlyingToWrapped).forEach((id) => {
          tokenIds.add(Number(id));
        });
        
        // Add wrapped pair token IDs
        if (pool.tokens.wrappedPair) {
          tokenIds.add(pool.tokens.wrappedPair.tokA);
          tokenIds.add(pool.tokens.wrappedPair.tokB);
        }
        
        // Check if both from and to tokens are in the pool
        return tokenIds.has(fromId) && tokenIds.has(toId);
      }
      // Check nomadex pools
      if (pool.tokens.tokA && pool.tokens.tokB) {
        const tokAId = pool.tokens.tokA.id;
        const tokBId = pool.tokens.tokB.id;
        return (
          (tokAId === fromId && tokBId === toId) ||
          (tokAId === toId && tokBId === fromId)
        );
      }
      return false;
    });

    setAvailablePools(matchingPools);
    // Auto-select first pool if only one available
    if (matchingPools.length === 1) {
      setSelectedPoolId(matchingPools[0].poolId);
    } else {
      setSelectedPoolId(null);
    }
  }, [fromTokenInfo, toTokenInfo, pools]);

  const handleWalletConnect = async (walletType: 'pera' | 'defly' | 'other') => {
    try {
      if (typeof window === 'undefined' || !(window as any).algorand) {
        throw new Error(
          walletType === 'pera'
            ? 'Pera Wallet not found. Please install the Pera Wallet extension.'
            : walletType === 'defly'
            ? 'Defly Wallet not found. Please install the Defly Wallet extension.'
            : 'No Algorand wallet found. Please install Pera Wallet, Defly Wallet, or another Algorand wallet extension.'
        );
      }

      const wallet = (window as any).algorand;
      const accounts = await wallet.connect({
        genesisHash: undefined, // Voi network
      });

      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to connect ${walletType === 'pera' ? 'Pera' : walletType === 'defly' ? 'Defly' : ''} Wallet`
      );
      throw err; // Re-throw so modal can handle it
    }
  };

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempTokenInfo = fromTokenInfo;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromTokenInfo(toTokenInfo);
    setToTokenInfo(tempTokenInfo);
  };

  const handleFromTokenChange = (tokenId: string) => {
    setFromToken(tokenId);
    const token = tokens.find(
      (t) =>
        t.tokenId === tokenId ||
        t.address === tokenId ||
        t.symbol === tokenId
    );
    if (token) setFromTokenInfo(token);
  };

  const handleToTokenChange = (tokenId: string) => {
    setToToken(tokenId);
    const token = tokens.find(
      (t) =>
        t.tokenId === tokenId ||
        t.address === tokenId ||
        t.symbol === tokenId
    );
    if (token) setToTokenInfo(token);
  };

  return (
    <WalletProvider manager={manager}>
      <SwapInterface
        tokens={tokens}
        fromToken={fromToken}
        toToken={toToken}
        fromTokenInfo={fromTokenInfo}
        toTokenInfo={toTokenInfo}
        onFromTokenChange={handleFromTokenChange}
        onToTokenChange={handleToTokenChange}
        onSwapTokens={handleSwapTokens}
        amount={amount}
        onAmountChange={setAmount}
        availablePools={availablePools}
        selectedPoolId={selectedPoolId}
        onPoolChange={setSelectedPoolId}
        apiConfig={apiConfig}
        appConfig={appConfig}
        showCompare={showCompare}
        onToggleCompare={() => setShowCompare(!showCompare)}
        walletAddress={walletAddress}
        onConnectWallet={() => setShowWalletModal(true)}
      />

      {/* Wallet Selection Modal */}
      <WalletConnectModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
        error={error}
      />
    </WalletProvider>
  );
}

export default App;

