import Arweave from 'arweave';
import fs from 'fs';

// This script deploys the foundational "poems" to Arweave.

// --- ConfiguRATion ---
// Load poems from markdown files
const POEM_1 = fs.readFileSync('./scrolls/scroll-1.md', 'utf-8');
const POEM_2 = fs.readFileSync('./scrolls/scroll-2.md', 'utf-8');
const FOUNDING_TEXT = `# The Founding Scrolls\n\n## Scroll I\n\n${POEM_1}\n\n## Scroll II\n\n${POEM_2}`;

// Detect environment and configure Arweave accordingly
const isDocker = process.env.NODE_ENV === 'docker' || process.env.DOCKER === 'true';
const arweaveHost = isDocker ? 'arlocal' : 'localhost';

const arweave = Arweave.init({
  host: arweaveHost,
  port: 1984,
  protocol: 'http'
});

async function testConnection() {
  try {
    const info = await arweave.network.getInfo();
    console.log(`✅ Connected to Arweave node: ${arweaveHost}:1984`);
    console.log(`📊 Network: ${info.network}, Height: ${info.height}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to Arweave node at ${arweaveHost}:1984`);
    console.error('💡 Make sure ArLocal is running. You can start it with: npm run arlocal:start');
    throw error;
  }
}

async function main() {
  console.log('🚀 Deploying the Genesis Document to Arweave...');
  
  // Test connection first
  await testConnection();

  // Use a wallet.json keyfile. For ArLocal, you can use the pre-supplied one.
  const key = JSON.parse(fs.readFileSync('./wallets/wallet.json').toString());
  const walletAddress = await arweave.wallets.jwkToAddress(key);
  console.log(`💰 Using wallet: ${walletAddress}`);

  const transaction = await arweave.createTransaction({ data: FOUNDING_TEXT }, key);
  transaction.addTag('App-Name', 'RATi');
  transaction.addTag('Content-Type', 'text/markdown');
  transaction.addTag('Type', 'Genesis-Scroll');
  transaction.addTag('Version', '1.0');

  await arweave.transactions.sign(transaction, key);
  
  console.log('📤 Posting transaction...');
  const response = await arweave.transactions.post(transaction);

  console.log(`📊 Transaction status: ${response.status}`);
  console.log(`\n🎉 DEPLOYMENT COMPLETE!`);
  console.log(`📜 Genesis Scroll TXID: ${transaction.id}`);
  console.log(`🔗 View at: https://arweave.net/${transaction.id}`);
  console.log(`💎 This ID is the immutable foundation of your community.`);
  console.log(`💾 Save it! You will need it to link future interpretations.`);
}

main().catch(console.error);
