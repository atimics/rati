import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useChain } from '../hooks/useChain';
import { trackEvent } from '../utils/analytics';
import { useEffect } from 'react';

export function WalletConnect() {
  const { selectedChain } = useChain();
  const { connected: solanaConnected, publicKey } = useWallet();
  const { isConnected: evmConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    // Track wallet connection status
    const isConnected = selectedChain === 'solana' ? solanaConnected : evmConnected;
    const walletAddress = selectedChain === 'solana' ? publicKey?.toString() : address;

    if (isConnected && walletAddress) {
      trackEvent('wallet_connected', {
        chain: selectedChain,
        address: walletAddress,
      });
    }
  }, [selectedChain, solanaConnected, evmConnected, publicKey, address]);

  if (selectedChain === 'solana') {
    return (
      <div className="wallet-connect solana">
        <WalletMultiButton />
        {solanaConnected && publicKey && (
          <div className="wallet-info">
            <span className="wallet-address">
              {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // EVM wallet connection
  return (
    <div className="wallet-connect evm">
      {evmConnected ? (
        <div className="wallet-connected">
          <div className="wallet-info">
            <span className="wallet-address">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          </div>
          <button 
            className="btn btn-secondary disconnect-btn"
            onClick={() => disconnect()}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="wallet-options">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              className="btn btn-primary connect-btn"
              onClick={() => connect({ connector })}
              disabled={!connector.ready}
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}