import { useWallet } from '@txnlab/use-wallet-react';
import { useState } from 'react';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletType: 'pera' | 'defly' | 'other') => Promise<void>;
  error?: string | null;
}

export default function WalletConnectModal({
  isOpen,
  onClose,
  onConnect,
  error,
}: WalletConnectModalProps) {
  const { wallets, activeWallet } = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleWalletClick = async (wallet: any) => {
    setConnecting(true);
    setConnectingWalletId(wallet.id);
    try {
      // Use the wallet's connect method if available
      if (wallet.connect) {
        await wallet.connect();
      } else {
        // Fallback to parent's onConnect handler
        const walletType = wallet.id.toLowerCase().includes('pera') 
          ? 'pera' 
          : wallet.id.toLowerCase().includes('defly')
          ? 'defly'
          : 'other';
        await onConnect(walletType);
      }
      onClose();
    } catch (err) {
      // Error handling is done in parent
    } finally {
      setConnecting(false);
      setConnectingWalletId(null);
    }
  };

  const getWalletIcon = (wallet: any) => {
    // Use metadata icon if available
    if (wallet.metadata && wallet.metadata.icon) {
      return wallet.metadata.icon;
    }
    // Fallback to letter-based icon
    const walletId = wallet.id || '';
    const id = walletId.toLowerCase();
    if (id.includes('pera')) return 'P';
    if (id.includes('defly')) return 'D';
    if (id.includes('lute')) return 'L';
    return walletId.charAt(0).toUpperCase();
  };

  const getWalletColor = (walletId: string) => {
    const id = walletId.toLowerCase();
    if (id.includes('pera')) return 'from-blue-500 to-blue-600';
    if (id.includes('defly')) return 'from-purple-500 to-purple-600';
    if (id.includes('lute')) return 'from-green-500 to-green-600';
    return 'from-gray-500 to-gray-600';
  };

  const hasMetadataIcon = (wallet: any) => {
    return wallet.metadata && wallet.metadata.icon;
  };

  const getWalletDescription = (wallet: any) => {
    const isConnected = activeWallet?.id === wallet.id;
    
    if (isConnected) {
      return 'Connected';
    }
    // Assume wallet is available if it's in the wallets list
    return 'Available';
  };

  const getWalletName = (wallet: any) => {
    // Try to get name from metadata, id, or use a formatted version
    if (wallet.metadata && 'name' in wallet.metadata) {
      return wallet.metadata.name as string;
    }
    // Format the wallet ID to a readable name
    const id = wallet.id || '';
    return id
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Unknown Wallet';
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Connect Wallet</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={connecting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Select a wallet to connect to your account
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          {wallets && wallets.length > 0 ? (
            wallets.map((wallet) => {
              const isConnecting = connecting && connectingWalletId === wallet.id;
              const isActive = activeWallet?.id === wallet.id;
              // Wallets in the list are considered available
              const isDisabled = connecting;

              return (
                <button
                  key={wallet.id}
                  onClick={() => handleWalletClick(wallet)}
                  disabled={isDisabled}
                  className={`w-full flex items-center justify-between p-4 border-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-500 hover:bg-primary-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {hasMetadataIcon(wallet) ? (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                        <img
                          src={getWalletIcon(wallet)}
                          alt={getWalletName(wallet)}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 bg-gradient-to-br ${getWalletColor(
                          wallet.id
                        )} rounded-lg flex items-center justify-center text-white font-bold`}
                      >
                        {getWalletIcon(wallet)}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {getWalletName(wallet)}
                        {isActive && (
                          <span className="ml-2 text-xs text-primary-600">(Connected)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getWalletDescription(wallet)}
                      </div>
                    </div>
                  </div>
                  {isConnecting ? (
                    <svg
                      className="animate-spin h-5 w-5 text-primary-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </button>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No wallets available</p>
              <p className="text-xs mt-2">
                Please install a compatible wallet extension
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Don't have a wallet?{' '}
            <a
              href="https://www.getvoi.app/#download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              Download Voi Wallet
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

