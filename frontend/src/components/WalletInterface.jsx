import React, { useState, useEffect } from 'react';
import { connectWallet, getWalletBalance, waitForArConnect } from '../utils/arweave.js';
import './WalletInterface.css';

const WalletInterface = ({ onWalletConnect, onWalletDisconnect }) => {
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [arConnectAvailable, setArConnectAvailable] = useState(false);

  useEffect(() => {
    // Check for ArConnect availability
    const checkArConnect = async () => {
      try {
        await waitForArConnect(2000);
        setArConnectAvailable(true);
      } catch {
        setArConnectAvailable(false);
      }
    };

    checkArConnect();

    // Listen for ArConnect events
    const handleArConnectConnect = () => {
      setArConnectAvailable(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('arweaveWalletLoaded', handleArConnectConnect);
      window.addEventListener('walletSwitch', handleArConnectConnect);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('arweaveWalletLoaded', handleArConnectConnect);
        window.removeEventListener('walletSwitch', handleArConnectConnect);
      }
    };
  }, [onWalletDisconnect]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const walletConnection = await connectWallet();
      
      if (walletConnection.connected) {
        setWallet(walletConnection);
        
        // Get wallet balance
        const walletBalance = await getWalletBalance(walletConnection.address);
        setBalance(walletBalance);

        if (onWalletConnect) {
          onWalletConnect(walletConnection);
        }
      } else {
        setError(walletConnection.error || 'Failed to connect wallet');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setWallet(null);
    setBalance(null);
    setError(null);
    if (onWalletDisconnect) onWalletDisconnect();
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatBalance = (ar) => {
    return ar < 0.001 ? ar.toFixed(6) : ar.toFixed(3);
  };

  const getErrorMessage = (error) => {
    const errorStr = error.toString().toLowerCase();
    
    if (errorStr.includes('user rejected') || errorStr.includes('denied')) {
      return {
        title: 'Connection Declined',
        message: 'You declined the wallet connection request. Please try again and accept the connection to continue.',
        action: 'Try connecting again'
      };
    } else if (errorStr.includes('no active wallet') || errorStr.includes('no wallet selected')) {
      return {
        title: 'No Wallet Selected',
        message: 'Please select a wallet in ArConnect before connecting.',
        action: 'Open ArConnect and select a wallet'
      };
    } else if (errorStr.includes('not properly signed') || errorStr.includes('signature')) {
      return {
        title: 'Signing Failed',
        message: 'The transaction could not be signed properly. This may be due to a temporary issue with ArConnect.',
        action: 'Please try signing the transaction again'
      };
    } else if (errorStr.includes('insufficient')) {
      return {
        title: 'Insufficient Balance',
        message: 'Your wallet does not have enough AR tokens to complete this transaction.',
        action: 'Add AR tokens to your wallet and try again'
      };
    } else if (errorStr.includes('arconnect') || errorStr.includes('extension')) {
      return {
        title: 'ArConnect Issue',
        message: 'There was an issue communicating with the ArConnect extension.',
        action: 'Try refreshing the page or restarting your browser'
      };
    }
    
    return {
      title: 'Connection Failed',
      message: error.message || 'An unexpected error occurred while connecting to your wallet.',
      action: 'Please try again'
    };
  };

  if (!arConnectAvailable) {
    return (
      <div className="wallet-interface">
        <div className="wallet-status disconnected">
          <div className="wallet-icon">🔒</div>
          <div className="wallet-info">
            <div className="wallet-message">ArConnect Required</div>
            <div className="wallet-subtitle">
              Please install the ArConnect browser extension to connect your Arweave wallet
            </div>
            <a 
              href="https://www.arconnect.io/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="install-link"
            >
              Install ArConnect →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="wallet-interface">
        <div className="wallet-status disconnected">
          <div className="wallet-icon">🔓</div>
          <div className="wallet-info">
            <div className="wallet-message">Wallet Not Connected</div>
            <div className="wallet-subtitle">
              Connect your Arweave wallet to deploy and interact with the permanent web
            </div>
          </div>
          <button 
            className="connect-button"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
        {error && (
          <div className="wallet-error">
            <div className="error-icon">⚠️</div>
            <div className="error-details">
              <div className="error-title">{getErrorMessage(error).title}</div>
              <div className="error-message">{getErrorMessage(error).message}</div>
              <div className="error-action">{getErrorMessage(error).action}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-interface">
      <div className="wallet-status connected">
        <div className="wallet-icon">🔐</div>
        <div className="wallet-info">
          <div className="wallet-address">
            <span className="address-label">Address:</span>
            <span className="address-value">{formatAddress(wallet.address)}</span>
            <button 
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(wallet.address)}
              title="Copy full address"
            >
              📋
            </button>
          </div>
          {balance && (
            <div className="wallet-balance">
              <span className="balance-label">Balance:</span>
              <span className="balance-value">{formatBalance(balance.ar)} AR</span>
            </div>
          )}
        </div>
        <button 
          className="disconnect-button"
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

export default WalletInterface;
