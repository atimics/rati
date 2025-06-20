import React, { createContext, useContext } from 'react';

/**
 * Wallet Context for providing wallet state across the app
 */
export const WalletContext = createContext(null);

/**
 * Hook to use wallet context
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
