import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
vi.mock('../config', () => ({
  config: {
    chains: {
      solana: {
        rpcUrl: 'http://localhost:8899',
        cluster: 'localnet',
      },
      base: {
        rpcUrl: 'http://localhost:8545',
        chainId: 8453,
      },
    },
    contracts: {
      solana: {
        orbForge: 'FoRGe11111111111111111111111111111111111111',
        rariMint: '11111111111111111111111111111112',
        wormholeBridge: 'Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o',
      },
      base: {
        agentReceiver: '0x0000000000000000000000000000000000000000',
        wormholeCore: '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627',
      },
    },
    arweave: {
      gateway: 'https://arweave.net',
    },
    wormhole: {
      rpcUrl: 'http://localhost:7071',
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100,
    },
  },
  CHAIN_CONFIGS: {
    solana: {
      name: 'Solana',
      chainId: 1,
      rpcUrl: 'http://localhost:8899',
      explorerUrl: 'https://solscan.io',
      nativeCurrency: {
        name: 'SOL',
        symbol: 'SOL',
        decimals: 9,
      },
    },
    base: {
      name: 'Base',
      chainId: 8453,
      rpcUrl: 'http://localhost:8545',
      explorerUrl: 'https://basescan.org',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
    },
  },
  MERKLE_ROOT: '0x0000000000000000000000000000000000000000000000000000000000000000',
  TOTAL_AGENTS: 8888,
  RARI_THRESHOLD: 100,
  ERROR_CODES: {
    WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    INVALID_ORB: 'INVALID_ORB',
    TRANSACTION_FAILED: 'TRANSACTION_FAILED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('sessionStorage', sessionStorageMock);

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    search: '',
    origin: 'http://localhost:3000',
  },
  writable: true,
});

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Set up process.env for tests
process.env.NODE_ENV = 'test';
process.env.VITE_SOLANA_RPC_URL = 'http://localhost:8899';
process.env.VITE_EVM_RPC_URL = 'http://localhost:8545';

// Mock crypto.randomUUID for browsers that don't support it
if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto;
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock MutationObserver for analytics
global.MutationObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
})) as any;