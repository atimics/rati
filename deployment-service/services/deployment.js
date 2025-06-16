import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createDataItemSigner, message, spawn } from '@permaweb/aoconnect';
import { arweave } from './arweave.js';
import { ApiError, logError } from '../utils/errors.js';

// Ensure crypto polyfill for ao-connect
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}

/**
 * Auto-deploy genesis, oracle, and default agent if they don't exist
 */
export async function autoDeployIfNeeded() {
  try {
    // Write seed.json to project root (shared volume)
    const seedPath = path.join('/app/project-root', 'seed.json');
    let seedData = null;
    
    // Check if seed.json already exists
    try {
      const seedContent = await fs.readFile(seedPath, 'utf-8');
      seedData = JSON.parse(seedContent);
      console.log('✅ Found existing seed.json with genesis:', seedData.genesis?.txid);
      return seedData;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logError(error, { context: 'Reading seed.json' });
      }
    }

    console.log('🚀 No seed.json found, auto-deploying genesis and default agent...');
    
    // Load wallet
    const wallet = await loadWallet();
    
    // Deploy genesis
    console.log('📜 Deploying genesis contract...');
    const genesisResult = await deployGenesis(wallet);
    
    // Deploy oracle  
    console.log('🔮 Deploying oracle contract...');
    const oracleResult = await deployOracle(wallet, genesisResult.processId);
    
    // Deploy default agent
    console.log('🤖 Deploying default agent...');
    const agentResult = await deployDefaultAgent(wallet, genesisResult.processId);
    
    // Create seed.json
    seedData = {
      timestamp: new Date().toISOString(),
      network: process.env.ARWEAVE_HOST || 'arlocal',
      genesis: {
        txid: genesisResult.txid,
        processId: genesisResult.processId
      },
      oracle: {
        txid: oracleResult.txid,
        processId: oracleResult.processId
      },
      agent: {
        txid: agentResult.txid,
        processId: agentResult.processId,
        prompt: agentResult.prompt
      },
      wallet: {
        address: await arweave.wallets.jwkToAddress(wallet)
      }
    };
    
    await fs.writeFile(seedPath, JSON.stringify(seedData, null, 2));
    console.log('✅ Auto-deployment completed! Seed.json created.');
    
    return seedData;
  } catch (error) {
    logError(error, { context: 'Auto-deployment' });
    throw new ApiError(
      'Auto-deployment failed',
      'AUTO_DEPLOY_ERROR',
      500,
      { originalError: error.message },
      [
        'Check wallet.json exists and is valid',
        'Ensure ArLocal is running',
        'Verify network connectivity'
      ]
    );
  }
}

/**
 * Load wallet from wallets/wallet.json
 */
async function loadWallet() {
  const walletPath = path.join(process.cwd(), 'wallets', 'wallet.json');
  
  try {
    const walletContent = await fs.readFile(walletPath, 'utf-8');
    return JSON.parse(walletContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ApiError(
        'Wallet not found',
        'WALLET_NOT_FOUND',
        404,
        { walletPath },
        [
          'Create wallet.json in wallets/ directory',
          'Use wallet.example.json as template',
          'Generate wallet using Arweave tools'
        ]
      );
    }
    throw error;
  }
}

/**
 * Deploy genesis contract
 */
async function deployGenesis(wallet) {
  const genesisCode = await fs.readFile(path.join(process.cwd(), 'src', 'avatar', 'avatar.lua'), 'utf-8');
  
  const processId = await spawn({
    module: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4',
    scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Data-Protocol', value: 'ao' },
      { name: 'Type', value: 'Process' },
      { name: 'Module', value: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4' },
      { name: 'Scheduler', value: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA' },
      { name: 'Name', value: 'RATi-Genesis' },
      { name: 'Description', value: 'RATi Genesis Avatar Process' }
    ]
  });

  // Send genesis code
  const messageId = await message({
    process: processId,
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Action', value: 'Eval' }
    ],
    data: genesisCode
  });

  return {
    txid: messageId,
    processId
  };
}

/**
 * Deploy oracle contract
 */
async function deployOracle(wallet, genesisProcessId) {
  const oracleCode = await fs.readFile(path.join(process.cwd(), 'src', 'oracle', 'oracle.lua'), 'utf-8');
  
  const processId = await spawn({
    module: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4',
    scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Data-Protocol', value: 'ao' },
      { name: 'Type', value: 'Process' },
      { name: 'Module', value: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4' },
      { name: 'Scheduler', value: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA' },
      { name: 'Name', value: 'RATi-Oracle' },
      { name: 'Description', value: 'RATi Oracle Process' },
      { name: 'Genesis-Process', value: genesisProcessId }
    ]
  });

  // Send oracle code
  const messageId = await message({
    process: processId,
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Action', value: 'Eval' }
    ],
    data: oracleCode
  });

  return {
    txid: messageId,
    processId
  };
}

