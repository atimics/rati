import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { WalletContext } from './WalletContext';

/**
 * Modern Unified Wallet Context Provider
 * 
 * Replaces the scattered wallet management across multiple components
 * with a single, reliable, user-friendly wallet management system.
 */

const WALLET_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting', 
  CONNECTED: 'connected',
  ERROR: 'error',
  EXTENSION_MISSING: 'extension_missing'
};

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [status, setStatus] = useState(WALLET_STATUS.DISCONNECTED);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);

  // Check for ArConnect availability
  const checkArConnectAvailability = useCallback(() => {
    return typeof window !== 'undefined' && window.arweaveWallet;
  }, []);

  // Initialize wallet state on mount
  useEffect(() => {
    const initializeWallet = async () => {
      if (!checkArConnectAvailability()) {
        setStatus(WALLET_STATUS.EXTENSION_MISSING);
        return;
      }

      // Check if already connected
      try {
        const address = await window.arweaveWallet.getActiveAddress();
        if (address) {
          await handleWalletConnection(address);
        }
      } catch {
        // Not connected, that's fine
        setStatus(WALLET_STATUS.DISCONNECTED);
      }
    };

    initializeWallet();
  }, [checkArConnectAvailability]);

  // Handle successful wallet connection
  const handleWalletConnection = async (address) => {
    try {
      const publicKey = await window.arweaveWallet.getActivePublicKey();
      
      // Get balance (with error handling)
      let walletBalance = null;
      try {
        const arweave = window.arweave || (await import('arweave')).default.init({
          host: 'arweave.net',
          port: 443,
          protocol: 'https'
        });
        
        const winston = await arweave.wallets.getBalance(address);
        const ar = arweave.ar.winstonToAr(winston);
        walletBalance = { winston, ar: parseFloat(ar) };
      } catch (balanceError) {
        console.warn('Could not fetch balance:', balanceError);
        walletBalance = { winston: '0', ar: 0 };
      }

      setWallet({
        address,
        publicKey,
        type: 'arconnect',
        connectedAt: new Date().toISOString()
      });
      setBalance(walletBalance);
      setStatus(WALLET_STATUS.CONNECTED);
      setError(null);
      
      toast.success('Wallet connected successfully!');
    } catch (err) {
      console.error('Error handling wallet connection:', err);
      setError(err.message);
      setStatus(WALLET_STATUS.ERROR);
    }
  };

  // Connect wallet function
  const connect = async () => {
    if (!checkArConnectAvailability()) {
      setStatus(WALLET_STATUS.EXTENSION_MISSING);
      setError('ArConnect extension not found. Please install ArConnect.');
      toast.error('Please install ArConnect extension');
      return;
    }

    setStatus(WALLET_STATUS.CONNECTING);
    setError(null);

    try {
      // Request permissions
      await window.arweaveWallet.connect([
        'ACCESS_ADDRESS',
        'ACCESS_PUBLIC_KEY', 
        'SIGN_TRANSACTION',
        'DISPATCH'
      ]);

      const address = await window.arweaveWallet.getActiveAddress();
      
      if (!address) {
        throw new Error('No active wallet address found. Please select a wallet in ArConnect.');
      }

      await handleWalletConnection(address);
    } catch (err) {
      console.error('Wallet connection failed:', err);
      
      let errorMessage = err.message;
      if (err.message.includes('User rejected')) {
        errorMessage = 'Connection request was declined. Please try again and accept the connection.';
      } else if (err.message.includes('No active wallet')) {
        errorMessage = 'No wallet selected in ArConnect. Please select a wallet and try again.';
      }
      
      setError(errorMessage);
      setStatus(WALLET_STATUS.ERROR);
      toast.error(errorMessage);
    }
  };

  // Disconnect wallet function
  const disconnect = () => {
    setWallet(null);
    setBalance(null);
    setStatus(WALLET_STATUS.DISCONNECTED);
    setError(null);
    toast.success('Wallet disconnected');
  };

  // Sign transaction function
  const signTransaction = async (transaction) => {
    if (!wallet || status !== WALLET_STATUS.CONNECTED) {
      throw new Error('Wallet not connected');
    }

    try {
      const signedTransaction = await window.arweaveWallet.sign(transaction);
      return signedTransaction;
    } catch (err) {
      console.error('Transaction signing failed:', err);
      throw new Error('Transaction signing failed: ' + err.message);
    }
  };

  // Get formatted address for display
  const getFormattedAddress = () => {
    if (!wallet?.address) return '';
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-6)}`;
  };

  // Get formatted balance for display
  const getFormattedBalance = () => {
    if (!balance?.ar) return '0.000';
    return balance.ar < 0.001 ? balance.ar.toFixed(6) : balance.ar.toFixed(3);
  };

  const value = {
    // State
    wallet,
    status,
    balance,
    error,
    
    // Actions
    connect,
    disconnect,
    signTransaction,
    
    // Utilities
    getFormattedAddress,
    getFormattedBalance,
    isConnected: status === WALLET_STATUS.CONNECTED,
    isConnecting: status === WALLET_STATUS.CONNECTING,
    needsExtension: status === WALLET_STATUS.EXTENSION_MISSING,
    
    // Status constants for components
    STATUS: WALLET_STATUS
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
