import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { MintRequest, TransactionResult, AgentData } from '../types';
import { mintAgentSolana } from '../services/solana';
import { mintAgentEVM } from '../services/evm';
import { getAgentData } from '../services/agents';
import { trackEvent } from '../utils/analytics';

export function useMintAgent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Solana wallet
  const { connected: solanaConnected, publicKey, sendTransaction } = useWallet();
  
  // EVM wallet
  const { isConnected: evmConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const mintAgent = useCallback(async (request: MintRequest): Promise<TransactionResult> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Track mint initiation
      trackEvent('mint_initiated', {
        orbId: request.orbId,
        targetChain: request.targetChain,
        userAddress: request.userAddress,
      });

      let result: TransactionResult;

      if (request.targetChain === 'solana') {
        if (!solanaConnected || !publicKey) {
          throw new Error('Solana wallet not connected');
        }

        result = await mintAgentSolana({
          orbId: request.orbId,
          userPublicKey: publicKey,
          sendTransaction,
        });
      } else {
        if (!evmConnected || !address) {
          throw new Error('EVM wallet not connected');
        }

        result = await mintAgentEVM({
          orbId: request.orbId,
          userAddress: address,
          writeContract: writeContractAsync,
        });
      }

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        
        // Track successful mint
        trackEvent('mint_completed', {
          orbId: request.orbId,
          targetChain: request.targetChain,
          txHash: result.txHash,
          agentIndex: result.agentData?.index,
        });
      } else {
        throw new Error(result.error || 'Minting failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Track failed mint
      trackEvent('mint_failed', {
        orbId: request.orbId,
        targetChain: request.targetChain,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [solanaConnected, publicKey, sendTransaction, evmConnected, address, writeContractAsync]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setTxHash(null);
  }, []);

  return {
    mintAgent,
    isLoading,
    error,
    txHash,
    reset,
  };
}