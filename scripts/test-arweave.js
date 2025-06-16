#!/usr/bin/env node

import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'localhost',
  port: 1984,
  protocol: 'http'
});

async function testConnection() {
  try {
    console.log('🔍 Testing Arweave connection...');
    const info = await arweave.network.getInfo();
    console.log('✅ Connection successful!');
    console.log(`📊 Network: ${info.network}`);
    console.log(`📏 Height: ${info.height}`);
    console.log(`🔗 Host: localhost:1984`);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('💡 Make sure ArLocal is running:');
    console.log('   docker-compose up -d arlocal');
    process.exit(1);
  }
}

testConnection();
