import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectorProvider } from 'wagmi';
import { injected, metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { config as appConfig } from '../config';

// Configure chains based on environment
const chains = process.env.NODE_ENV === 'production' 
  ? [base] 
  : [baseSepolia, base];

// Configure connectors
const connectors = [
  injected(),
  metaMask(),
  coinbaseWallet({ appName: 'Orb Agent Forge' }),
  walletConnect({
    projectId: process.env.VITE_WALLETCONNECT_PROJECT_ID || 'orb-agent-project-id',
  }),
];

// Create wagmi config
const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [base.id]: http(appConfig.chains.base.rpcUrl),
    [baseSepolia.id]: http(appConfig.chains.base.rpcUrl),
  },
});

// Create query client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

interface EthereumProviderProps {
  children: React.ReactNode;
}

export function EthereumProvider({ children }: EthereumProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}