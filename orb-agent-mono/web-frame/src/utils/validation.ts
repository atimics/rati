import { PublicKey } from '@solana/web3.js';
import { isAddress } from 'viem';
import type { ChainType } from '../types';

export function validateWalletAddress(address: string, chain: ChainType): boolean {
  try {
    if (chain === 'solana') {
      new PublicKey(address);
      return true;
    } else {
      return isAddress(address);
    }
  } catch {
    return false;
  }
}

export function validateOrbId(orbId: string, chain: ChainType): boolean {
  if (!orbId || orbId.trim().length === 0) {
    return false;
  }

  if (chain === 'solana') {
    try {
      new PublicKey(orbId);
      return true;
    } catch {
      return false;
    }
  } else {
    // For EVM chains, check if it's a valid token ID or address
    return /^(0x[a-fA-F0-9]{40}|[0-9]+)$/.test(orbId);
  }
}

export function validateTransactionHash(hash: string, chain: ChainType): boolean {
  if (!hash || hash.trim().length === 0) {
    return false;
  }

  if (chain === 'solana') {
    // Solana transaction signatures are base58 encoded strings, usually 87-88 characters
    return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(hash);
  } else {
    // EVM transaction hashes are 32-byte hex strings
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }
}

export function validateAmount(amount: string | number, decimals: number = 18): boolean {
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return !isNaN(num) && num > 0 && num < Number.MAX_SAFE_INTEGER;
  } catch {
    return false;
  }
}

export function validateMerkleProof(proof: string[]): boolean {
  if (!Array.isArray(proof)) {
    return false;
  }

  return proof.every(hash => /^0x[a-fA-F0-9]{64}$/.test(hash));
}

export function validateChainId(chainId: number, expectedChain: ChainType): boolean {
  if (expectedChain === 'solana') {
    return chainId === 1; // Wormhole chain ID for Solana
  } else if (expectedChain === 'base') {
    return chainId === 8453 || chainId === 84532; // Base mainnet or testnet
  }
  return false;
}

export function sanitizeString(input: string, maxLength: number = 255): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>'"&]/g, ''); // Basic XSS protection
}

export function validateURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'ar:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

export function validateAgentIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < 8888;
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateMintRequest(request: {
  orbId: string;
  targetChain: ChainType;
  userAddress: string;
}): void {
  if (!validateOrbId(request.orbId, 'solana')) {
    throw new ValidationError('Invalid Orb ID', 'orbId');
  }

  if (!validateWalletAddress(request.userAddress, request.targetChain)) {
    throw new ValidationError('Invalid wallet address', 'userAddress');
  }

  if (!['solana', 'base'].includes(request.targetChain)) {
    throw new ValidationError('Invalid target chain', 'targetChain');
  }
}