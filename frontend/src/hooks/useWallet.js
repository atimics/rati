import { useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';

/**
 * Custom hook for accessing wallet context
 * Separated from provider to fix Fast Refresh issues
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
