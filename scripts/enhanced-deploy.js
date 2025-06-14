#!/usr/bin/env node

// Enhanced deployment script with state management
import fs from 'fs';
import path from 'path';
import Arweave from 'arweave';
import { createDataItemSigner, message, spawn } from '@permaweb/aoconnect';

const DEPLOYMENT_INFO_FILE = './deployment-info.json';
const ENV_FILE = './.env';

// Load or create deployment state
function loadDeploymentState() {
    if (fs.existsSync(DEPLOYMENT_INFO_FILE)) {
        return JSON.parse(fs.readFileSync(DEPLOYMENT_INFO_FILE, 'utf-8'));
    }
    return {
        genesis_txid: null,
        oracle_process_id: null,
        avatar_process_id: null,
        deployment_date: null,
        oracle_addresses: [],
        environment: process.env.NODE_ENV || 'development'
    };
}

function saveDeploymentState(state) {
    fs.writeFileSync(DEPLOYMENT_INFO_FILE, JSON.stringify(state, null, 2));
    console.log(`✅ Deployment state saved to ${DEPLOYMENT_INFO_FILE}`);
}

function updateEnvFile(updates) {
    let envContent = '';
    
    if (fs.existsSync(ENV_FILE)) {
        envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    }
    
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, newLine);
        } else {
            envContent += `\n${newLine}`;
        }
    }
    
    fs.writeFileSync(ENV_FILE, envContent);
    console.log(`✅ Updated ${ENV_FILE} with new deployment values`);
}

async function deployGenesis() {
    console.log('🚀 Deploying Genesis Document...');
    
    const state = loadDeploymentState();
    
    if (state.genesis_txid) {
        console.log(`⚠️  Genesis already deployed: ${state.genesis_txid}`);
        return state.genesis_txid;
    }
    
    // Load poems from markdown files
    const poem1 = fs.readFileSync('./scrolls/scroll-1.md', 'utf-8');
    const poem2 = fs.readFileSync('./scrolls/scroll-2.md', 'utf-8');
    const foundingText = `# The Founding Scrolls\n\n## Scroll I\n\n${poem1}\n\n## Scroll II\n\n${poem2}`;
    
    // Initialize Arweave
    const arweave = Arweave.init({
        host: process.env.ARWEAVE_HOST || 'localhost',
        port: parseInt(process.env.ARWEAVE_PORT || '1984'),
        protocol: process.env.ARWEAVE_PROTOCOL || 'http'
    });
    
    // Load wallet
    const key = JSON.parse(fs.readFileSync('./wallets/wallet.json').toString());
    const walletAddress = await arweave.wallets.jwkToAddress(key);
    console.log(`📝 Using wallet: ${walletAddress}`);
    
    // Create and post transaction
    const transaction = await arweave.createTransaction({ data: foundingText }, key);
    transaction.addTag('App-Name', 'RATi');
    transaction.addTag('Content-Type', 'text/markdown');
    transaction.addTag('Type', 'Genesis-Scroll');
    transaction.addTag('Version', '1.0');
    transaction.addTag('Deployment-Date', new Date().toISOString());
    
    await arweave.transactions.sign(transaction, key);
    const response = await arweave.transactions.post(transaction);
    
    console.log(`📤 Transaction posted: ${response.status}`);
    console.log(`🎯 Genesis Scroll TXID: ${transaction.id}`);
    
    // Update state
    state.genesis_txid = transaction.id;
    state.deployment_date = new Date().toISOString();
    saveDeploymentState(state);
    
    // Update environment file
    updateEnvFile({
        'VITE_GENESIS_TXID': transaction.id
    });
    
    return transaction.id;
}

