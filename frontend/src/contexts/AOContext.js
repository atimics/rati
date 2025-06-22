import { createContext, useContext } from 'react';

/**
 * AO Context for managing AO process connections
 */
export const AOContext = createContext();

export const useAO = () => {
  const context = useContext(AOContext);
  if (!context) {
    throw new Error('useAO must be used within an AOProvider');
  }
  return context;
};
