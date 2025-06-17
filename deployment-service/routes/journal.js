import express from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { arweave } from '../services/arweave.js';
import { loadWallet } from '../services/deployment.js';
import { rateLimiter } from '../middleware/security.js';
import { promises as fs } from 'fs';
import path from 'path';

const router = express.Router();

// Apply rate limiting to all journal routes
router.use(rateLimiter);

/**
 * Enhanced journal publishing with memory chain integration
 */
router.post('/api/journal/publish', asyncHandler(async (req, res) => {
  const journalData = req.body;
  
  // Validate required fields
  if (!journalData.content || !journalData.avatarId) {
    throw new ApiError(
      'Journal content and avatar ID are required',
      'MISSING_REQUIRED_FIELDS',
      400,
      { provided: Object.keys(journalData) },
      ['Ensure content and avatarId are provided']
    );
  }

  try {
    // Load wallet for transaction signing
    const wallet = await loadWallet();
    
    // Auto-populate missing references if not provided
    const enhancedJournalData = await enrichJournalData(journalData);
    
    // Create transaction with enhanced journal data
    const transaction = await arweave.createTransaction({
      data: JSON.stringify(enhancedJournalData, null, 2)
    }, wallet);

    // Add comprehensive tags for indexing and linking
    transaction.addTag('App-Name', 'RATi');
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('Type', 'Agent-Journal');
    transaction.addTag('Avatar-ID', enhancedJournalData.avatarId);
    transaction.addTag('Journal-Version', '2.0');
    
    if (enhancedJournalData.genesisRef) {
      transaction.addTag('Genesis-Ref', enhancedJournalData.genesisRef);
    }
    
    if (enhancedJournalData.previousJournal) {
      transaction.addTag('Previous-Journal', enhancedJournalData.previousJournal);
    }

    if (enhancedJournalData.memoryChain && enhancedJournalData.memoryChain.length > 0) {
      transaction.addTag('Memory-Chain-Length', enhancedJournalData.memoryChain.length.toString());
    }

    if (enhancedJournalData.contextTypes) {
      transaction.addTag('Context-Types', enhancedJournalData.contextTypes.join(','));
    }

    // Sign and post transaction
    await arweave.transactions.sign(transaction, wallet);
    const response = await arweave.transactions.post(transaction);

    if (response.status !== 200) {
      throw new ApiError(
        'Failed to post journal to Arweave',
        'ARWEAVE_POST_FAILED',
        500,
        { arweaveStatus: response.status },
        ['Check Arweave network status', 'Verify wallet balance']
      );
    }

    res.json({
      success: true,
      transactionId: transaction.id,
      message: 'Journal published successfully with enhanced metadata',
      journalData: enhancedJournalData,
      arweaveStatus: response.status,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Journal publishing error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to publish journal',
      'JOURNAL_PUBLISH_ERROR',
      500,
      { originalError: error.message },
      ['Check Arweave connection', 'Verify wallet configuration']
    );
  }
}));

/**
 * Get journal chain for an avatar
 */
router.get('/api/avatar/:avatarId/journal-chain', asyncHandler(async (req, res) => {
  const { avatarId } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  try {
    // Query Arweave for journal entries
    const query = `{
      transactions(
        tags: [
          {name: "Type", values: ["Agent-Journal"]},
          {name: "Avatar-ID", values: ["${avatarId}"]}
        ],
        sort: HEIGHT_DESC,
        first: ${Math.min(parseInt(limit), 50)},
        after: "${offset}"
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

    const journals = await Promise.all(edges.map(async (edge) => {
      const node = edge.node;
      const tags = {};
      node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });

      // Fetch journal content
      let content = null;
      try {
        const dataResponse = await arweave.transactions.getData(node.id, { decode: true, string: true });
        content = JSON.parse(dataResponse);
      } catch (dataError) {
        console.warn(`Could not fetch content for journal ${node.id}:`, dataError);
      }

      return {
        id: node.id,
        avatarId: tags['Avatar-ID'],
        timestamp: node.block ? new Date(node.block.timestamp * 1000).toISOString() : null,
        height: node.block ? node.block.height : null,
        tags,
        content,
        version: tags['Journal-Version'] || '1.0'
      };
    }));

    res.json({
      success: true,
      avatarId,
      journals,
      totalReturned: journals.length,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Journal chain retrieval error:', error);
    
    throw new ApiError(
      'Failed to retrieve journal chain',
      'JOURNAL_CHAIN_ERROR',
      500,
      { avatarId, originalError: error.message },
      ['Check avatar ID format', 'Verify Arweave connection', 'Try with different limit/offset']
    );
  }
}));

/**
 * Get basic context information for journal generation (seed data, oracle scrolls)
 * This is kept lightweight since AI generation now happens on frontend
 */
router.get('/:agentId/context', async (req, res) => {
  try {
    const { agentId } = req.params;
    const context = await gatherBasicContext(agentId);
    
    res.json({
      success: true,
      agentId,
      context,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching journal context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal context',
      details: error.message
    });
  }
});

/**
 * Get journal entries for an agent (basic storage/retrieval)
 */
router.get('/:agentId/entries', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 10 } = req.query;
    
    // TODO: Implement actual storage/retrieval from persistent storage
    // For now, return empty array since frontend handles storage via localStorage
    
    const entries = [];
    
    res.json({
      success: true,
      agentId,
      entries: entries.slice(0, parseInt(limit)),
      total: entries.length,
      source: 'localStorage' // Indicate that entries are stored in frontend
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entries',
      details: error.message
    });
  }
});

/**
 * Store a journal entry (for backup/sync purposes)
 */
router.post('/:agentId/entries', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { entry } = req.body;
    
    if (!entry || !entry.content) {
      return res.status(400).json({
        success: false,
        error: 'Entry content is required'
      });
    }
    
    // TODO: Implement actual storage to persistent storage
    // This could be used for backup/sync across devices
    
    console.log(`Journal entry received for agent ${agentId}:`, {
      wordCount: entry.content.split(' ').length,
      timestamp: entry.timestamp || new Date().toISOString()
    });
    
    res.json({
      success: true,
      agentId,
      message: 'Entry received (currently handled by frontend localStorage)',
      entryId: Date.now()
    });
  } catch (error) {
    console.error('Error storing journal entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store journal entry',
      details: error.message
    });
  }
});

/**
 * Get basic statistics for an agent's journal
 */
router.get('/:agentId/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Basic stats since actual data is in frontend localStorage
    const stats = {
      agentId,
      note: 'Detailed statistics available in frontend application',
      storageLocation: 'localStorage',
      backendSupport: {
        contextData: true,
        aiGeneration: false, // Handled by frontend Ollama
        persistence: false   // TODO: Implement if needed
      }
    };
    
    res.json({
      success: true,
      stats,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching journal stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal stats',
      details: error.message
    });
  }
});

/**
 * Health check for journal service
 */
router.get('/health', async (req, res) => {
  res.json({
    success: true,
    service: 'journal-routes',
    status: 'operational',
    features: {
      contextData: 'available',
      aiGeneration: 'frontend-only',
      storage: 'localStorage-based'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Gather basic context information (seed data, oracle scrolls)
 */
async function gatherBasicContext(agentId) {
  const context = {
    agentId,
    timestamp: new Date().toISOString()
  };

  try {
    // Get seed data
    const seedPath = path.join(__dirname, '../../seed.json');
    try {
      const seedData = await fs.readFile(seedPath, 'utf8');
      context.seed = JSON.parse(seedData);
    } catch (err) {
      console.warn('Could not load seed.json:', err.message);
    }

    // Get oracle scrolls
    const scrollsPath = path.join(__dirname, '../../scrolls');
    try {
      const scrollFiles = await fs.readdir(scrollsPath);
      const scrolls = {};
      
      for (const file of scrollFiles.filter(f => f.endsWith('.md'))) {
        const scrollContent = await fs.readFile(path.join(scrollsPath, file), 'utf8');
        scrolls[file.replace('.md', '')] = scrollContent;
      }
      
      context.oracleScrolls = scrolls;
    } catch (err) {
      console.warn('Could not load oracle scrolls:', err.message);
    }

    // Add basic system info
    context.systemInfo = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      note: 'AI generation and detailed tracking handled by frontend'
    };

    return context;
  } catch (error) {
    console.error('Error gathering basic context:', error);
    throw error;
  }
}

/**
 * Helper function to enrich journal data with metadata
 */
async function enrichJournalData(journalData) {
  const enhanced = {
    ...journalData,
    timestamp: journalData.timestamp || new Date().toISOString(),
    version: '2.0',
    contextTypes: journalData.contextTypes || []
  };

  // Add genesis reference if available
  try {
    const seedPath = '/app/project-root/seed.json';
    const seedData = JSON.parse(await fs.readFile(seedPath, 'utf8'));
    if (seedData.agent?.processId) {
      enhanced.genesisRef = seedData.agent.processId;
    }
  } catch (err) {
    console.warn('Could not add genesis reference:', err.message);
  }

  // Add memory chain if not provided
  if (!enhanced.memoryChain) {
    enhanced.memoryChain = [];
  }

  return enhanced;
}

export default router;