async function deployProcesses() {
    console.log('🚀 Deploying AO Processes...');
    
    const state = loadDeploymentState();
    
    if (state.oracle_process_id && state.avatar_process_id) {
        console.log(`⚠️  Processes already deployed:`);
        console.log(`   Oracle: ${state.oracle_process_id}`);
        console.log(`   Cell: ${state.cell_process_id}`);
        return { oracle: state.oracle_process_id, cell: state.cell_process_id };
    }
    
    // Load wallet and create signer
    const wallet = JSON.parse(fs.readFileSync('./wallets/wallet.json').toString());
    const signer = createDataItemSigner(wallet);
    
    // Load Lua blueprints
    const oracleBlueprint = fs.readFileSync('./src/oracle/oracle.lua', 'utf-8');
    const cellBlueprint = fs.readFileSync('./src/cell/cell.lua', 'utf-8');
    
    // Oracle addresses configuRATion
    const oracleAddresses = process.env.ORACLE_ADDRESSES?.split(',') || [
        "YOUR_WALLET_ADDRESS_1",
        "YOUR_WALLET_ADDRESS_2",
        "YOUR_WALLET_ADDRESS_3"
    ];
    
    const moduleId = process.env.AO_MODULE_ID || "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk";
    const schedulerId = process.env.AO_SCHEDULER_ID || "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA";
    
    let oracleProcessId = state.oracle_process_id;
    let cellProcessId = state.cell_process_id;
    
    // Deploy Oracle Process
    if (!oracleProcessId) {
        console.log('📡 Spawning Oracle Process...');
        oracleProcessId = await spawn({
            module: moduleId,
            scheduler: schedulerId,
            signer,
            tags: [
                { name: 'Name', value: 'RATi-Oracle' },
                { name: 'Type', value: 'Oracle-Council' },
                { name: 'Version', value: '1.0' }
            ]
        });
        
        console.log(`✅ Oracle Process spawned: ${oracleProcessId}`);
        
        // Initialize Oracle with blueprint
        await message({
            process: oracleProcessId,
            signer,
            tags: [{ name: 'Action', value: 'Eval' }],
            data: oracleBlueprint
        });
        
        // Set oracle addresses
        await message({
            process: oracleProcessId,
            signer,
            tags: [{ name: 'Action', value: 'Eval' }],
            data: `Oracles = ${JSON.stringify(oracleAddresses)}`
        });
        
        console.log('✅ Oracle Process initialized');
    }
    
    // Deploy Cell Process
    if (!cellProcessId) {
        console.log('📱 Spawning Cell Process...');
        cellProcessId = await spawn({
            module: moduleId,
            scheduler: schedulerId,
            signer,
            tags: [
                { name: 'Name', value: 'RATi-Cell-1' },
                { name: 'Type', value: 'User-Cell' },
                { name: 'Version', value: '1.0' }
            ]
        });
        
        console.log(`✅ Cell Process spawned: ${cellProcessId}`);
        
        // Initialize Cell with blueprint
        await message({
            process: cellProcessId,
            signer,
            tags: [{ name: 'Action', value: 'Eval' }],
            data: cellBlueprint
        });
        
        console.log('✅ Cell Process initialized');
    }
    
    // Update state
    state.oracle_process_id = oracleProcessId;
    state.cell_process_id = cellProcessId;
    state.oracle_addresses = oracleAddresses;
    state.deployment_date = state.deployment_date || new Date().toISOString();
    saveDeploymentState(state);
    
    // Update environment file
    updateEnvFile({
        'VITE_ORACLE_PROCESS_ID': oracleProcessId,
        'VITE_CELL_PROCESS_ID': cellProcessId
    });
    
    return { oracle: oracleProcessId, cell: cellProcessId };
}

async function fullDeployment() {
    console.log('🎯 Starting Full Deployment...');
    console.log('================================');
    
    try {
        // Deploy genesis first
        const genesisTxid = await deployGenesis();
        console.log('');
        
        // Then deploy processes
        const processes = await deployProcesses();
        console.log('');
        
        console.log('🎉 DEPLOYMENT COMPLETE!');
        console.log('========================');
        console.log(`📜 Genesis TXID: ${genesisTxid}`);
        console.log(`🏛️  Oracle Process: ${processes.oracle}`);
        console.log(`📱 Cell Process: ${processes.cell}`);
        console.log('');
        console.log('💡 Next steps:');
        console.log('   1. Update your frontend environment variables');
        console.log('   2. Configure oracle member addresses');
        console.log('   3. Test the system with ./health-check.sh');
        console.log('   4. Access the dashboard at http://localhost:3030');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// CLI interface
const command = process.argv[2];

switch (command) {
    case 'genesis':
        deployGenesis().catch(console.error);
        break;
    case 'processes':
        deployProcesses().catch(console.error);
        break;
    case 'full':
    case undefined:
        fullDeployment().catch(console.error);
        break;
    default:
        console.log('Usage: node enhanced-deploy.js [genesis|processes|full]');
        process.exit(1);
}
