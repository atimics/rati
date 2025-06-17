import express from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { message, dryrun, createDataItemSigner } from '@permaweb/aoconnect';
import { loadWallet } from '../services/deployment.js';

const router = express.Router();

/**
 * Get oracle status and community context
 */
router.get('/api/oracle/:oracleId/status', asyncHandler(async (req, res) => {
  const { oracleId } = req.params;

  try {
    // Query oracle for community status
    const statusResult = await dryrun({
      process: oracleId,
      tags: [
        { name: 'Action', value: 'Get-Community-Status' }
      ]
    });

    let oracleStatus = {
      activeProposals: 0,
      recentActivity: 'quiet',
      consensusHealth: 'stable',
      communityMood: 'neutral',
      lastUpdate: new Date().toISOString()
    };

    // Parse response if available
    if (statusResult.Messages && statusResult.Messages.length > 0) {
      try {
        const message = statusResult.Messages[0];
        if (message.Data) {
          const parsedStatus = JSON.parse(message.Data);
          oracleStatus = { ...oracleStatus, ...parsedStatus };
        }
      } catch (parseError) {
        console.warn('Could not parse oracle status response:', parseError);
      }
    }

    res.json({
      oracleId,
      status: oracleStatus,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Oracle status query error:', error);
    
    // Return default status on error
    res.json({
      oracleId,
      status: {
        activeProposals: 0,
        recentActivity: 'unknown',
        consensusHealth: 'unknown',
        communityMood: 'unknown',
        lastUpdate: new Date().toISOString(),
        error: 'Could not connect to oracle'
      },
      requestId: req.requestId
    });
  }
}));

/**
 * Get recent proposals from oracle
 */
router.get('/api/oracle/:oracleId/proposals', asyncHandler(async (req, res) => {
  const { oracleId } = req.params;
  const { limit = 10, status = 'all' } = req.query;

  try {
    // Query oracle for recent proposals
    const proposalsResult = await dryrun({
      process: oracleId,
      tags: [
        { name: 'Action', value: 'Get-Recent-Proposals' },
        { name: 'Limit', value: limit.toString() },
        { name: 'Status', value: status }
      ]
    });

    let proposals = [];

    if (proposalsResult.Messages && proposalsResult.Messages.length > 0) {
      try {
        const message = proposalsResult.Messages[0];
        if (message.Data) {
          proposals = JSON.parse(message.Data);
        }
      } catch (parseError) {
        console.warn('Could not parse proposals response:', parseError);
      }
    }

    res.json({
      oracleId,
      proposals,
      totalFound: proposals.length,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Oracle proposals query error:', error);
    
    res.json({
      oracleId,
      proposals: [],
      totalFound: 0,
      error: 'Could not retrieve proposals',
      requestId: req.requestId
    });
  }
}));

/**
 * Submit a proposal to the oracle
 */
router.post('/api/oracle/:oracleId/propose', asyncHandler(async (req, res) => {
  const { oracleId } = req.params;
  const { content, title, category = 'general' } = req.body;

  if (!content) {
    throw new ApiError(
      'Proposal content is required',
      'MISSING_CONTENT',
      400,
      null,
      ['Provide proposal content in request body']
    );
  }

  try {
    const wallet = await loadWallet();
    const signer = createDataItemSigner(wallet);

    // Submit proposal to oracle
    const proposalData = {
      title: title || 'Untitled Proposal',
      content,
      category,
      timestamp: new Date().toISOString()
    };

    const messageId = await message({
      process: oracleId,
      signer,
      tags: [
        { name: 'Action', value: 'Ping' },
        { name: 'Category', value: category },
        { name: 'Title', value: proposalData.title }
      ],
      data: JSON.stringify(proposalData)
    });

    res.json({
      success: true,
      proposalId: messageId,
      oracleId,
      message: 'Proposal submitted to oracle council',
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Proposal submission error:', error);
    throw new ApiError(
      'Failed to submit proposal',
      'PROPOSAL_SUBMIT_ERROR',
      500,
      { oracleId, originalError: error.message },
      [
        'Check oracle process ID',
        'Verify wallet configuration',
        'Try submitting again'
      ]
    );
  }
}));

/**
 * Get agent process list from oracle (for agent processor)
 */
router.get('/api/oracle/:oracleId/agent-list', asyncHandler(async (req, res) => {
  const { oracleId } = req.params;

  try {
    // Query oracle for published agent process list
    const agentListResult = await dryrun({
      process: oracleId,
      tags: [
        { name: 'Action', value: 'Get-Agent-Process-List' }
      ]
    });

    let agentProcesses = [];

    if (agentListResult.Messages && agentListResult.Messages.length > 0) {
      try {
        const message = agentListResult.Messages[0];
        if (message.Data) {
          const parsedData = JSON.parse(message.Data);
          agentProcesses = parsedData.processes || parsedData;
        }
      } catch (parseError) {
        console.warn('Could not parse agent list response:', parseError);
      }
    }

    res.json({
      oracleId,
      agentProcesses,
      totalAgents: agentProcesses.length,
      lastUpdate: new Date().toISOString(),
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Agent list query error:', error);
    
    res.json({
      oracleId,
      agentProcesses: [],
      totalAgents: 0,
      error: 'Could not retrieve agent list',
      requestId: req.requestId
    });
  }
}));

/**
 * Get oracle status and community context (query parameter version for backward compatibility)
 */
router.get('/api/oracle/status', asyncHandler(async (req, res) => {
  const { oracleId } = req.query;

  if (!oracleId) {
    throw new ApiError(
      'Oracle ID is required',
      'MISSING_ORACLE_ID',
      400,
      null,
      ['Provide oracleId as query parameter or use /api/oracle/:oracleId/status']
    );
  }

  try {
    // Query oracle for community status
    const statusResult = await dryrun({
      process: oracleId,
      tags: [
        { name: 'Action', value: 'Get-Community-Status' }
      ]
    });

    let oracleStatus = {
      activeProposals: 0,
      recentActivity: 'quiet',
      consensusHealth: 'stable',
      communityMood: 'neutral',
      lastUpdate: new Date().toISOString()
    };

    // Parse response if available
    if (statusResult.Messages && statusResult.Messages.length > 0) {
      try {
        const message = statusResult.Messages[0];
        if (message.Data) {
          const parsedStatus = JSON.parse(message.Data);
          oracleStatus = { ...oracleStatus, ...parsedStatus };
        }
      } catch (parseError) {
        console.warn('Could not parse oracle status response:', parseError);
      }
    }

    res.json({
      oracleId,
      status: oracleStatus,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Oracle status query error:', error);
    
    // Return default status on error
    res.json({
      oracleId,
      status: {
        activeProposals: 0,
        recentActivity: 'unknown',
        consensusHealth: 'unknown',
        communityMood: 'unknown',
        lastUpdate: new Date().toISOString(),
        error: 'Could not connect to oracle'
      },
      requestId: req.requestId
    });
  }
}));

/**
 * Get agent process list from oracle (query parameter version for backward compatibility)
 */
router.get('/api/oracle/agent-list', asyncHandler(async (req, res) => {
  const { oracleId } = req.query;

  if (!oracleId) {
    throw new ApiError(
      'Oracle ID is required',
      'MISSING_ORACLE_ID',
      400,
      null,
      ['Provide oracleId as query parameter or use /api/oracle/:oracleId/agent-list']
    );
  }

  try {
    // Query oracle for published agent process list
    const agentListResult = await dryrun({
      process: oracleId,
      tags: [
        { name: 'Action', value: 'Get-Agent-Process-List' }
      ]
    });

    let agentProcesses = [];

    if (agentListResult.Messages && agentListResult.Messages.length > 0) {
      try {
        const message = agentListResult.Messages[0];
        if (message.Data) {
          const parsedData = JSON.parse(message.Data);
          agentProcesses = parsedData.processes || parsedData;
        }
      } catch (parseError) {
        console.warn('Could not parse agent list response:', parseError);
      }
    }

    res.json({
      oracleId,
      agentList: agentProcesses, // Using agentList to match frontend expectation
      agentProcesses,
      totalAgents: agentProcesses.length,
      lastUpdate: new Date().toISOString(),
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Agent list query error:', error);
    
    res.json({
      oracleId,
      agentList: [], // Using agentList to match frontend expectation
      agentProcesses: [],
      totalAgents: 0,
      error: 'Could not retrieve agent list',
      requestId: req.requestId
    });
  }
}));

export default router;
