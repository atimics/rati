import Arweave from 'arweave';
import fs from 'fs';

// This script deploys the foundational "poems" to Arweave.

// --- ConfiguRATion ---
// Load poems from markdown files
const POEM_1 = fs.readFileSync('./scrolls/scroll-1.md', 'utf-8');
const POEM_2 = fs.readFileSync('./scrolls/scroll-2.md', 'utf-8');
const FOUNDING_TEXT = `# The Founding Scrolls\n\n## Scroll I\n\n${POEM_1}\n\n## Scroll II\n\n${POEM_2}`;

const arweave = Arweave.init({
  host: '127.0.0.1', // ArLocal
  port: 1984,
  protocol: 'http'
});

async function main() {
  console.log('Deploying the Genesis Document to Arweave...');

  // Use a wallet.json keyfile. For ArLocal, you can use the pre-supplied one.
  const key = JSON.parse(fs.readFileSync('wallet.json').toString());
  const walletAddress = await arweave.wallets.jwkToAddress(key);
  console.log(`Using wallet: ${walletAddress}`);

  const transaction = await arweave.createTransaction({ data: FOUNDING_TEXT }, key);
  transaction.addTag('App-Name', 'RATi');
  transaction.addTag('Content-Type', 'text/markdown');
  transaction.addTag('Type', 'Genesis-Scroll');
  transaction.addTag('Version', '1.0');

  await arweave.transactions.sign(transaction, key);
  const response = await arweave.transactions.post(transaction);

  console.log(`Transaction posted: ${response.status}`);
  console.log(`\n--- DEPLOYMENT COMPLETE ---`);
  console.log(`Genesis Scroll TXID: ${transaction.id}`);
  console.log(`This ID is the immutable foundation of your community.`);
  console.log(`Save it! You will need it to link future interpretations.`);
}

main().catch(console.error);
