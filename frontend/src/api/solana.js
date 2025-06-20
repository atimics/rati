/**
 * Solana PDA Helper for RATi Character Genesis
 * 
 * This helper derives a "dead" Solana wallet (PDA) from an Arweave transaction ID:
 * 1. SHA-256 hash the TX ID down to 32 bytes
 * 2. Use the System Program (111111...) so there's no on-chain program (hence "dead")
 * 3. Prepend the ASCII prefix "RATi" as a seed
 * 4. Brute-force the 1-byte bump (0–255) until the resulting Base58 PDA starts with "RATi"
 */

import { PublicKey } from '@solana/web3.js';
import { sha256 } from 'js-sha256';

// Create Buffer polyfill for browser environment
const createBuffer = (data, encoding) => {
  if (typeof data === 'string' && encoding === 'hex') {
    const bytes = new Uint8Array(data.length / 2);
    for (let i = 0; i < data.length; i += 2) {
      bytes[i / 2] = parseInt(data.substr(i, 2), 16);
    }
    return bytes;
  } else if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  } else if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  return data;
};

// Constants
const SYS_PROGRAM = new PublicKey('11111111111111111111111111111111');
const PREFIX = createBuffer('RATi'); // 4 bytes

/**
 * Derive a "dead" Solana wallet that:
 *  • Encodes your Arweave TX ID (via SHA-256)
 *  • Starts with "RATi" in its Base58 form
 *  • Has no corresponding private key (PDA under the System Program)
 * 
 * @param {string} txId - Arweave transaction ID
 * @returns {PublicKey} - The derived PDA
 */
export function deriveDeadWalletFromArweaveTx(txId) {
  // Hash the Arweave TX ID down to exactly 32 bytes
  const hashHex = sha256(txId);
  const txHash = createBuffer(hashHex, 'hex'); // 32 bytes

  // Try each bump until the Base58 PDA starts with "RATi"
  for (let bump = 0; bump < 256; bump++) {
    try {
      const pda = PublicKey.createProgramAddress(
        [PREFIX, txHash, createBuffer([bump])],
        SYS_PROGRAM
      );
      if (pda.toBase58().startsWith('RATi')) {
        return pda;
      }
    } catch {
      // invalid bump, keep going
    }
  }

  throw new Error(`Unable to derive a RATi… dead wallet for TX ${txId}`);
}

/**
 * Derive the burn address for a character definition
 * This creates a deterministic address that starts with "RATi" for any Arweave TX
 * 
 * @param {string} arweaveTxId - The Arweave transaction ID containing character definition
 * @returns {Object} - Object containing the PDA and related info
 */
export function deriveCharacterBurnAddress(arweaveTxId) {
  try {
    const pda = deriveDeadWalletFromArweaveTx(arweaveTxId);
    
    return {
      address: pda.toBase58(),
      publicKey: pda,
      arweaveTxId,
      prefix: 'RATi',
      type: 'burn_address',
      isDead: true, // No private key exists
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to derive burn address for TX ${arweaveTxId}: ${error.message}`);
  }
}

/**
 * Validate that an address is a valid RATi burn address
 * 
 * @param {string} address - The address to validate
 * @returns {boolean} - Whether the address is a valid RATi burn address
 */
export function isValidRatiBurnAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Check if it starts with RATi and is a valid Solana address
  if (!address.startsWith('RATi')) {
    return false;
  }
  
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get burn address info for display
 * 
 * @param {string} address - The burn address
 * @returns {Object} - Display information
 */
export function getBurnAddressInfo(address) {
  return {
    address,
    formatted: `${address.slice(0, 8)}...${address.slice(-8)}`,
    prefix: address.slice(0, 4),
    isRatiBurnAddress: isValidRatiBurnAddress(address),
    explorer: `https://explorer.solana.com/address/${address}`,
    type: 'Burn Address (No Private Key)'
  };
}
