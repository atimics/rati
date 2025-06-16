import { EventEmitter } from 'events';
import crypto from 'crypto';
import { createDataItemSigner, message, spawn } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Ensure crypto polyfill for ao-connect
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}

export class DeploymentManager extends EventEmitter {
    constructor() {
        super();
        this.statePath = '/app/data/deployment-state.json';
        this.logsPath = '/app/data/deployment-logs.json';
        this.arweave = Arweave.init({
            host: process.env.ARWEAVE_HOST || 'arweave.net',
            port: parseInt(process.env.ARWEAVE_PORT) || 443,
            protocol: process.env.ARWEAVE_PROTOCOL || 'https'
        });
        
        this.initializeState();
    }

    initializeState() {
        if (!existsSync(this.statePath)) {
            this.saveState({
                genesis_txid: null,
                oracle_process_id: null,
                cell_process_id: null,
                deployment_date: null,
                oracle_addresses: [],
                environment: process.env.NODE_ENV || 'development',
                status: 'idle'
            });
        }

        if (!existsSync(this.logsPath)) {
            this.saveLogs([]);
        }
    }

    loadState() {
        return JSON.parse(readFileSync(this.statePath, 'utf-8'));
    }

    saveState(state) {
        writeFileSync(this.statePath, JSON.stringify(state, null, 2));
    }

    loadLogs() {
        return JSON.parse(readFileSync(this.logsPath, 'utf-8'));
    }

    saveLogs(logs) {
        writeFileSync(this.logsPath, JSON.stringify(logs, null, 2));
    }

    log(level, message, data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };

        const logs = this.loadLogs();
        logs.push(logEntry);
        
