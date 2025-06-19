import React from 'react';
import { useWallet } from '../hooks/useWallet';
import './ModernWalletInterface.css';

/**
 * Modern Wallet Interface
 * 
 * Clean, user-friendly wallet connection interface that replaces
 * the complex existing wallet management with a streamlined UX.
 */

const ModernWalletInterface = () => {
  const { 
    isConnected, 
    isConnecting, 
    needsExtension, 
    connect, 
    disconnect, 
    getFormattedAddress, 
    getFormattedBalance,
    error
  } = useWallet();

  // Extension not available
  if (needsExtension) {
    return (
      <div className="wallet-status extension-needed">
        <div className="wallet-info">
          <span className="wallet-icon">🔒</span>
          <span className="wallet-text">ArConnect Required</span>
        </div>
        <a 
          href="https://www.arconnect.io/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="install-arconnect"
        >
          Install
        </a>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="wallet-status disconnected">
        <div className="wallet-info">
          <span className="wallet-icon">🔓</span>
          <span className="wallet-text">Not Connected</span>
        </div>
        <button 
          className="connect-wallet"
          onClick={connect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <span className="spinner">⏳</span>
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </button>
        {error && (
          <div className="wallet-error">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Connected
  return (
    <div className="wallet-status connected">
      <div className="wallet-info">
        <span className="wallet-icon">🔐</span>
        <div className="wallet-details">
          <div className="wallet-address">{getFormattedAddress()}</div>
          <div className="wallet-balance">{getFormattedBalance()} AR</div>
        </div>
      </div>
      <button className="disconnect-wallet" onClick={disconnect}>
        Disconnect
      </button>
    </div>
  );
};

export default ModernWalletInterface;
