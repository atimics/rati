// Core Types and Interfaces for Orb Agent System

export interface OrbData {
  mint: string;
  name: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  owner: string;
  metadata_uri?: string;
}

export interface AgentData {
  index: number;
  name: string;
  description: string;
  image: string;
  uri: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  rarity: 'Standard' | 'Legendary';
  proof: string[];
}

export interface MintRequest {
  orbId: string;
  targetChain: 'solana' | 'base';
  userAddress: string;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  agentData?: AgentData;
}

export interface WormholeMessage {
  sequence: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: string;
  payload: string;
  consistencyLevel: number;
}

export interface VAA {
  version: number;
  guardianSetIndex: number;
  signatures: Array<{
    guardianIndex: number;
    signature: string;
  }>;
  timestamp: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: string;
  sequence: number;
  consistencyLevel: number;
  payload: string;
}

export type ChainType = 'solana' | 'base';

export type TransactionStatus = 'idle' | 'pending' | 'success' | 'error';

export interface ContractAddresses {
  solana: {
    orbForge: string;
    rariMint: string;
    wormholeBridge: string;
  };
  base: {
    agentReceiver: string;
    wormholeCore: string;
  };
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface AppConfig {
  chains: {
    solana: {
      rpcUrl: string;
      cluster: 'devnet' | 'mainnet-beta' | 'localnet';
    };
    base: {
      rpcUrl: string;
      chainId: number;
    };
  };
  contracts: ContractAddresses;
  arweave: {
    gateway: string;
  };
  wormhole: {
    rpcUrl: string;
  };
  rateLimit: RateLimitConfig;
}

export interface FrameContext {
  isFrame: boolean;
  frameData?: {
    fid?: number;
    castId?: {
      fid: number;
      hash: string;
    };
    messageBytes?: string;
  };
}

export interface WalletConnectionState {
  isConnected: boolean;
  address?: string;
  balance?: number;
  rariBalance?: number;
}

export interface MintingState {
  step: 'select' | 'confirm' | 'minting' | 'success' | 'error';
  selectedOrb?: OrbData;
  error?: string;
  txHash?: string;
  agentData?: AgentData;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ErrorWithCode extends Error {
  code?: string;
  details?: any;
}

// Event types for analytics and monitoring
export interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

export type EventType = 
  | 'orb_selected'
  | 'chain_switched' 
  | 'wallet_connected'
  | 'mint_initiated'
  | 'mint_completed'
  | 'mint_failed'
  | 'page_viewed'
  | 'error_occurred';

// MongoDB document interfaces
export interface AgentDocument {
  _id?: string;
  index: number;
  orbMint: string;
  agentData: AgentData;
  transactionHash: string;
  chainId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument {
  _id?: string;
  address: string;
  chainType: ChainType;
  totalMinted: number;
  lastActivity: Date;
  createdAt: Date;
}

export interface TransactionDocument {
  _id?: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  createdAt: Date;
  updatedAt: Date;
}