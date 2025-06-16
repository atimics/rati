import { createDataItemSigner, message, spawn } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This script creates a new AI agent with permanent on-chain memory
// It spawns an AO process and creates the agent's "digital soul" on Arweave

// Detect if we're running in Docker or locally
const isDocker = process.env.DOCKER_ENV === 'true';
const arweaveHost = isDocker ? 'arlocal' : (process.env.ARWEAVE_HOST || 'localhost');
const arweavePort = parseInt(process.env.ARWEAVE_PORT || '1984');
const arweaveProtocol = process.env.ARWEAVE_PROTOCOL || 'http';

console.log(`🔗 Connecting to Arweave at ${arweaveHost}:${arweavePort}`);

const arweave = Arweave.init({ 
  host: arweaveHost, 
  port: arweavePort, 
  protocol: arweaveProtocol 
});

// Test Arweave connection
async function testArweaveConnection() {
  try {
    const info = await arweave.network.getInfo();
    console.log('✅ Arweave connection successful');
    console.log(`📊 Network: ${info.network}, Height: ${info.height}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Arweave:', error.message);
    console.log('💡 Make sure ArLocal is running on localhost:1984');
    console.log('💡 Try: docker-compose up arlocal');
    return false;
  }
}

async function main() {
  console.log("🤖 Birthing a new AI Agent with on-chain soul...");
  
  // Test connection first
  const connected = await testArweaveConnection();
  if (!connected) {
    process.exit(1);
  }
  
  // Check prerequisites
  const walletPath = './agent/wallet.json';
  const promptPath = './agent/prompt.md';
  
  if (!fs.existsSync(walletPath)) {
    console.error("❌ wallet.json not found in agent directory");
    console.log("💡 Make sure you have a wallet.json file in the agent/ directory");
    process.exit(1);
  }
  
  if (!fs.existsSync(promptPath)) {
    console.error("❌ prompt.md not found in agent directory");
    console.log("Create agent/prompt.md with the agent's personality first");
    process.exit(1);
  }

  const wallet = JSON.parse(fs.readFileSync(walletPath).toString());
  const promptData = fs.readFileSync(promptPath, 'utf-8');
  const signer = createDataItemSigner(wallet);

  console.log("📋 Agent personality loaded from prompt.md");
  console.log(`📝 Personality preview: "${promptData.substring(0, 100)}..."`);

  // 1. Spawn the ao process first to get its ID
  console.log("\n🎯 Spawning AO process...");
  const aoProcessId = await spawn({
    module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk", // ao.lua module
    scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA', // Scheduler address
    signer,
    tags: [{ name: 'Name', value: 'RATi-AI-Agent' }]
  });

  console.log(`✅ Agent's AO Process ID: ${aoProcessId}`);
  
  // 2. Initialize the process with avatar.lua
  const avatarBlueprint = fs.readFileSync('./src/avatar/avatar.lua', 'utf-8');
  await message({
    process: aoProcessId,
    signer,
    tags: [{ name: 'Action', value: 'Eval' }],    data: avatarBlueprint
  });

  console.log("📦 Agent process initialized with avatar.lua");

  // 3. Create the permanent prompt on Arweave, linking it to the process ID
  console.log("\n💾 Creating permanent soul on Arweave...");
  const promptTx = await arweave.createTransaction({ data: promptData }, wallet);
  
  // Add tags to make the prompt discoverable
  promptTx.addTag('App-Name', 'RATi-Agent');
  promptTx.addTag('Content-Type', 'text/markdown');
  promptTx.addTag('Type', 'Agent-Prompt');
  promptTx.addTag('Owner-Process', aoProcessId);
  promptTx.addTag('Version', '1.0');

  await arweave.transactions.sign(promptTx, wallet);
  await arweave.transactions.post(promptTx);

  console.log(`✅ Agent's Soul (Prompt) TXID: ${promptTx.id}`);
  
  // 4. Create genesis memory entry
  console.log("\n📚 Creating genesis memory...");
  const genesisMemory = {
    timestamp: Date.now(),
    sequence: 0,
    lastMemoryTxId: 'GENESIS',
    context: {
      event: 'Agent Birth',
      processId: aoProcessId,
      promptTxId: promptTx.id
    },
    decision: {
      action: 'BIRTH',
      RATionale: 'Agent successfully created with on-chain soul and AO process'
    }
  };

  const memoryTx = await arweave.createTransaction({ 
    data: JSON.stringify(genesisMemory, null, 2) 
  }, wallet);
  
  memoryTx.addTag('App-Name', 'RATi-Agent');
  memoryTx.addTag('Content-Type', 'application/json');
  memoryTx.addTag('Type', 'Agent-Memory');
  memoryTx.addTag('Owner-Process', aoProcessId);
  memoryTx.addTag('Sequence', '0');

  await arweave.transactions.sign(memoryTx, wallet);
  await arweave.transactions.post(memoryTx);

  console.log(`✅ Genesis Memory TXID: ${memoryTx.id}`);

  console.log("\n🎉 --- AGENT SUCCESSFULLY BORN ---");
  console.log("📋 Summary:");
  console.log(`   AO Process ID: ${aoProcessId}`);
  console.log(`   Soul TXID: ${promptTx.id}`);
  console.log(`   Genesis Memory: ${memoryTx.id}`);
  console.log(`   Wallet Address: ${await arweave.wallets.jwkToAddress(wallet)}`);
  
  console.log("\n🔧 Next Steps:");
  console.log("1. Copy the AO Process ID to your agent/.env file:");
  console.log(`   AO_PROCESS_ID="${aoProcessId}"`);
  console.log("2. Launch your agent: docker-compose up ai-agent");
  console.log("3. Monitor: docker-compose logs -f ai-agent");
  
  console.log("\n🔍 Verification:");
  console.log(`View soul: https://arweave.net/${promptTx.id}`);
  console.log(`View genesis: https://arweave.net/${memoryTx.id}`);
}

main().catch(console.error);
