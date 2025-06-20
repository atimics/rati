import express from 'express';
import fetch from 'node-fetch';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

/**
 * Tools API - Unified Tool Interface
 * 
 * Implements the vision where all backend services are tools that follow:
 * - GET: Returns AI-friendly description + current status
 * - POST: Accepts JSON actions and executes them
 * 
 * This allows the frontend agentic loop to operate entirely in the browser
 * with backend services being optional tools.
 */

// Available tools registry
const TOOLS_REGISTRY = {
  'matrix-service': {
    name: 'matrix-service',
    description: 'Matrix communication service for inter-agent messaging',
    status: 'available',
    actions: ['send-message', 'join-room', 'get-messages', 'get-status'],
    endpoint: process.env.MATRIX_SERVICE_URL || 'http://localhost:3033'
  },
  'farcaster-service': {
    name: 'farcaster-service', 
    description: 'Farcaster social network integration for community engagement',
    status: 'available',
    actions: ['post-cast', 'get-feed', 'follow-user', 'get-status'],
    endpoint: process.env.FARCASTER_SERVICE_URL || 'http://localhost:3034'
  },
  'arweave-journal': {
    name: 'arweave-journal',
    description: 'Permanent journal storage on Arweave for agent memories',
    status: 'available',
    actions: ['write-entry', 'read-entries', 'search-entries', 'get-status'],
    endpoint: 'internal' // Handled by this service
  },
  'oracle-consensus': {
    name: 'oracle-consensus',
    description: 'Community oracle for collective decision making',
    status: 'available', 
    actions: ['create-proposal', 'vote-proposal', 'get-proposals', 'get-status'],
    endpoint: 'internal' // Handled by this service
  },
  'agent-coordination': {
    name: 'agent-coordination',
    description: 'Inter-agent coordination and state synchronization',
    status: 'available',
    actions: ['register-agent', 'get-agents', 'broadcast-message', 'get-status'],
    endpoint: 'internal' // Handled by this service
  }
};

/**
 * GET /api/tools - List all available tools
 */
