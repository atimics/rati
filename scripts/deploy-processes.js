import { createDataItemSigner, message, spawn } from '@permaweb/aoconnect';
import fs from 'fs';

// This script deploys the Oracle and Avatar `ao` processes.

// --- ConfiguRATion ---
// The wallet you'll use to spawn the processes.
// Ensure you have a wallet.json file in your root directory.
const wallet = JSON.parse(fs.readFileSync('wallet.json').toString());

// List of Arweave wallet addresses for the initial Oracle council.
// Replace with real addresses for a live deployment.
const ORACLE_ADDRESSES = [
  "YOUR_WALLET_ADDRESS_1",
  "YOUR_WALLET_ADDRESS_2",
  "YOUR_WALLET_ADDRESS_3"
];

async function main() {
  console.log("Deploying ao processes...");

  const oracleBlueprint = fs.readFileSync('./src/oracle/oracle.lua', 'utf-8');
  const avatarBlueprint = fs.readFileSync('./src/avatar/avatar.lua', 'utf-8');

  const signer = createDataItemSigner(wallet);

  // 1. Spawn the Oracle Process
  const oracleProcessId = await spawn({
    module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk", // ao.lua module
    scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA', // Scheduler address
    signer,
    tags: [ { name: 'Name', value: 'RATi-Oracle' } ]
  });

  // 2. Initialize the Oracle Process with the blueprint and initial state
  await message({
      process: oracleProcessId,
      signer,
      tags: [{ name: 'Action', value: 'Eval' }],
      data: oracleBlueprint
  });
  
  // Initialize state with the oracle addresses
  await message({
      process: oracleProcessId,
      signer,
      tags: [{ name: 'Action', value: 'Eval' }],
      data: `Oracles = ${JSON.stringify(ORACLE_ADDRESSES)}`
  });

  console.log(`\n--- ORACLE DEPLOYED ---`);
  console.log(`Oracle Process ID: ${oracleProcessId}`);


  // 3. Spawn a sample Avatar Process for a user
  const avatarProcessId = await spawn({
    module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk",
    scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
    signer,
    tags: [ { name: 'Name', value: 'RATi-Avatar-1' } ]
  });

  // 4. Initialize the Avatar Process
  await message({
      process: avatarProcessId,
      signer,
      tags: [{ name: 'Action', value: 'Eval' }],
      data: avatarBlueprint
  });

  console.log(`\n--- AVATAR DEPLOYED ---`);
  console.log(`Sample Avatar Process ID: ${avatarProcessId}`);
  console.log(`\n--- DEPLOYMENT COMPLETE ---`);
  console.log('Save these Process IDs. Your frontend will need them.');
}

main().catch(console.error);
