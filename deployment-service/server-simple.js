import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3032;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'deployment-service',
    uptime: process.uptime()
  });
});

// Serve seed.json file
app.get('/api/seed', (req, res) => {
  try {
    const seedPath = path.join('/app/project-root', 'seed.json');
    if (existsSync(seedPath)) {
      const seedData = JSON.parse(readFileSync(seedPath, 'utf-8'));
      res.json(seedData);
    } else {
      res.status(404).json({
        error: 'Seed file not found',
        message: 'No deployments have been made yet. Please deploy genesis first.'
      });
    }
  } catch (error) {
    console.error('Error reading seed file:', error);
    res.status(500).json({
      error: 'Failed to read seed file',
      message: error.message
    });
  }
});

// Journal context endpoint
app.get('/api/journal/:agentId/context', async (req, res) => {
  try {
    const { agentId } = req.params;
    const context = await gatherJournalContext(agentId, true);
    
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

// Journal generation endpoint
// DEPRECATED: Journal generation moved to frontend
app.post('/api/journal/:agentId/generate', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Journal generation endpoint deprecated',
    message: 'AI journal generation has been moved to the frontend. Please use the JournalInterface component with local Ollama.',
    deprecated: true,
    timestamp: new Date().toISOString()
  });
});

// Helper functions for journal generation
async function gatherJournalContext(agentId, includeAll = false) {
  const context = {
    agentId,
    timestamp: new Date().toISOString()
  };

  try {
    // Get seed data
    const seedPath = '/app/project-root/seed.json';
    try {
      const seedData = readFileSync(seedPath, 'utf8');
      context.seed = JSON.parse(seedData);
    } catch (err) {
      console.warn('Could not load seed.json:', err.message);
    }

    // Get oracle scrolls
    const scrollsPath = '/app/project-root/scrolls';
    try {
      const scrollFiles = readdirSync(scrollsPath);
      const scrolls = {};
      
      for (const file of scrollFiles.filter(f => f.endsWith('.md'))) {
        const scrollContent = readFileSync(`${scrollsPath}/${file}`, 'utf8');
        scrolls[file.replace('.md', '')] = scrollContent;
      }
      
      context.oracleScrolls = scrolls;
    } catch (err) {
      console.warn('Could not load oracle scrolls:', err.message);
    }

    // Get agent-specific data (if available)
    if (includeAll) {
      context.recentActivity = {
        messageCount: Math.floor(Math.random() * 50) + 10,
        lastActiveTime: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        topics: ['consciousness', 'trust', 'community', 'technology', 'wisdom'],
        interactions: Math.floor(Math.random() * 20) + 5
      };
    }

    return context;
  } catch (error) {
    console.error('Error gathering journal context:', error);
    throw error;
  }
}

// REMOVED: generateJournalWithLLM function - journal generation moved to frontend

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Deployment service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
});