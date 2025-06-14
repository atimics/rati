import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import Arweave from 'arweave';
import { createDataItemSigner, message, spawn as aoSpawn } from '@permaweb/aoconnect';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Arweave configuRATion
const arweave = Arweave.init({
  host: process.env.ARWEAVE_HOST || 'arlocal',
  port: parseInt(process.env.ARWEAVE_PORT) || 1984,
  protocol: process.env.ARWEAVE_PROTOCOL || 'http'
});

// Ollama configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3';
const OLLAMA_BASE_URL = `http://${OLLAMA_HOST}:${OLLAMA_PORT}`;

// In-memory storage for deployment status
const deployments = new Map();
const activeConnections = new Set();

// WebSocket connection handling
wss.on('connection', (ws) => {
  activeConnections.add(ws);
  console.log('Client connected to deployment service');

  ws.on('close', () => {
    activeConnections.delete(ws);
    console.log('Client disconnected from deployment service');
  });

  // Send current deployment status
  ws.send(JSON.stringify({
    type: 'status',
    deployments: Array.from(deployments.values())
  }));
});

// Broadcast to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  activeConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// Logging helper
function addLog(deploymentId, level, message, data = null) {
  const deployment = deployments.get(deploymentId);
  if (deployment) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    deployment.logs.push(logEntry);
    broadcast({ type: 'deployment_log', deploymentId, log: logEntry });
    console.log(`[${deploymentId}] ${level.toUpperCase()}: ${message}`);
  }
}

// Update deployment status
function updateDeployment(id, updates) {
  const deployment = deployments.get(id);
  if (deployment) {
    Object.assign(deployment, updates);
    broadcast({ type: 'deployment_updated', deployment });
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get all deployments
app.get('/api/deployments', (req, res) => {
  res.json(Array.from(deployments.values()));
});

// Get specific deployment
app.get('/api/deployments/:id', (req, res) => {
  const deployment = deployments.get(req.params.id);
  if (!deployment) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  res.json(deployment);
});

// Get available scrolls
app.get('/api/scrolls', async (req, res) => {
  try {
    const scrollsDir = '/app/scrolls';
    const entries = await fs.readdir(scrollsDir, { withFileTypes: true });
    const scrolls = [];
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        scrolls.push({
          name: entry.name.replace('.md', ''),
          file: entry.name,
          type: 'markdown'
        });
      }
    }
    
    res.json(scrolls);
  } catch (error) {
    console.error('Error reading scrolls:', error);
    res.status(500).json({ error: 'Failed to read scrolls directory' });
  }
});

// Get available wallets
app.get('/api/wallets', async (req, res) => {
  try {
    const walletsDir = '/app/wallets';
    const entries = await fs.readdir(walletsDir);
    const wallets = entries
      .filter(entry => entry.endsWith('.json'))
      .map(entry => ({
        name: entry.replace('.json', ''),
        file: entry
      }));
    res.json(wallets);
  } catch (error) {
    console.error('Error reading wallets:', error);
    res.status(500).json({ error: 'Failed to read wallets directory' });
  }
});

