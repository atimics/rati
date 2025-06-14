import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { DeploymentManager } from './deployment-manager.js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize deployment manager
const deploymentManager = new DeploymentManager();

// WebSocket connections for real-time updates
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to deployment service');
    
    ws.on('close', () => {
        clients.delete(ws);
    });
});

// Broadcast to all connected clients
function broadcast(message) {
    clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(message));
        }
    });
}

// Set up deployment manager event listeners
deploymentManager.on('status', (status) => {
    broadcast({ type: 'status', data: status });
});

deploymentManager.on('log', (log) => {
    broadcast({ type: 'log', data: log });
});

deploymentManager.on('error', (error) => {
    broadcast({ type: 'error', data: error });
});

// API Routes

// Get deployment status
app.get('/api/status', async (req, res) => {
    try {
        const status = await deploymentManager.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get deployment logs
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await deploymentManager.getLogs();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy genesis scroll
app.post('/api/deploy/genesis', async (req, res) => {
    try {
        const result = await deploymentManager.deployGenesis(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy oracle
app.post('/api/deploy/oracle', async (req, res) => {
    try {
        const result = await deploymentManager.deployOracle(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy agent
app.post('/api/deploy/agent', async (req, res) => {
    try {
        const result = await deploymentManager.deployAgent(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Full deployment pipeline
app.post('/api/deploy/full', async (req, res) => {
    try {
        const result = await deploymentManager.fullDeploy(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset deployment state
app.post('/api/reset', async (req, res) => {
    try {
        const result = await deploymentManager.reset();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get environment configuRATion
app.get('/api/config', (req, res) => {
    try {
        const configPath = '/app/config/deployment.json';
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            res.json(config);
        } else {
            res.json({ 
                arweave: {
                    host: process.env.ARWEAVE_HOST || 'arweave.net',
                    port: process.env.ARWEAVE_PORT || 443,
                    protocol: process.env.ARWEAVE_PROTOCOL || 'https'
                },
                environment: process.env.NODE_ENV || 'development'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3032;

server.listen(PORT, () => {
    console.log(`🚀 Deployment service running on port ${PORT}`);
    console.log(`📊 WebSocket server ready for real-time updates`);
});
