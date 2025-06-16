import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';

// Import utilities and middleware
import { errorHandler, validateEnvironment } from './utils/errors.js';
import { requestId, requestLogger, corsConfig } from './middleware/index.js';
import { autoDeployIfNeeded, updateAgentEnvironment } from './services/deployment.js';

// Import routes
import healthRoutes from './routes/health.js';
import arweaveRoutes from './routes/arweave.js';
import deploymentRoutes from './routes/deployments.js';
import agentRoutes from './routes/agent.js';

// Journal routes
import journalRoutes from './routes/journal.js';

// Polyfill crypto for ao-connect in containerized environments
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}

// Validate environment on startup
try {
  // Set defaults for development if not provided
  if (!process.env.ARWEAVE_HOST) process.env.ARWEAVE_HOST = 'arlocal';
  if (!process.env.ARWEAVE_PORT) process.env.ARWEAVE_PORT = '1984';
  if (!process.env.ARWEAVE_PROTOCOL) process.env.ARWEAVE_PROTOCOL = 'http';
  
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  if (error.suggestions) {
    error.suggestions.forEach(suggestion => console.error(`  - ${suggestion}`));
  }
  process.exit(1);
}

// Create Express app
const app = express();
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

// Store WebSocket connections
const wsConnections = new Set();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected:', req.socket.remoteAddress);
  wsConnections.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    wsConnections.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsConnections.delete(ws);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to RATi Deployment Service',
    timestamp: new Date().toISOString()
  }));
});

// Broadcast function for WebSocket updates
function broadcast(data) {
  const message = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  });
  
  wsConnections.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        wsConnections.delete(ws);
      }
    }
  });
}

// Global middleware
app.use(cors(corsConfig()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(requestId);

// Add request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// Routes
app.use('/', healthRoutes);
app.use('/', arweaveRoutes);
app.use('/', deploymentRoutes);
app.use('/', agentRoutes);
app.use('/journal', journalRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    }
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3032;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  console.log(`🚀 RATi Deployment Service started`);
  console.log(`   - HTTP Server: http://${HOST}:${PORT}`);
  console.log(`   - WebSocket Server: ws://${HOST}:${PORT}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - Arweave: ${process.env.ARWEAVE_PROTOCOL || 'http'}://${process.env.ARWEAVE_HOST || 'arlocal'}:${process.env.ARWEAVE_PORT || 1984}`);
  
  // Auto-deploy if needed (in development mode)
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('🔍 Checking for existing deployment...');
      const seedData = await autoDeployIfNeeded();
      
      if (seedData.agent?.processId) {
        await updateAgentEnvironment(seedData.agent.processId);
      }
      
      console.log('✅ Auto-deployment check completed');
    } catch (error) {
      console.error('⚠️  Auto-deployment failed (continuing anyway):', error.message);
    }
  }
  
  console.log(`   - Ready for deployments! 🎯`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, server, broadcast };
