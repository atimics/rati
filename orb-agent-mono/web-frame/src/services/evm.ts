import { ethers } from 'ethers';
import type { WriteContractParameters } from 'wagmi';
import type { TransactionResult } from '../types';
import { config } from '../config';
import { getAgentData, getAgentProof } from './agents';

// Agent Receiver ABI (simplified)
const AGENT_RECEIVER_ABI = [
  {
    "inputs": [
      { "name": "vaa", "type": "bytes" },
      { "name": "orbIndex", "type": "uint256" },
      { "name": "uri", "type": "string" },
      { "name": "merkleProof", "type": "bytes32[]" }
    ],
    "name": "mintAgent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "orbIndex", "type": "uint256" },
      { "name": "uri", "type": "string" },
      { "name": "merkleProof", "type": "bytes32[]" }
    ],
    "name": "emergencyMint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "tokenId", "type": "uint256" }
    ],
    "name": "tokenURI",
    "outputs": [
      { "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      { "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface MintAgentEVMParams {
  orbId: string;
  userAddress: `0x${string}`;
  writeContract: (args: WriteContractParameters) => Promise<`0x${string}`>;
  vaa?: string; // Wormhole VAA for cross-chain minting
}

export async function mintAgentEVM({
  orbId,
  userAddress,
  writeContract,
  vaa,
}: MintAgentEVMParams): Promise<TransactionResult> {
  try {
    const orbIndex = parseInt(orbId);
    
    // Get agent data and proof
    const agentData = await getAgentData(orbIndex);
    if (!agentData) {
      throw new Error(`Agent data not found for orb index ${orbIndex}`);
    }
    
    const proof = await getAgentProof(orbIndex);
    if (!proof) {
      throw new Error(`Merkle proof not found for orb index ${orbIndex}`);
    }
    
    let txHash: `0x${string}`;
    
    if (vaa) {
      // Cross-chain minting using Wormhole VAA
      txHash = await writeContract({
        address: config.contracts.base.agentReceiver as `0x${string}`,
        abi: AGENT_RECEIVER_ABI,
        functionName: 'mintAgent',
        args: [vaa as `0x${string}`, BigInt(orbIndex), agentData.uri, proof],
      });
    } else {
      // Emergency/direct minting (for testing or admin use)
      txHash = await writeContract({
        address: config.contracts.base.agentReceiver as `0x${string}`,
        abi: AGENT_RECEIVER_ABI,
        functionName: 'emergencyMint',
        args: [userAddress, BigInt(orbIndex), agentData.uri, proof],
      });
    }
    
    return {
      success: true,
      txHash,
      agentData,
    };
  } catch (error) {
    console.error('EVM minting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getAgentContract() {
  const provider = new ethers.JsonRpcProvider(config.chains.base.rpcUrl);
  return new ethers.Contract(
    config.contracts.base.agentReceiver,
    AGENT_RECEIVER_ABI,
    provider
  );
}

export async function getTotalSupply(): Promise<number> {
  try {
    const contract = await getAgentContract();
    const total = await contract.totalSupply();
    return Number(total);
  } catch (error) {
    console.error('Error getting total supply:', error);
    return 0;
  }
}

export async function getTokenURI(tokenId: number): Promise<string | null> {
  try {
    const contract = await getAgentContract();
    const uri = await contract.tokenURI(tokenId);
    return uri;
  } catch (error) {
    console.error('Error getting token URI:', error);
    return null;
  }
}

export async function isOrbMinted(orbIndex: number): Promise<boolean> {
  try {
    const contract = await getAgentContract();
    // This would need to be added to the contract ABI
    const minted = await contract.orbMinted(orbIndex);
    return minted;
  } catch (error) {
    console.error('Error checking if orb is minted:', error);
    return false;
  }
}

// Wormhole VAA processing utilities
export async function fetchVAA(
  emitterChain: number,
  emitterAddress: string,
  sequence: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `${config.wormhole.rpcUrl}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.vaaBytes || null;
  } catch (error) {
    console.error('Error fetching VAA:', error);
    return null;
  }
}

export async function waitForVAA(
  emitterChain: number,
  emitterAddress: string,
  sequence: number,
  timeoutMs: number = 300000 // 5 minutes
): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const vaa = await fetchVAA(emitterChain, emitterAddress, sequence);
    if (vaa) {
      return vaa;
    }
    
    // Wait 2 seconds before trying again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for VAA');
}

// Utility to parse Wormhole VAA
export function parseVAA(vaaBytes: string) {
  try {
    const bytes = ethers.getBytes(vaaBytes);
    
    // VAA structure (simplified)
    const version = bytes[0];
    const guardianSetIndex = ethers.getUint32(bytes, 1);
    const signatureCount = bytes[5];
    
    // Skip signatures (65 bytes each)
    const headerOffset = 6 + signatureCount * 65;
    
    const timestamp = ethers.getUint32(bytes, headerOffset);
    const nonce = ethers.getUint32(bytes, headerOffset + 4);
    const emitterChain = ethers.getUint16(bytes, headerOffset + 8);
    const emitterAddress = ethers.hexlify(bytes.slice(headerOffset + 10, headerOffset + 42));
    const sequence = ethers.getBigUint64(bytes, headerOffset + 42);
    const consistencyLevel = bytes[headerOffset + 50];
    const payload = ethers.hexlify(bytes.slice(headerOffset + 51));
    
    return {
      version,
      guardianSetIndex,
      timestamp,
      nonce,
      emitterChain,
      emitterAddress,
      sequence,
      consistencyLevel,
      payload,
    };
  } catch (error) {
    console.error('Error parsing VAA:', error);
    return null;
  }
}