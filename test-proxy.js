import Arweave from 'arweave';
import fs from 'fs';

// Initialize Arweave client to connect to local arlocal
const arweave = Arweave.init({
  host: 'localhost',
  port: 1984,
  protocol: 'http'
});

async function createTestTransaction() {
  try {
    // Load wallet
    const wallet = JSON.parse(fs.readFileSync('../wallets/wallet.json', 'utf8'));
    
    // Create a simple transaction
    const transaction = await arweave.createTransaction({
      data: 'Hello from RATi proxy test! This is test content to verify the proxy is working correctly.'
    }, wallet);
    
    // Add tags
    transaction.addTag('Content-Type', 'text/plain');
    transaction.addTag('App-Name', 'RATi-Test');
    transaction.addTag('Type', 'Test');
    
    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);
    
    console.log('Transaction created:', transaction.id);
    console.log('Data size:', transaction.data_size);
    
    // Post transaction
    const response = await arweave.transactions.post(transaction);
    console.log('Transaction posted:', response.status, response.statusText);
    
    return transaction.id;
  } catch (error) {
    console.error('Error creating transaction:', error);
    return null;
  }
}

createTestTransaction().then(txid => {
  if (txid) {
    console.log(`\nNow test the proxy with: curl "http://localhost:3032/arweave/${txid}"`);
  }
});
