import { useState, useCallback, useEffect } from 'react';
import type { ChainType } from '../types';
import { STORAGE_KEYS } from '../config';

export function useChain() {
  const [selectedChain, setSelectedChainState] = useState<ChainType>('solana');

  // Load saved chain preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        if (prefs.selectedChain && (prefs.selectedChain === 'solana' || prefs.selectedChain === 'base')) {
          setSelectedChainState(prefs.selectedChain);
        }
      } catch (error) {
        console.warn('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  const setSelectedChain = useCallback((chain: ChainType) => {
    setSelectedChainState(chain);
    
    // Save preference
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      const prefs = existing ? JSON.parse(existing) : {};
      prefs.selectedChain = chain;
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
    } catch (error) {
      console.warn('Failed to save chain preference:', error);
    }
  }, []);

  const switchChain = useCallback(() => {
    const newChain: ChainType = selectedChain === 'solana' ? 'base' : 'solana';
    setSelectedChain(newChain);
  }, [selectedChain, setSelectedChain]);

  return {
    selectedChain,
    setSelectedChain,
    switchChain,
    isSolana: selectedChain === 'solana',
    isBase: selectedChain === 'base',
  };
}