#!/usr/bin/env node

/**
 * Frontend Deployment Script for Arweave
 * Builds the React frontend and prepares it for deployment to Arweave
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import Arweave from 'arweave';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, '../frontend');
const DIST_DIR = path.join(FRONTEND_DIR, 'dist');
const WALLETS_DIR = path.join(__dirname, '../wallets');

// Arweave configuration
const arweave = Arweave.init({
  host: process.env.ARWEAVE_HOST || 'localhost',
  port: parseInt(process.env.ARWEAVE_PORT) || 1984,
  protocol: process.env.ARWEAVE_PROTOCOL || 'http'
});

async function loadWallet() {
  try {
    const walletPath = path.join(WALLETS_DIR, 'wallet.json');
    const walletData = await fs.readFile(walletPath, 'utf8');
    return JSON.parse(walletData);
  } catch (error) {
    console.error('❌ Failed to load wallet:', error.message);
    console.log('💡 Make sure wallet.json exists in the wallets directory');
    process.exit(1);
  }
}

async function buildFrontend() {
  console.log('🏗️  Building frontend...');
  
  try {
    // Change to frontend directory and build
    process.chdir(FRONTEND_DIR);
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Frontend build completed');
  } catch (error) {
    console.error('❌ Frontend build failed:', error.message);
    process.exit(1);
  }
}

async function createSinglePageBundle() {
  console.log('📦 Creating single-page bundle...');
  
  try {
    // Read the built index.html
    const indexPath = path.join(DIST_DIR, 'index.html');
    let html = await fs.readFile(indexPath, 'utf8');
    
    // Get all asset files
    const assetsDir = path.join(DIST_DIR, 'assets');
    const assetFiles = await fs.readdir(assetsDir);
    
    // Inline CSS files
    for (const file of assetFiles) {
      if (file.endsWith('.css')) {
        const cssPath = path.join(assetsDir, file);
        const cssContent = await fs.readFile(cssPath, 'utf8');
        
        // Replace CSS link with inline style
        const linkRegex = new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`, 'g');
        html = html.replace(linkRegex, `<style>${cssContent}</style>`);
      }
    }
    
    // Inline JS files
    for (const file of assetFiles) {
      if (file.endsWith('.js')) {
        const jsPath = path.join(assetsDir, file);
        const jsContent = await fs.readFile(jsPath, 'utf8');
        
        // Replace JS script with inline script
        const scriptRegex = new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`, 'g');
        html = html.replace(scriptRegex, `<script>${jsContent}</script>`);
      }
    }
    
    // Add Arweave-specific configurations
    html = html.replace(
      '<head>',
      `<head>
        <meta name="arweave-app" content="rati-frontend">
        <meta name="version" content="0.2.0">
        <meta name="deployment-date" content="${new Date().toISOString()}">
        <meta name="description" content="Decentralized RATi Digital Avatar Interface">
        <meta name="keywords" content="arweave,blockchain,ai,avatar,permanent,web3">`
    );
    
    console.log('✅ Single-page bundle created');
    return html;
  } catch (error) {
    console.error('❌ Failed to create bundle:', error.message);
    process.exit(1);
  }
}

async function deployToArweave(bundleContent) {
  console.log('🚀 Deploying to Arweave...');
  
  try {
    const wallet = await loadWallet();
    
    // Create transaction
    const transaction = await arweave.createTransaction({
      data: bundleContent
    }, wallet);
    
    // Add tags
    transaction.addTag('Content-Type', 'text/html');
    transaction.addTag('App-Name', 'RATi-Frontend');
    transaction.addTag('App-Version', '0.2.0');
    transaction.addTag('Type', 'web-app');
    transaction.addTag('Title', 'RATi Digital Avatar Interface');
    transaction.addTag('Description', 'Decentralized frontend for RATi digital avatar platform');
    transaction.addTag('Deployment-Date', new Date().toISOString());
    transaction.addTag('Build-Tool', 'vite');
    transaction.addTag('Framework', 'react');
    
    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);
    
    // Get cost estimate
    const cost = await arweave.transactions.getPrice(bundleContent.length);
    const arCost = arweave.ar.winstonToAr(cost);
    
    console.log(`💰 Deployment cost: ${arCost} AR`);
    
    // Check wallet balance
    const address = await arweave.wallets.jwkToAddress(wallet);
    const balance = await arweave.wallets.getBalance(address);
    const arBalance = arweave.ar.winstonToAr(balance);
    
    console.log(`👛 Wallet balance: ${arBalance} AR`);
    
    if (parseFloat(arBalance) < parseFloat(arCost)) {
      console.error('❌ Insufficient balance for deployment');
      process.exit(1);
    }
    
    // Submit transaction
    const response = await arweave.transactions.post(transaction);
    
    if (response.status === 200) {
      console.log('✅ Deployment successful!');
      console.log(`📋 Transaction ID: ${transaction.id}`);
      console.log(`🌐 URL: https://arweave.net/${transaction.id}`);
      console.log(`🔗 Gateway: https://arweave.net/${transaction.id}`);
      
      // Save deployment info
      const deploymentInfo = {
        txId: transaction.id,
        url: `https://arweave.net/${transaction.id}`,
        gateway: `https://arweave.net/${transaction.id}`,
        deploymentDate: new Date().toISOString(),
        cost: arCost,
        bundleSize: bundleContent.length,
        version: '0.2.0'
      };
      
      await fs.writeFile(
        path.join(__dirname, '../deployment-info.json'),
        JSON.stringify(deploymentInfo, null, 2)
      );
      
      console.log('💾 Deployment info saved to deployment-info.json');
      
      // If using ArLocal, mine a block
      if (process.env.ARWEAVE_HOST === 'localhost' || process.env.ARWEAVE_HOST === 'arlocal') {
        console.log('⛏️  Mining block in ArLocal...');
        try {
          await fetch(`http://localhost:1984/mine`, { method: 'POST' });
          console.log('✅ Block mined successfully');
        } catch (error) {
          console.log('⚠️  Failed to mine block:', error.message);
        }
      }
      
      return deploymentInfo;
    } else {
      throw new Error(`Deployment failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🎯 RATi Frontend Deployment to Arweave');
  console.log('=====================================');
  
  // Check if wallet exists
  const walletPath = path.join(WALLETS_DIR, 'wallet.json');
  try {
    await fs.access(walletPath);
  } catch {
    console.error('❌ wallet.json not found in wallets directory');
    console.log('💡 Create a wallet first or copy your existing wallet file');
    process.exit(1);
  }
  
  // Build frontend
  await buildFrontend();
  
  // Create single-page bundle
  const bundleContent = await createSinglePageBundle();
  
  // Deploy to Arweave
  const deploymentInfo = await deployToArweave(bundleContent);
  
  console.log('🎉 Deployment complete!');
  console.log(`🌐 Your app is now permanently stored on Arweave at: ${deploymentInfo.url}`);
}

// Run the deployment if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as deployFrontend };
