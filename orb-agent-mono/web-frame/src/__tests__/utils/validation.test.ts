import { describe, it, expect } from 'vitest';
import {
  validateWalletAddress,
  validateOrbId,
  validateTransactionHash,
  validateAmount,
  validateMerkleProof,
  validateChainId,
  validateAgentIndex,
  validateMintRequest,
  ValidationError,
} from '../../utils/validation';

describe('Validation Utils', () => {
  describe('validateWalletAddress', () => {
    it('validates Solana addresses correctly', () => {
      const validSolanaAddress = '11111111111111111111111111111112';
      const invalidSolanaAddress = 'invalid-address';
      
      expect(validateWalletAddress(validSolanaAddress, 'solana')).toBe(true);
      expect(validateWalletAddress(invalidSolanaAddress, 'solana')).toBe(false);
    });

    it('validates EVM addresses correctly', () => {
      const validEvmAddress = '0x1234567890123456789012345678901234567890';
      const invalidEvmAddress = '0xinvalid';
      
      expect(validateWalletAddress(validEvmAddress, 'base')).toBe(true);
      expect(validateWalletAddress(invalidEvmAddress, 'base')).toBe(false);
    });

    it('handles empty addresses', () => {
      expect(validateWalletAddress('', 'solana')).toBe(false);
      expect(validateWalletAddress('', 'base')).toBe(false);
    });
  });

  describe('validateOrbId', () => {
    it('validates Solana orb IDs', () => {
      const validOrbId = '11111111111111111111111111111112';
      const invalidOrbId = 'invalid';
      
      expect(validateOrbId(validOrbId, 'solana')).toBe(true);
      expect(validateOrbId(invalidOrbId, 'solana')).toBe(false);
    });

    it('validates EVM orb IDs', () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      const validTokenId = '12345';
      const invalidId = 'invalid';
      
      expect(validateOrbId(validAddress, 'base')).toBe(true);
      expect(validateOrbId(validTokenId, 'base')).toBe(true);
      expect(validateOrbId(invalidId, 'base')).toBe(false);
    });

    it('handles empty orb IDs', () => {
      expect(validateOrbId('', 'solana')).toBe(false);
      expect(validateOrbId('   ', 'base')).toBe(false);
    });
  });

  describe('validateTransactionHash', () => {
    it('validates Solana transaction hashes', () => {
      const validSolanaHash = '1111111111111111111111111111111111111111111111111111111111111111111111111111111111111';
      const invalidSolanaHash = 'invalid-hash';
      
      expect(validateTransactionHash(validSolanaHash, 'solana')).toBe(true);
      expect(validateTransactionHash(invalidSolanaHash, 'solana')).toBe(false);
    });

    it('validates EVM transaction hashes', () => {
      const validEvmHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const invalidEvmHash = '0xinvalid';
      
      expect(validateTransactionHash(validEvmHash, 'base')).toBe(true);
      expect(validateTransactionHash(invalidEvmHash, 'base')).toBe(false);
    });

    it('handles empty hashes', () => {
      expect(validateTransactionHash('', 'solana')).toBe(false);
      expect(validateTransactionHash('', 'base')).toBe(false);
    });
  });

  describe('validateAmount', () => {
    it('validates positive numbers', () => {
      expect(validateAmount(100)).toBe(true);
      expect(validateAmount('100.5')).toBe(true);
      expect(validateAmount(0.001)).toBe(true);
    });

    it('rejects invalid amounts', () => {
      expect(validateAmount(0)).toBe(false);
      expect(validateAmount(-100)).toBe(false);
      expect(validateAmount('invalid')).toBe(false);
      expect(validateAmount(NaN)).toBe(false);
      expect(validateAmount(Infinity)).toBe(false);
    });
  });

  describe('validateMerkleProof', () => {
    it('validates correct merkle proofs', () => {
      const validProof = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      ];
      
      expect(validateMerkleProof(validProof)).toBe(true);
    });

    it('rejects invalid merkle proofs', () => {
      const invalidProof = ['0xinvalid', 'not-hex'];
      const notArray = 'not-an-array';
      
      expect(validateMerkleProof(invalidProof)).toBe(false);
      expect(validateMerkleProof(notArray as any)).toBe(false);
    });

    it('accepts empty arrays', () => {
      expect(validateMerkleProof([])).toBe(true);
    });
  });

  describe('validateChainId', () => {
    it('validates Solana chain ID', () => {
      expect(validateChainId(1, 'solana')).toBe(true);
      expect(validateChainId(8453, 'solana')).toBe(false);
    });

    it('validates Base chain IDs', () => {
      expect(validateChainId(8453, 'base')).toBe(true); // Base mainnet
      expect(validateChainId(84532, 'base')).toBe(true); // Base testnet
      expect(validateChainId(1, 'base')).toBe(false);
    });
  });

  describe('validateAgentIndex', () => {
    it('validates correct agent indices', () => {
      expect(validateAgentIndex(0)).toBe(true);
      expect(validateAgentIndex(4444)).toBe(true);
      expect(validateAgentIndex(8887)).toBe(true);
    });

    it('rejects invalid agent indices', () => {
      expect(validateAgentIndex(-1)).toBe(false);
      expect(validateAgentIndex(8888)).toBe(false);
      expect(validateAgentIndex(10000)).toBe(false);
      expect(validateAgentIndex(1.5)).toBe(false);
      expect(validateAgentIndex(NaN)).toBe(false);
    });
  });

  describe('validateMintRequest', () => {
    it('validates correct mint requests', () => {
      const validRequest = {
        orbId: '11111111111111111111111111111112',
        targetChain: 'solana' as const,
        userAddress: '11111111111111111111111111111112',
      };
      
      expect(() => validateMintRequest(validRequest)).not.toThrow();
    });

    it('throws ValidationError for invalid orb ID', () => {
      const invalidRequest = {
        orbId: 'invalid',
        targetChain: 'solana' as const,
        userAddress: '11111111111111111111111111111112',
      };
      
      expect(() => validateMintRequest(invalidRequest))
        .toThrow(ValidationError);
      
      try {
        validateMintRequest(invalidRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('Invalid Orb ID');
        expect((error as ValidationError).field).toBe('orbId');
      }
    });

    it('throws ValidationError for invalid wallet address', () => {
      const invalidRequest = {
        orbId: '11111111111111111111111111111112',
        targetChain: 'solana' as const,
        userAddress: 'invalid',
      };
      
      expect(() => validateMintRequest(invalidRequest))
        .toThrow(ValidationError);
    });

    it('throws ValidationError for invalid chain', () => {
      const invalidRequest = {
        orbId: '11111111111111111111111111111112',
        targetChain: 'invalid' as any,
        userAddress: '11111111111111111111111111111112',
      };
      
      expect(() => validateMintRequest(invalidRequest))
        .toThrow(ValidationError);
    });
  });
});