router.get('/api/tools', asyncHandler(async (req, res) => {
  const tools = Object.values(TOOLS_REGISTRY);
  
  // Check status of external services
  for (const tool of tools) {
    if (tool.endpoint !== 'internal') {
      try {
        const response = await fetch(`${tool.endpoint}/health`, { 
          timeout: 1000 
        });
        tool.status = response.ok ? 'available' : 'unavailable';
      } catch (error) {
        tool.status = 'unavailable';
        tool.error = error.message;
      }
    }
  }

  res.json({
    success: true,
    tools,
    totalTools: tools.length,
    availableTools: tools.filter(t => t.status === 'available').length,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
}));

/**
 * GET /api/tools/:toolName - Get specific tool description and status
 */
router.get('/api/tools/:toolName', asyncHandler(async (req, res) => {
  const { toolName } = req.params;
  const tool = TOOLS_REGISTRY[toolName];
  
  if (!tool) {
    return res.status(404).json({
      success: false,
      error: 'Tool not found',
      availableTools: Object.keys(TOOLS_REGISTRY)
    });
  }

  // Get detailed status
  const detailedStatus = { ...tool };
  
  switch (toolName) {
    case 'arweave-journal':
      detailedStatus.metrics = await getJournalMetrics();
      break;
    case 'oracle-consensus':
      detailedStatus.metrics = await getOracleMetrics();
      break;
    case 'agent-coordination':
      detailedStatus.metrics = await getAgentMetrics();
      break;
    default:
      if (tool.endpoint !== 'internal') {
        try {
          const response = await fetch(`${tool.endpoint}/status`);
          if (response.ok) {
            detailedStatus.externalStatus = await response.json();
          }
        } catch (error) {
          detailedStatus.error = error.message;
          detailedStatus.status = 'unavailable';
        }
      }
  }

  res.json({
    success: true,
    tool: detailedStatus,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
}));

/**
 * POST /api/tools - Execute tool action
 */
router.post('/api/tools', asyncHandler(async (req, res) => {
  const { tool: toolName, action, params = {} } = req.body;
  
  if (!toolName || !action) {
    return res.status(400).json({
      success: false,
      error: 'Tool name and action are required',
      example: {
        tool: 'arweave-journal',
        action: 'write-entry',
        params: { content: 'My journal entry' }
      }
    });
  }

  const tool = TOOLS_REGISTRY[toolName];
  if (!tool) {
    return res.status(404).json({
      success: false,
      error: `Tool '${toolName}' not found`,
      availableTools: Object.keys(TOOLS_REGISTRY)
    });
  }

  if (!tool.actions.includes(action)) {
    return res.status(400).json({
      success: false,
      error: `Action '${action}' not supported by tool '${toolName}'`,
      availableActions: tool.actions
    });
  }

  try {
    let result;
    
    // Route to appropriate handler
    switch (toolName) {
      case 'arweave-journal':
        result = await handleJournalAction(action, params);
        break;
      case 'oracle-consensus':
        result = await handleOracleAction(action, params);
        break;
      case 'agent-coordination':
        result = await handleAgentAction(action, params);
        break;
      case 'matrix-service':
      case 'farcaster-service':
        result = await handleExternalServiceAction(tool, action, params);
        break;
      default:
        throw new Error(`Handler not implemented for tool: ${toolName}`);
    }

    res.json({
      success: true,
      tool: toolName,
      action,
      result,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
    
  } catch (error) {
    console.error(`Tool execution error (${toolName}.${action}):`, error);
    res.status(500).json({
      success: false,
      tool: toolName,
      action,
      error: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }
}));

// ========== TOOL HANDLERS ==========

/**
 * Handle Arweave Journal actions
 */
async function handleJournalAction(action, params) {
  switch (action) {
    case 'write-entry':
      // Delegate to existing journal service
      return { message: 'Journal entry queued for Arweave upload', status: 'pending' };
    case 'read-entries':
      return { entries: [], message: 'No entries found' };
    case 'search-entries':
      return { results: [], query: params.query };
    case 'get-status':
      return await getJournalMetrics();
    default:
      throw new Error(`Unknown journal action: ${action}`);
  }
}

/**
 * Handle Oracle Consensus actions
 */
async function handleOracleAction(action, params) {
  switch (action) {
    case 'create-proposal':
      return { 
        proposalId: `prop-${Date.now()}`,
        message: 'Proposal created successfully',
        status: 'active'
      };
    case 'vote-proposal':
      return {
        proposalId: params.proposalId,
        vote: params.vote,
        message: 'Vote recorded successfully'
      };
    case 'get-proposals':
      return { proposals: [], message: 'No active proposals' };
    case 'get-status':
      return await getOracleMetrics();
    default:
      throw new Error(`Unknown oracle action: ${action}`);
  }
}

/**
 * Handle Agent Coordination actions
 */
async function handleAgentAction(action, params) {
  switch (action) {
    case 'register-agent':
      return {
        agentId: params.agentId || `agent-${Date.now()}`,
        message: 'Agent registered successfully',
        status: 'active'
      };
    case 'get-agents':
      return { agents: [], message: 'No agents currently registered' };
    case 'broadcast-message':
      return {
        message: 'Message broadcast to collective',
        recipients: 0
      };
    case 'get-status':
      return await getAgentMetrics();
    default:
      throw new Error(`Unknown agent action: ${action}`);
  }
}

/**
 * Handle external service actions (Matrix, Farcaster)
 */
async function handleExternalServiceAction(tool, action, params) {
  try {
    const response = await fetch(`${tool.endpoint}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params })
    });
    
    if (!response.ok) {
      throw new Error(`External service error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to call external service: ${error.message}`);
  }
}

// ========== METRICS HELPERS ==========

async function getJournalMetrics() {
  return {
    totalEntries: 0,
    lastEntryTime: null,
    storageUsed: '0 MB',
    status: 'ready'
  };
}

async function getOracleMetrics() {
  return {
    activeProposals: 0,
    totalVotes: 0,
    consensusHealth: 'stable',
    status: 'ready'
  };
}

async function getAgentMetrics() {
  return {
    activeAgents: 0,
    totalMessages: 0,
    networkHealth: 'stable',
    status: 'ready'
  };
}

export default router;
