import express from 'express';
import axios from 'axios';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { arweave, getWalletBalance, mineBlocks, mintTokens } from '../services/arweave.js';

const router = express.Router();

/**
 * Get Arweave network status
 */
router.get('/api/arweave/status', asyncHandler(async (req, res) => {
  const info = await arweave.network.getInfo();
  res.json(info);
}));

/**
 * Mine blocks (ArLocal only)
 */
router.post('/api/arweave/mine', asyncHandler(async (req, res) => {
  const { count = 1 } = req.body;
  const result = await mineBlocks(count);
  res.json({ 
    message: `Mined ${count} block(s)`,
    result,
    requestId: req.requestId
  });
}));

/**
 * Get wallet balance
 */
router.get('/api/wallet/balance', asyncHandler(async (req, res) => {
  const { address } = req.query;
  
  if (!address) {
    throw new ApiError(
      'Wallet address is required',
      'MISSING_ADDRESS',
      400,
      null,
      ['Provide address as query parameter: ?address=your_wallet_address']
    );
  }

  const balance = await getWalletBalance(address);
  res.json({
    address,
    balance,
    requestId: req.requestId
  });
}));

/**
 * Proxy for Arweave transaction data
 */
router.get('/arweave/:txid', asyncHandler(async (req, res) => {
  const { txid } = req.params;
  
  if (!txid || txid.length !== 43) {
    throw new ApiError(
      'Invalid transaction ID',
      'INVALID_TXID',
      400,
      { txid },
      ['Transaction ID must be 43 characters long']
    );
  }

  try {
    const arweaveUrl = `${process.env.ARWEAVE_PROTOCOL || 'http'}://${process.env.ARWEAVE_HOST || 'arlocal'}:${process.env.ARWEAVE_PORT || 1984}/${txid}`;
    const response = await axios({
      method: 'GET',
      url: arweaveUrl,
      responseType: 'stream',
      timeout: 30000
    });
    
    // Forward headers
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    
    // Pipe the response
    response.data.pipe(res);
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ApiError(
        'Transaction not found',
        'TRANSACTION_NOT_FOUND',
        404,
        { txid },
        [
          'Verify the transaction ID is correct',
          'Check if the transaction has been mined',
          'Wait a few minutes and try again'
        ]
      );
    }
    throw new ApiError(
      'Failed to fetch transaction',
      'TRANSACTION_FETCH_ERROR',
      500,
      { txid, originalError: error.message }
    );
  }
}));

/**
 * Get Arweave network info
 */
router.get('/arweave-info', asyncHandler(async (req, res) => {
  const info = await arweave.network.getInfo();
  res.json(info);
}));

/**
 * Mint tokens for address (ArLocal only)
 */
router.post('/api/arweave/mint/:address/:amount', asyncHandler(async (req, res) => {
  const { address, amount } = req.params;
  
  if (!address || address.length !== 43) {
    throw new ApiError(
      'Invalid wallet address',
      'INVALID_ADDRESS',
      400,
      { address },
      ['Wallet address must be 43 characters long']
    );
  }

  const result = await mintTokens(address, amount);
  res.json({
    message: `Minted ${amount} AR tokens for ${address}`,
    result,
    requestId: req.requestId
  });
}));

/**
 * Simplified wallet mint endpoint
 */
router.post('/api/wallet/mint/:amount?', asyncHandler(async (req, res) => {
  const amount = req.params.amount || '1000000000000'; // 1 AR in winston
  const { address } = req.body;
  
  if (!address) {
    throw new ApiError(
      'Wallet address is required',
      'MISSING_ADDRESS',
      400,
      null,
      ['Provide address in request body: {"address": "your_wallet_address"}']
    );
  }

  const result = await mintTokens(address, amount);
  const arAmount = parseFloat(arweave.ar.winstonToAr(amount));
  
  res.json({
    message: `Minted ${arAmount} AR tokens`,
    address,
    amount: arAmount,
    result,
    requestId: req.requestId
  });
}));

export default router;
