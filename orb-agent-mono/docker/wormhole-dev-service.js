const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Mock Guardian configuration
const GUARDIAN_SET_INDEX = 0;
const GUARDIAN_KEY = crypto.randomBytes(32);

// Mock chain configurations
const CHAIN_IDS = {
  AVALANCHE_FUJI: 6,
  CELO_ALFAJORES: 14,
  SOLANA_DEVNET: 1,
  BASE_TESTNET: 10004,
};

// Store for VAAs (Verifiable Action Approvals)
const vaaStore = new Map();
const messageStore = new Map();

// Guardian heartbeat endpoint
app.get('/v1/heartbeats', (req, res) => {
  res.json({
    entries: [{
      guardian_addr: '0x' + GUARDIAN_KEY.toString('hex').slice(0, 40),
      network: 'devnet',
      timestamp: new Date().toISOString(),
      version: '2.37.0',
      features: ['auto_upgrade', 'wormchain', 'accountant']
    }]
  });
});

// Submit VAA endpoint (mock guardian signing)
app.post('/v1/sign', (req, res) => {
  const { nonce, timestamp, emitterChain, emitterAddress, sequence, payload } = req.body;
  
  // Generate mock VAA
  const vaaId = crypto.randomBytes(32).toString('hex');
  const vaa = {
    version: 1,
    guardian_set_index: GUARDIAN_SET_INDEX,
    signatures: [{
      index: 0,
      signature: crypto.randomBytes(65).toString('hex')
    }],
    timestamp,
    nonce,
    emitter_chain: emitterChain,
    emitter_address: emitterAddress,
    sequence: sequence || Date.now(),
    consistency_level: 1,
    payload: payload || crypto.randomBytes(32).toString('hex')
  };
  
  vaaStore.set(vaaId, vaa);
  messageStore.set(`${emitterChain}/${emitterAddress}/${vaa.sequence}`, vaaId);
  
  res.json({
    vaaBytes: Buffer.from(JSON.stringify(vaa)).toString('base64'),
    vaaId,
    sequence: vaa.sequence
  });
});

// Get signed VAA endpoint
app.get('/v1/signed_vaa/:chain/:emitter/:sequence', (req, res) => {
  const { chain, emitter, sequence } = req.params;
  const key = `${chain}/${emitter}/${sequence}`;
  
  const vaaId = messageStore.get(key);
  if (!vaaId) {
    return res.status(404).json({ error: 'VAA not found' });
  }
  
  const vaa = vaaStore.get(vaaId);
  res.json({
    vaaBytes: Buffer.from(JSON.stringify(vaa)).toString('base64')
  });
});

// Get VAA by ID
app.get('/v1/vaa/:vaaId', (req, res) => {
  const vaa = vaaStore.get(req.params.vaaId);
  if (!vaa) {
    return res.status(404).json({ error: 'VAA not found' });
  }
  
  res.json({
    vaaBytes: Buffer.from(JSON.stringify(vaa)).toString('base64'),
    vaa
  });
});

// Mock relayer endpoints
app.post('/v1/relayer/send', (req, res) => {
  const { targetChain, targetAddress, payload, maxTransactionFee } = req.body;
  
  res.json({
    sequence: Date.now(),
    emitterAddress: '0x' + crypto.randomBytes(32).toString('hex'),
    status: 'pending'
  });
});

// Quote cross-chain delivery cost
app.get('/v1/relayer/quote', (req, res) => {
  const { sourceChain, targetChain, targetAddress } = req.query;
  
  // Mock pricing in wei
  const baseCost = 1000000000000000; // 0.001 ETH
  const gasCost = 500000000000000;   // 0.0005 ETH
  
  res.json({
    cost: (baseCost + gasCost).toString(),
    gasLimit: '200000',
    deliveryTime: 60 // seconds
  });
});

// Chain info endpoint
app.get('/v1/chain/:chainId', (req, res) => {
  const chainId = parseInt(req.params.chainId);
  const chainInfo = {
    6: { name: 'avalanche_fuji', type: 'evm', finality: 1 },
    14: { name: 'celo_alfajores', type: 'evm', finality: 1 },
    1: { name: 'solana_devnet', type: 'solana', finality: 32 },
    10004: { name: 'base_testnet', type: 'evm', finality: 1 }
  };
  
  res.json(chainInfo[chainId] || { error: 'Unknown chain' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: '2.37.0-dev' });
});

// Start servers
const PORT = process.env.PORT || 7071;
const ADMIN_PORT = process.env.ADMIN_PORT || 7070;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Wormhole development service running on port ${PORT}`);
});

// Admin interface on separate port
const adminApp = express();
adminApp.use(cors());
adminApp.get('/metrics', (req, res) => {
  res.json({
    vaa_count: vaaStore.size,
    message_count: messageStore.size,
    uptime: process.uptime()
  });
});

adminApp.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log(`Admin interface running on port ${ADMIN_PORT}`);
});