        // Keep only last 1000 logs
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }

        this.saveLogs(logs);
        this.emit('log', logEntry);
        console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    }

    async getStatus() {
        return this.loadState();
    }

    async getLogs() {
        return this.loadLogs();
    }

    async loadWallet() {
        const walletPath = '/app/wallets/wallet.json';
        if (!existsSync(walletPath)) {
            throw new Error('Wallet not found. Please ensure wallet.json exists in the wallets directory.');
        }
        return JSON.parse(readFileSync(walletPath, 'utf-8'));
    }

    async deployGenesis(_options = {}) {
        this.log('info', 'Starting genesis deployment');
        
        const state = this.loadState();
        state.status = 'deploying_genesis';
        this.saveState(state);
        this.emit('status', state);

        try {
            const wallet = await this.loadWallet();

            // Read genesis scroll content
            const scrollPaths = [
                '/app/scrolls/scroll-1.md',
                '/app/scrolls/scroll-2.md'
            ];

            let genesisContent = '';
            for (const scrollPath of scrollPaths) {
                if (existsSync(scrollPath)) {
                    genesisContent += readFileSync(scrollPath, 'utf-8') + '\n\n';
                }
            }

            if (!genesisContent) {
                throw new Error('No genesis scrolls found');
            }

            this.log('info', 'Creating genesis transaction on Arweave');

            const transaction = await this.arweave.createTransaction({
                data: genesisContent
            }, wallet);

            transaction.addTag('Type', 'Genesis-Scroll');
            transaction.addTag('App-Name', 'RATi');
            transaction.addTag('Content-Type', 'text/markdown');
            transaction.addTag('Version', '1.0');

            await this.arweave.transactions.sign(transaction, wallet);
            await this.arweave.transactions.post(transaction);

            this.log('info', 'Genesis transaction posted', { txid: transaction.id });

            state.genesis_txid = transaction.id;
            state.deployment_date = new Date().toISOString();
            state.status = 'genesis_deployed';
            this.saveState(state);
            this.emit('status', state);

            return { success: true, txid: transaction.id };

        } catch (error) {
            this.log('error', 'Genesis deployment failed', error.message);
            state.status = 'error';
            this.saveState(state);
            this.emit('error', error);
            throw error;
        }
    }

    async deployOracle(_options = {}) {
        this.log('info', 'Starting oracle deployment');

        const state = this.loadState();
        state.status = 'deploying_oracle';
        this.saveState(state);
        this.emit('status', state);

        try {
            const wallet = await this.loadWallet();
            const signer = createDataItemSigner(wallet);

            this.log('info', 'Spawning oracle process');

            const oracleProcessId = await spawn({
                module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk", 
                scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
                signer,
                tags: [{ name: 'Name', value: 'RATi-Oracle' }]
            });

            this.log('info', 'Oracle process spawned', { processId: oracleProcessId });

            // Initialize oracle with Lua code
            const oracleCode = readFileSync('/app/src/oracle/oracle.lua', 'utf-8');
            
            await message({
                process: oracleProcessId,
                signer,
                data: oracleCode,
                tags: [{ name: 'Action', value: 'Eval' }]
            });

            this.log('info', 'Oracle initialized with Lua code');

            state.oracle_process_id = oracleProcessId;
            state.status = 'oracle_deployed';
            this.saveState(state);
            this.emit('status', state);

            return { success: true, processId: oracleProcessId };

        } catch (error) {
            this.log('error', 'Oracle deployment failed', error.message);
            state.status = 'error';
            this.saveState(state);
            this.emit('error', error);
            throw error;
        }
    }

    async deployAgent(_options = {}) {
        this.log('info', 'Starting agent deployment');

        const state = this.loadState();
        state.status = 'deploying_agent';
        this.saveState(state);
        this.emit('status', state);

        try {
            const wallet = await this.loadWallet();
            const signer = createDataItemSigner(wallet);

            // Check for agent prompt
            const promptPath = '/app/agent/prompt.md';
            if (!existsSync(promptPath)) {
                throw new Error('Agent prompt.md not found');
            }

            const promptData = readFileSync(promptPath, 'utf-8');
            this.log('info', 'Agent personality loaded', { preview: promptData.substring(0, 100) + '...' });

            // Spawn agent process
            const agentProcessId = await spawn({
                module: "SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk",
                scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
                signer,
                tags: [{ name: 'Name', value: 'RATi-AI-Agent' }]
            });

            this.log('info', 'Agent process spawned', { processId: agentProcessId });

            // Initialize with avatar blueprint
            const avatarCode = readFileSync('/app/src/avatar/avatar.lua', 'utf-8');
            
            await message({
                process: agentProcessId,
                signer,
                data: avatarCode,
                tags: [{ name: 'Action', value: 'Eval' }]
            });

            // Store personality on-chain
            const personalityTx = await this.arweave.createTransaction({
                data: promptData
            }, wallet);

            personalityTx.addTag('Type', 'Agent-Personality');
            personalityTx.addTag('Agent-Process-ID', agentProcessId);
            personalityTx.addTag('Content-Type', 'text/markdown');

            await this.arweave.transactions.sign(personalityTx, wallet);
            await this.arweave.transactions.post(personalityTx);

            this.log('info', 'Agent personality stored on-chain', { txid: personalityTx.id });

            // Link agent to personality
            await message({
                process: agentProcessId,
                signer,
                data: JSON.stringify({
                    personality_txid: personalityTx.id,
                    oracle_process: state.oracle_process_id
                }),
                tags: [{ name: 'Action', value: 'Initialize' }]
            });

            state.cell_process_id = agentProcessId;
            state.status = 'agent_deployed';
            this.saveState(state);
            this.emit('status', state);

            return { 
                success: true, 
                processId: agentProcessId, 
                personalityTxid: personalityTx.id 
            };

        } catch (error) {
            this.log('error', 'Agent deployment failed', error.message);
            state.status = 'error';
            this.saveState(state);
            this.emit('error', error);
            throw error;
        }
    }

    async fullDeploy(options = {}) {
        this.log('info', 'Starting full deployment pipeline');

        try {
            // Deploy in sequence
            const genesisResult = await this.deployGenesis(options);
            this.log('info', 'Genesis deployment completed');

            const oracleResult = await this.deployOracle(options);
            this.log('info', 'Oracle deployment completed');

            const agentResult = await this.deployAgent(options);
            this.log('info', 'Agent deployment completed');

            const state = this.loadState();
            state.status = 'fully_deployed';
            this.saveState(state);
            this.emit('status', state);

            this.log('info', 'Full deployment pipeline completed successfully');

            return {
                success: true,
                genesis: genesisResult,
                oracle: oracleResult,
                agent: agentResult,
                state
            };

        } catch (error) {
            this.log('error', 'Full deployment failed', error.message);
            const state = this.loadState();
            state.status = 'error';
            this.saveState(state);
            this.emit('error', error);
            throw error;
        }
    }

    async reset() {
        this.log('info', 'Resetting deployment state');

        const newState = {
            genesis_txid: null,
            oracle_process_id: null,
            cell_process_id: null,
            deployment_date: null,
            oracle_addresses: [],
            environment: process.env.NODE_ENV || 'development',
            status: 'idle'
        };

        this.saveState(newState);
        this.saveLogs([]);
        this.emit('status', newState);

        return { success: true, message: 'Deployment state reset' };
    }
}
