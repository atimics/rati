import type { AppConfig } from '../types';

export const config: AppConfig = {
  chains: {
    solana: {
      rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || 'http://localhost:8899',
      cluster: (import.meta.env.VITE_SOLANA_CLUSTER as 'devnet' | 'mainnet-beta' | 'localnet') || 'localnet',
    },
    base: {
      rpcUrl: import.meta.env.VITE_EVM_RPC_URL || 'http://localhost:8545',
      chainId: parseInt(import.meta.env.VITE_BASE_CHAIN_ID || '8453'),
    },
  },
  contracts: {
    solana: {
      orbForge: import.meta.env.VITE_ORB_FORGE_PROGRAM_ID || 'FoRGe11111111111111111111111111111111111111',
      rariMint: import.meta.env.VITE_RARI_TOKEN_MINT || '11111111111111111111111111111112',
      wormholeBridge: import.meta.env.VITE_SOLANA_WORMHOLE_BRIDGE || 'Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o',
    },
    base: {
      agentReceiver: import.meta.env.VITE_AGENT_RECEIVER_CONTRACT || '0x0000000000000000000000000000000000000000',
      wormholeCore: import.meta.env.VITE_BASE_WORMHOLE_CORE || '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627',
    },
  },
  arweave: {
    gateway: import.meta.env.VITE_ARWEAVE_GATEWAY || 'https://arweave.net',
  },
  wormhole: {
    rpcUrl: import.meta.env.VITE_WORMHOLE_RPC_URL || 'http://localhost:7071',
  },
  rateLimit: {
    windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX_REQUESTS || '100'),
  },
};

export const CHAIN_CONFIGS = {
  solana: {
    name: 'Solana',
    chainId: 1, // Wormhole chain ID
    rpcUrl: config.chains.solana.rpcUrl,
    explorerUrl: config.chains.solana.cluster === 'mainnet-beta' 
      ? 'https://solscan.io' 
      : 'https://solscan.io/?cluster=devnet',
    nativeCurrency: {
      name: 'SOL',
      symbol: 'SOL',
      decimals: 9,
    },
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: config.chains.base.rpcUrl,
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
} as const;

export const MERKLE_ROOT = import.meta.env.VITE_MERKLE_ROOT || '0x0000000000000000000000000000000000000000000000000000000000000000';
export const TOTAL_AGENTS = parseInt(import.meta.env.VITE_TOTAL_AGENTS || '8888');

export const RARI_THRESHOLD = 100; // 100 RARI tokens required
export const LEGENDARY_THRESHOLD = 88; // First 88 agents are legendary

export const API_ENDPOINTS = {
  agents: '/api/agents',
  orbs: '/api/orbs',
  transactions: '/api/transactions',
  stats: '/api/stats',
} as const;

export const STORAGE_KEYS = {
  WALLET_CONNECTION: 'orb_agent_wallet',
  USER_PREFERENCES: 'orb_agent_prefs',
  SESSION_ID: 'orb_agent_session',
} as const;

export const ERROR_CODES = {
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_ORB: 'INVALID_ORB',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export const TRANSACTION_TIMEOUTS = {
  SOLANA: 60000, // 60 seconds
  BASE: 120000,  // 2 minutes
  WORMHOLE: 300000, // 5 minutes for cross-chain
} as const;