// Deploy genesis scroll
app.post('/api/deploy/genesis', async (req, res) => {
  try {
    const deploymentId = uuidv4();
    const deployment = {
      id: deploymentId,
      type: 'genesis',
      status: 'starting',
      startTime: new Date().toISOString(),
      logs: []
    };

    deployments.set(deploymentId, deployment);
    broadcast({ type: 'deployment_started', deployment });

    // Execute deployment
    deployGenesis(deployment);

    res.json({ deploymentId, message: 'Genesis deployment started' });
  } catch (error) {
    console.error('Deploy genesis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deploy oracle
app.post('/api/deploy/oracle', async (req, res) => {
  try {
    const deploymentId = uuidv4();
    const deployment = {
      id: deploymentId,
      type: 'oracle',
      status: 'starting',
      startTime: new Date().toISOString(),
      logs: []
    };

    deployments.set(deploymentId, deployment);
    broadcast({ type: 'deployment_started', deployment });

    // Execute deployment
    deployOracle(deployment);

    res.json({ deploymentId, message: 'Oracle deployment started' });
  } catch (error) {
    console.error('Deploy oracle error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deploy agent
app.post('/api/deploy/agent', async (req, res) => {
  try {
    const deploymentId = uuidv4();
    const deployment = {
      id: deploymentId,
      type: 'agent',
      status: 'starting',
      startTime: new Date().toISOString(),
      logs: []
    };

    deployments.set(deploymentId, deployment);
    broadcast({ type: 'deployment_started', deployment });

    // Execute deployment
    deployAgent(deployment);

    res.json({ deploymentId, message: 'Agent deployment started' });
  } catch (error) {
    console.error('Deploy agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Summon agent with personality
app.post('/api/summon', async (req, res) => {
  try {
    const { personalityPrompt, agentName } = req.body;
    
    if (!personalityPrompt) {
      return res.status(400).json({ error: 'personalityPrompt is required' });
    }

    const deploymentId = uuidv4();
    const deployment = {
      id: deploymentId,
      type: 'summon',
      status: 'starting',
      startTime: new Date().toISOString(),
      logs: [],
      agentName: agentName || 'RATi-AI-Agent'
    };

    deployments.set(deploymentId, deployment);
    broadcast({ type: 'deployment_started', deployment });

    // Execute summoning
    summonAgent(deployment, personalityPrompt);

    res.json({ deploymentId, message: 'Agent summoning started' });
  } catch (error) {
    console.error('Summon agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Full deployment pipeline
app.post('/api/deploy/full', async (req, res) => {
  try {
    const deploymentId = uuidv4();
    const deployment = {
      id: deploymentId,
      type: 'full',
      status: 'starting',
      startTime: new Date().toISOString(),
      logs: []
    };

    deployments.set(deploymentId, deployment);
    broadcast({ type: 'deployment_started', deployment });

    // Execute full deployment
    deployFull(deployment);

    res.json({ deploymentId, message: 'Full deployment started' });
  } catch (error) {
    console.error('Deploy full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset deployment state
app.post('/api/reset', async (req, res) => {
  try {
    deployments.clear();
    broadcast({ type: 'deployments_reset' });
    res.json({ message: 'Deployment state reset successfully' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deployment functions
async function loadWallet() {
  const walletPath = '/app/wallets/wallet.json';
  try {
    const walletData = await fs.readFile(walletPath, 'utf-8');
    return JSON.parse(walletData);
  } catch (error) {
    throw new Error(`Failed to load wallet: ${error.message}`);
  }
}

async function deployGenesis(deployment) {
  try {
    updateDeployment(deployment.id, { status: 'deploying' });
    addLog(deployment.id, 'info', 'Starting genesis deployment');

    const wallet = await loadWallet();
    addLog(deployment.id, 'info', 'Wallet loaded successfully');

    // Read genesis scrolls
    const scroll1Path = '/app/scrolls/scroll-1.md';
    const scroll2Path = '/app/scrolls/scroll-2.md';
    
    let genesisContent = '';
    
    try {
      const scroll1 = await fs.readFile(scroll1Path, 'utf-8');
      genesisContent += scroll1 + '\n\n';
      addLog(deployment.id, 'info', 'Loaded scroll-1.md');
    } catch (error) {
      addLog(deployment.id, 'warn', 'scroll-1.md not found, skipping');
    }
    
    try {
      const scroll2 = await fs.readFile(scroll2Path, 'utf-8');
      genesisContent += scroll2;
      addLog(deployment.id, 'info', 'Loaded scroll-2.md');
    } catch (error) {
      addLog(deployment.id, 'warn', 'scroll-2.md not found, skipping');
    }

    if (!genesisContent.trim()) {
      throw new Error('No genesis content found');
    }

    addLog(deployment.id, 'info', 'Creating genesis transaction on Arweave');

    const transaction = await arweave.createTransaction({
      data: genesisContent
    }, wallet);

    transaction.addTag('Type', 'Genesis-Scroll');
    transaction.addTag('App-Name', 'RATi');
    transaction.addTag('Content-Type', 'text/markdown');
    transaction.addTag('Version', '1.0');

    await arweave.transactions.sign(transaction, wallet);
    await arweave.transactions.post(transaction);

    addLog(deployment.id, 'info', `Genesis transaction posted: ${transaction.id}`);

    updateDeployment(deployment.id, { 
      status: 'completed',
      endTime: new Date().toISOString(),
      result: { txid: transaction.id }
    });

  } catch (error) {
    addLog(deployment.id, 'error', `Genesis deployment failed: ${error.message}`);
    updateDeployment(deployment.id, { 
      status: 'failed',
      endTime: new Date().toISOString(),
      error: error.message
    });
  }
}

async function deployOracle(deployment) {
  try {
    updateDeployment(deployment.id, { status: 'deploying' });
    addLog(deployment.id, 'info', 'Starting oracle deployment');

    const wallet = await loadWallet();
    const signer = createDataItemSigner(wallet);
    addLog(deployment.id, 'info', 'Wallet and signer prepared');

    addLog(deployment.id, 'info', 'Spawning oracle process');

    const oracleProcessId = await aoSpawn({
      module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk", 
      scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
      signer,
      tags: [{ name: 'Name', value: 'RATi-Oracle' }]
    });

    addLog(deployment.id, 'info', `Oracle process spawned: ${oracleProcessId}`);

    // Initialize oracle with Lua code
    const oracleCodePath = '/app/src/oracle/oracle.lua';
    const oracleCode = await fs.readFile(oracleCodePath, 'utf-8');
    
    await message({
      process: oracleProcessId,
      signer,
      data: oracleCode,
      tags: [{ name: 'Action', value: 'Eval' }]
    });

    addLog(deployment.id, 'info', 'Oracle initialized with Lua code');

    updateDeployment(deployment.id, { 
      status: 'completed',
      endTime: new Date().toISOString(),
      result: { processId: oracleProcessId }
    });

  } catch (error) {
    addLog(deployment.id, 'error', `Oracle deployment failed: ${error.message}`);
    updateDeployment(deployment.id, { 
      status: 'failed',
      endTime: new Date().toISOString(),
      error: error.message
    });
  }
}

async function deployAgent(deployment) {
  try {
    updateDeployment(deployment.id, { status: 'deploying' });
    addLog(deployment.id, 'info', 'Starting agent deployment');

    const wallet = await loadWallet();
    const signer = createDataItemSigner(wallet);
    
    // Read agent prompt template
    const promptPath = '/app/agent/prompt.md';
    const promptData = await fs.readFile(promptPath, 'utf-8');
    
    addLog(deployment.id, 'info', 'Spawning agent process');
    
    const agentProcessId = await aoSpawn({
      module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk",
      scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
      signer,
      tags: [{ name: 'Name', value: 'RATi-AI-Agent' }]
    });

    addLog(deployment.id, 'info', `Agent process spawned: ${agentProcessId}`);

    // Initialize with avatar blueprint
    const avatarCodePath = '/app/src/avatar/avatar.lua';
    const avatarCode = await fs.readFile(avatarCodePath, 'utf-8');
    
    await message({
      process: agentProcessId,
      signer,
      data: avatarCode,
      tags: [{ name: 'Action', value: 'Eval' }]
    });

    addLog(deployment.id, 'info', 'Agent initialized with avatar code');

    // Store personality on-chain
    const personalityTx = await arweave.createTransaction({
      data: promptData
    }, wallet);

    personalityTx.addTag('Type', 'Agent-Personality');
    personalityTx.addTag('Agent-Process-ID', agentProcessId);
    personalityTx.addTag('Content-Type', 'text/markdown');

    await arweave.transactions.sign(personalityTx, wallet);
    await arweave.transactions.post(personalityTx);

    addLog(deployment.id, 'info', `Agent personality stored on-chain: ${personalityTx.id}`);

    updateDeployment(deployment.id, { 
      status: 'completed',
      endTime: new Date().toISOString(),
      result: { 
        processId: agentProcessId, 
        personalityTxid: personalityTx.id 
      }
    });

  } catch (error) {
    addLog(deployment.id, 'error', `Agent deployment failed: ${error.message}`);
    updateDeployment(deployment.id, { 
      status: 'failed',
      endTime: new Date().toISOString(),
      error: error.message
    });
  }
}

async function summonAgent(deployment, personalityPrompt) {
  try {
    updateDeployment(deployment.id, { status: 'spawning' });
    addLog(deployment.id, 'info', 'Beginning agent summoning ritual...');

    const wallet = await loadWallet();
    const signer = createDataItemSigner(wallet);
    
    addLog(deployment.id, 'info', '🎯 Spawning AO process...');
    
    const agentProcessId = await aoSpawn({
      module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk",
      scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
      signer,
      tags: [{ name: 'Name', value: deployment.agentName }]
    });

    addLog(deployment.id, 'info', `✅ Agent's AO Process ID: ${agentProcessId}`);
    updateDeployment(deployment.id, { processId: agentProcessId });

    // Initialize with avatar blueprint
    addLog(deployment.id, 'info', '📦 Initializing agent process with avatar.lua');
    const avatarCodePath = '/app/src/avatar/avatar.lua';
    const avatarCode = await fs.readFile(avatarCodePath, 'utf-8');
    
    await message({
      process: agentProcessId,
      signer,
      data: avatarCode,
      tags: [{ name: 'Action', value: 'Eval' }]
    });

    addLog(deployment.id, 'info', '📦 Agent process initialized with avatar.lua');

    // Store personality on Arweave
    updateDeployment(deployment.id, { status: 'storing_soul' });
    addLog(deployment.id, 'info', '💾 Creating permanent soul on Arweave...');
    
    const personalityTx = await arweave.createTransaction({
      data: personalityPrompt
    }, wallet);

    personalityTx.addTag('Type', 'Agent-Personality');
    personalityTx.addTag('Agent-Process-ID', agentProcessId);
    personalityTx.addTag('Agent-Name', deployment.agentName);
    personalityTx.addTag('Content-Type', 'text/markdown');
    personalityTx.addTag('Timestamp', new Date().toISOString());

    await arweave.transactions.sign(personalityTx, wallet);
    await arweave.transactions.post(personalityTx);

    addLog(deployment.id, 'info', `💾 Agent soul stored on Arweave: ${personalityTx.id}`);

    // Load personality into agent
    addLog(deployment.id, 'info', '🧠 Loading personality into agent...');
    await message({
      process: agentProcessId,
      signer,
      data: personalityPrompt,
      tags: [
        { name: 'Action', value: 'Load-Personality' },
        { name: 'Personality-Txid', value: personalityTx.id }
      ]
    });

    updateDeployment(deployment.id, { 
      status: 'completed',
      endTime: new Date().toISOString(),
      result: { 
        processId: agentProcessId, 
        personalityTxid: personalityTx.id,
        message: '✨ Avatar successfully summoned!'
      }
    });

    addLog(deployment.id, 'info', '✨ Avatar successfully summoned!');
    addLog(deployment.id, 'info', `Process ID: ${agentProcessId}`);
    addLog(deployment.id, 'info', `Personality Transaction: ${personalityTx.id}`);
    addLog(deployment.id, 'info', '🌟 Summoning ritual complete!');

  } catch (error) {
    addLog(deployment.id, 'error', `Agent summoning failed: ${error.message}`);
    updateDeployment(deployment.id, { 
      status: 'failed',
      endTime: new Date().toISOString(),
      error: error.message
    });
  }
}

async function deployFull(deployment) {
  try {
    addLog(deployment.id, 'info', 'Starting full deployment pipeline');
    
    // Sequential deployment
    await deployGenesis(deployment);
    addLog(deployment.id, 'info', 'Genesis deployment completed');
    
    await deployOracle(deployment);
    addLog(deployment.id, 'info', 'Oracle deployment completed');
    
    await deployAgent(deployment);
    addLog(deployment.id, 'info', 'Agent deployment completed');
    
    updateDeployment(deployment.id, { 
      status: 'completed',
      endTime: new Date().toISOString()
    });
    
    addLog(deployment.id, 'info', 'Full deployment pipeline completed successfully');

  } catch (error) {
    addLog(deployment.id, 'error', `Full deployment failed: ${error.message}`);
    updateDeployment(deployment.id, { 
      status: 'failed',
      endTime: new Date().toISOString(),
      error: error.message
    });
  }
}

const PORT = process.env.PORT || 3032;
server.listen(PORT, () => {
  console.log(`🚀 Deployment service running on port ${PORT}`);
  console.log(`📊 WebSocket server ready for real-time updates`);
});
