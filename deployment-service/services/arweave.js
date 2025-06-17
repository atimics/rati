import Arweave from 'arweave';
import crypto from 'crypto';
import { ApiError } from '../utils/errors.js';

// Node.js fetch polyfill for older Node versions
import fetch from 'node-fetch';

// Ensure crypto polyfill for Arweave
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}

// Arweave configuration
export const arweave = Arweave.init({
  host: process.env.ARWEAVE_HOST || 'arlocal',
  port: parseInt(process.env.ARWEAVE_PORT) || 1984,
  protocol: process.env.ARWEAVE_PROTOCOL || 'http'
});

/**
 * Check if Arweave/ArLocal is accessible
 */
export async function checkArweaveConnection() {
  try {
    const info = await arweave.network.getInfo();
    return { connected: true, info };
  } catch (error) {
    throw new ApiError(
      'Unable to connect to Arweave network',
      'ARWEAVE_CONNECTION_ERROR',
      503,
      { originalError: error.message },
      [
        'Check if ArLocal is running (docker-compose up -d arlocal)',
        'Verify ARWEAVE_HOST and ARWEAVE_PORT environment variables',
        'Ensure network connectivity'
      ]
    );
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(address) {
  try {
    const winston = await arweave.wallets.getBalance(address);
    const ar = arweave.ar.winstonToAr(winston);
    return { winston, ar: parseFloat(ar) };
  } catch (error) {
    throw new ApiError(
      'Failed to get wallet balance',
      'WALLET_BALANCE_ERROR',
      500,
      { address, originalError: error.message },
      [
        'Verify the wallet address is valid',
        'Check Arweave network connectivity'
      ]
    );
  }
}

/**
 * Get transaction by ID
 */
export async function getTransaction(txid) {
  try {
    const tx = await arweave.transactions.get(txid);
    return tx;
  } catch (error) {
    throw new ApiError(
      'Transaction not found',
      'TRANSACTION_NOT_FOUND',
      404,
      { txid, originalError: error.message },
      [
        'Verify the transaction ID is correct',
        'Check if the transaction has been mined',
        'Wait a few minutes and try again'
      ]
    );
  }
}

/**
 * Mine blocks in ArLocal (development only)
 */
export async function mineBlocks(count = 1) {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(
      'Mining is only available in development mode',
      'MINING_NOT_ALLOWED',
      403,
      null,
      ['Use this feature only with ArLocal in development']
    );
  }

  try {
    const response = await fetch(`http://${process.env.ARWEAVE_HOST || 'arlocal'}:${process.env.ARWEAVE_PORT || 1984}/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count })
    });

    if (!response.ok) {
      throw new Error(`Mining failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new ApiError(
      'Failed to mine blocks',
      'MINING_ERROR',
      500,
      { count, originalError: error.message },
      [
        'Ensure ArLocal is running',
        'Check ArLocal configuration'
      ]
    );
  }
}

/**
 * Mint tokens in ArLocal (development only)
 */
export async function mintTokens(address, amount) {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(
      'Token minting is only available in development mode',
      'MINTING_NOT_ALLOWED',
      403,
      null,
      ['Use this feature only with ArLocal in development']
    );
  }

  try {
    const response = await fetch(`http://${process.env.ARWEAVE_HOST || 'arlocal'}:${process.env.ARWEAVE_PORT || 1984}/mint/${address}/${amount}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Minting failed: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new ApiError(
      'Failed to mint tokens',
      'MINTING_ERROR',
      500,
      { address, amount, originalError: error.message },
      [
        'Ensure ArLocal is running',
        'Verify the wallet address is valid',
        'Check ArLocal configuration'
      ]
    );
  }
}

/**
 * Validate transaction signature and structure
 */
export async function validateTransaction(transaction) {
  try {
    // Check basic structure
    if (!transaction.id || !transaction.signature) {
      throw new ApiError(
        'Invalid transaction structure',
        'INVALID_TRANSACTION',
        400,
        { transaction: { id: transaction.id, hasSignature: !!transaction.signature } },
        [
          'Ensure transaction has valid id and signature',
          'Transaction may not have been properly signed by wallet',
          'Try signing the transaction again'
        ]
      );
    }

    // Validate signature format
    if (typeof transaction.signature !== 'string' || transaction.signature.length === 0) {
      throw new ApiError(
        'Invalid transaction signature',
        'INVALID_SIGNATURE',
        400,
        { signatureType: typeof transaction.signature, signatureLength: transaction.signature?.length },
        [
          'Transaction signature must be a non-empty string',
          'Ensure wallet properly signed the transaction',
          'ArConnect may have failed to sign - try again'
        ]
      );
    }

    // Use Arweave's built-in transaction verification
    const isValid = await arweave.transactions.verify(transaction);
    
    if (!isValid) {
      throw new ApiError(
        'Transaction signature verification failed',
        'SIGNATURE_VERIFICATION_FAILED',
        400,
        { transactionId: transaction.id },
        [
          'Transaction signature is invalid',
          'Transaction may have been tampered with',
          'Re-sign the transaction with your wallet'
        ]
      );
    }

    return { valid: true, transactionId: transaction.id };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Transaction validation failed',
      'VALIDATION_ERROR',
      500,
      { originalError: error.message },
      [
        'Check transaction format and signature',
        'Ensure transaction was properly created and signed',
        'Try the operation again'
      ]
    );
  }
}
