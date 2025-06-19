import express from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { message, dryrun, createDataItemSigner } from '@permaweb/aoconnect';
import { loadWallet } from '../services/deployment.js';
import { arweave } from '../services/arweave.js';

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

/**
 * Get oracle scrolls (Genesis scrolls from Arweave)
 */
router.get('/api/oracle/:oracleId/scrolls', asyncHandler(async (req, res) => {
  const { oracleId } = req.params;

  try {
    // In development with arlocal, GraphQL queries might not work reliably
    // Fall back to serving local scrolls content
    if (process.env.ARWEAVE_HOST === 'arlocal' || process.env.NODE_ENV === 'development') {
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        
        const scrolls = [];
        const scrollsPath = '/app/project-root/scrolls';
        
        try {
          const scrollFiles = await fs.readdir(scrollsPath);
          for (const file of scrollFiles.filter(f => f.endsWith('.md'))) {
            const content = await fs.readFile(path.join(scrollsPath, file), 'utf8');
            scrolls.push({
              id: file.replace('.md', ''),
              content,
              timestamp: new Date().toISOString(),
              height: null,
              tags: {
                'Type': 'Genesis-Scroll',
                'App-Name': 'RATi',
                'Version': '1.0'
              },
              version: '1.0'
            });
          }
        } catch (fsError) {
          console.warn('Could not read local scrolls:', fsError.message);
        }

        if (scrolls.length > 0) {
          return res.json({
            success: true,
            oracleId,
            scrolls,
            totalScrolls: scrolls.length,
            source: 'local-development',
            requestId: req.requestId
          });
        }
      } catch (importError) {
        console.warn('Could not import fs/path modules:', importError);
      }
    }

    // Try Arweave GraphQL query for production
    // Query Arweave for Genesis scrolls
    const query = `{
      transactions(
        tags: [
          {name: "Type", values: ["Genesis-Scroll"]},
          {name: "App-Name", values: ["RATi"]}
        ],
        sort: HEIGHT_ASC,
        first: 10
      ) {
        edges {
          node {
            id,
            tags {
              name,
              value
            },
            block {
              timestamp,
              height
            }
          }
        }
      }
    }`;

    const response = await arweave.api.post('/graphql', { query });
    const edges = response.data.data.transactions.edges;

    const scrolls = await Promise.all(edges.map(async (edge) => {
      const node = edge.node;
      const tags = {};
      node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });

      // Fetch scroll content
      let content = null;
      try {
        const dataResponse = await arweave.transactions.getData(node.id, { decode: true, string: true });
        content = dataResponse;
      } catch (dataError) {
        console.warn(`Could not fetch content for scroll ${node.id}:`, dataError);
      }

      return {
        id: node.id,
        content,
        timestamp: node.block ? new Date(node.block.timestamp * 1000).toISOString() : null,
        height: node.block ? node.block.height : null,
        tags,
        version: tags['Version'] || '1.0'
      };
    }));

    res.json({
      success: true,
      oracleId,
      scrolls,
      totalScrolls: scrolls.length,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Oracle scrolls retrieval error:', error);
    
    res.json({
      success: false,
      oracleId,
      scrolls: [],
      totalScrolls: 0,
      error: 'Could not retrieve oracle scrolls',
      requestId: req.requestId
    });
  }
}));

/**
 * Get oracle scrolls (query parameter version for backward compatibility)
 */
router.get('/api/oracle/scrolls', asyncHandler(async (req, res) => {
  const { oracleId } = req.query;

  if (!oracleId) {
    throw new ApiError(
      'Oracle ID is required',
      'MISSING_ORACLE_ID',
      400,
      null,
      ['Provide oracleId as query parameter or use /api/oracle/:oracleId/scrolls']
    );
  }

  try {
    // In development with arlocal, GraphQL queries might not work reliably
    // Fall back to serving local scrolls content
    if (process.env.ARWEAVE_HOST === 'arlocal' || process.env.NODE_ENV === 'development') {
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        
        const scrolls = [];
        const scrollsPath = '/app/project-root/scrolls';
        
        try {
          const scrollFiles = await fs.readdir(scrollsPath);
          for (const file of scrollFiles.filter(f => f.endsWith('.md'))) {
            const content = await fs.readFile(path.join(scrollsPath, file), 'utf8');
            scrolls.push({
              id: file.replace('.md', ''),
              content,
              timestamp: new Date().toISOString(),
              height: null,
              tags: {
                'Type': 'Genesis-Scroll',
                'App-Name': 'RATi',
                'Version': '1.0'
              },
              version: '1.0'
            });
          }
        } catch (fsError) {
          console.warn('Could not read local scrolls:', fsError.message);
        }

        if (scrolls.length > 0) {
          return res.json({
            success: true,
            oracleId,
            scrolls,
            totalScrolls: scrolls.length,
            source: 'local-development',
            requestId: req.requestId
          });
        }
      } catch (importError) {
        console.warn('Could not import fs/path modules:', importError);
      }
    }

    // Query Arweave for Genesis scrolls
    const query = `{
      transactions(
        tags: [
          {name: "Type", values: ["Genesis-Scroll"]},
          {name: "App-Name", values: ["RATi"]}
        ],
        sort: HEIGHT_ASC,
        first: 10
      ) {
        edges {
          node {
            id,
            tags {
              name,
              value
            },
            block {
              timestamp,
              height
            }
          }
        }
      }
    }`;

    const response = await arweave.api.post('/graphql', { query });
    const edges = response.data.data.transactions.edges;

    const scrolls = await Promise.all(edges.map(async (edge) => {
      const node = edge.node;
      const tags = {};
      node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });

      // Fetch scroll content
      let content = null;
      try {
        const dataResponse = await arweave.transactions.getData(node.id, { decode: true, string: true });
        content = dataResponse;
      } catch (dataError) {
        console.warn(`Could not fetch content for scroll ${node.id}:`, dataError);
      }

      return {
        id: node.id,
        content,
        timestamp: node.block ? new Date(node.block.timestamp * 1000).toISOString() : null,
        height: node.block ? node.block.height : null,
        tags,
        version: tags['Version'] || '1.0'
      };
    }));

    res.json({
      success: true,
      oracleId,
      scrolls,
      totalScrolls: scrolls.length,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Oracle scrolls retrieval error:', error);
    
    res.json({
      success: false,
      oracleId,
      scrolls: [],
      totalScrolls: 0,
      error: 'Could not retrieve oracle scrolls',
      requestId: req.requestId
    });
  }
}));

export default router;
