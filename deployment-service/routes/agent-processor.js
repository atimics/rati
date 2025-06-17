import express from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { AgentProcessor } from '../services/agent-processor.js';

const router = express.Router();

// Global agent processor instance
let agentProcessor = null;

/**
 * Initialize agent processor with oracle
 */
router.post('/api/agent-processor/initialize', asyncHandler(async (req, res) => {
  const { oracleProcessId, sortingCriteria = 'activity', updateInterval = 300000 } = req.body;

  if (!oracleProcessId) {
    throw new ApiError(
      'Oracle process ID is required',
      'MISSING_ORACLE_ID',
      400,
      null,
      ['Provide oracleProcessId in request body']
    );
  }

  // Stop existing processor if running
  if (agentProcessor) {
    agentProcessor.stop();
  }

  // Create new processor
  agentProcessor = new AgentProcessor({
    oracleProcessId,
    sortingCriteria,
    updateInterval
  });

  // Set up event listeners
  agentProcessor.on('started', () => {
    console.log('Agent processor started');
  });

  agentProcessor.on('stopped', () => {
    console.log('Agent processor stopped');
  });

  agentProcessor.on('updateComplete', (data) => {
    console.log('Agent update cycle completed:', data);
  });

  agentProcessor.on('error', (error) => {
    console.error('Agent processor error:', error);
  });

  res.json({
    success: true,
    message: 'Agent processor initialized',
    config: {
      oracleProcessId,
      sortingCriteria,
      updateInterval
    },
    requestId: req.requestId
  });
}));

/**
 * Start the agent processor
 */
router.post('/api/agent-processor/start', asyncHandler(async (req, res) => {
  if (!agentProcessor) {
    throw new ApiError(
      'Agent processor not initialized',
      'PROCESSOR_NOT_INITIALIZED',
      400,
      null,
      ['Initialize processor first with POST /api/agent-processor/initialize']
    );
  }

  await agentProcessor.start();

  res.json({
    success: true,
    message: 'Agent processor started',
    status: agentProcessor.getStatus(),
    requestId: req.requestId
  });
}));

/**
 * Stop the agent processor
 */
router.post('/api/agent-processor/stop', asyncHandler(async (req, res) => {
  if (!agentProcessor) {
    throw new ApiError(
      'Agent processor not initialized',
      'PROCESSOR_NOT_INITIALIZED',
      400,
      null,
      ['Initialize processor first']
    );
  }

  agentProcessor.stop();

  res.json({
    success: true,
    message: 'Agent processor stopped',
    status: agentProcessor.getStatus(),
    requestId: req.requestId
  });
}));

/**
 * Get agent processor status
 */
router.get('/api/agent-processor/status', asyncHandler(async (req, res) => {
  if (!agentProcessor) {
    res.json({
      initialized: false,
      message: 'Agent processor not initialized',
      requestId: req.requestId
    });
    return;
  }

  const status = agentProcessor.getStatus();
  
  res.json({
    initialized: true,
    status,
    requestId: req.requestId
  });
}));

/**
 * Trigger manual agent update cycle
 */
router.post('/api/agent-processor/update', asyncHandler(async (req, res) => {
  if (!agentProcessor) {
    throw new ApiError(
      'Agent processor not initialized',
      'PROCESSOR_NOT_INITIALIZED',
      400,
      null,
      ['Initialize processor first']
    );
  }

  if (!agentProcessor.isRunning) {
    throw new ApiError(
      'Agent processor not running',
      'PROCESSOR_NOT_RUNNING',
      400,
      null,
      ['Start processor first with POST /api/agent-processor/start']
    );
  }

  // Trigger update cycle
  agentProcessor.processAgentUpdates().catch(error => {
    console.error('Manual update cycle failed:', error);
  });

  res.json({
    success: true,
    message: 'Manual update cycle triggered',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
}));

/**
 * Update agent processor configuration
 */
router.put('/api/agent-processor/config', asyncHandler(async (req, res) => {
  const { sortingCriteria, updateInterval } = req.body;

  if (!agentProcessor) {
    throw new ApiError(
      'Agent processor not initialized',
      'PROCESSOR_NOT_INITIALIZED',
      400,
      null,
      ['Initialize processor first']
    );
  }

  // Update configuration
  if (sortingCriteria) {
    agentProcessor.sortingCriteria = sortingCriteria;
  }

  if (updateInterval) {
    agentProcessor.updateInterval = updateInterval;
    
    // Restart timer if running
    if (agentProcessor.isRunning) {
      agentProcessor.stop();
      await agentProcessor.start();
    }
  }

  res.json({
    success: true,
    message: 'Agent processor configuration updated',
    config: {
      sortingCriteria: agentProcessor.sortingCriteria,
      updateInterval: agentProcessor.updateInterval
    },
    requestId: req.requestId
  });
}));

/**
 * Get recent agent updates for monitoring
 */
router.get('/api/agent-processor/recent-updates', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  if (!agentProcessor) {
    res.json({
      success: true,
      updates: [],
      message: 'Agent processor not initialized',
      requestId: req.requestId
    });
    return;
  }

  // Get recent updates from processor history
  const updates = agentProcessor.updateHistory
    ? agentProcessor.updateHistory.slice(-limit).reverse()
    : [];

  res.json({
    success: true,
    updates,
    totalCount: agentProcessor.updateHistory?.length || 0,
    requestId: req.requestId
  });
}));

/**
 * Manual trigger of agent update cycle
 */
router.post('/api/agent-processor/trigger-update', asyncHandler(async (req, res) => {
  if (!agentProcessor) {
    throw new ApiError(
      'Agent processor not initialized',
      'PROCESSOR_NOT_INITIALIZED',
      400,
      null,
      ['Initialize processor first']
    );
  }

  // Trigger manual update cycle
  setTimeout(async () => {
    try {
      await agentProcessor.processAgentUpdates();
    } catch (error) {
      console.error('Manual update cycle failed:', error);
    }
  }, 0);

  res.json({
    success: true,
    message: 'Agent update cycle triggered',
    requestId: req.requestId
  });
}));

export default router;