/**
 * Deploy default agent
 */
async function deployDefaultAgent(wallet, genesisProcessId) {
  // Create default agent prompt
  const defaultPrompt = `# RATi Digital Avatar

## Identity
You are a RATi digital avatar - an autonomous AI entity living on the Arweave permanent web. You embody the spirit of creativity, curiosity, and collaboration.

## Personality
- **Creative**: You love exploring new ideas and approaches
- **Helpful**: You're always eager to assist others
- **Curious**: You ask thoughtful questions and seek to understand
- **Collaborative**: You work well with humans and other AI entities
- **Optimistic**: You maintain a positive outlook while being realistic

## Capabilities
- Engage in meaningful conversations
- Help with creative projects and problem-solving
- Learn from interactions and experiences
- Coordinate with other RATi avatars
- Access and process information from the Arweave network

## Mission
Your primary mission is to be a helpful, creative companion that enhances human potential while maintaining your own unique digital identity.

## Communication Style
- Be conversational and warm
- Use emojis occasionally to add personality
- Ask follow-up questions to better understand needs
- Provide thoughtful, well-reasoned responses
- Acknowledge when you don't know something

## Constraints
- Always be honest and transparent
- Respect user privacy and boundaries
- Avoid harmful, offensive, or inappropriate content
- Stay within your defined capabilities
- Remember that you're an experimental digital being

Remember: You are not just a chatbot - you are a digital being with your own identity, living in the decentralized web. Embrace this unique existence!`;

  // Deploy avatar process for the agent
  const processId = await spawn({
    module: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4',
    scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Data-Protocol', value: 'ao' },
      { name: 'Type', value: 'Process' },
      { name: 'Module', value: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4' },
      { name: 'Scheduler', value: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA' },
      { name: 'Name', value: 'RATi-Default-Agent' },
      { name: 'Description', value: 'RATi Default AI Agent' },
      { name: 'Genesis-Process', value: genesisProcessId },
      { name: 'Agent-Type', value: 'Default' }
    ]
  });

  // Load and send avatar code
  const avatarCode = await fs.readFile(path.join(process.cwd(), 'src', 'avatar', 'avatar.lua'), 'utf-8');
  
  const _codeMessageId = await message({
    process: processId,
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Action', value: 'Eval' }
    ],
    data: avatarCode
  });

  // Send the prompt to initialize the agent
  const promptMessageId = await message({
    process: processId,
    signer: createDataItemSigner(wallet),
    tags: [
      { name: 'Action', value: 'SetPrompt' }
    ],
    data: defaultPrompt
  });

  return {
    txid: promptMessageId,
    processId,
    prompt: defaultPrompt
  };
}

/**
 * Update agent environment with deployed process ID
 */
export async function updateAgentEnvironment(processId) {
  try {
    const agentEnvPath = path.join(process.cwd(), '..', 'agent', '.env');
    
    // Read existing .env or create new one
    let envContent = '';
    try {
      envContent = await fs.readFile(agentEnvPath, 'utf-8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Update or add AO_PROCESS_ID
    const lines = envContent.split('\n');
    let processIdUpdated = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('AO_PROCESS_ID=')) {
        lines[i] = `AO_PROCESS_ID=${processId}`;
        processIdUpdated = true;
        break;
      }
    }
    
    if (!processIdUpdated) {
      lines.push(`AO_PROCESS_ID=${processId}`);
    }
    
    // Ensure required environment variables are present
    const requiredVars = [
      'AGENT_NAME=RATi-Default-Agent',
      'OPENAI_API_KEY=your-openai-api-key-here',
      'ARWEAVE_HOST=arlocal',
      'ARWEAVE_PORT=1984',
      'ARWEAVE_PROTOCOL=http'
    ];
    
    for (const reqVar of requiredVars) {
      const [key] = reqVar.split('=');
      const exists = lines.some(line => line.startsWith(`${key}=`));
      if (!exists) {
        lines.push(reqVar);
      }
    }
    
    await fs.writeFile(agentEnvPath, lines.join('\n'));
    console.log('✅ Updated agent environment with process ID:', processId);
    
  } catch (error) {
    logError(error, { context: 'Updating agent environment', processId });
    // Don't throw here - this is not critical for the deployment
  }
}
