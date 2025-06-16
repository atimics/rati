import express from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { promises as fs } from 'fs';
import path from 'path';
import { autoDeployIfNeeded, updateAgentEnvironment } from '../services/deployment.js';

const router = express.Router();

// In-memory deployment tracking (in production, use a database)
const deployments = new Map();

/**
 * Get all deployments
 */
router.get('/api/deployments', (req, res) => {
  const allDeployments = Array.from(deployments.values());
  res.json(allDeployments);
});

/**
 * Get specific deployment by ID
 */
router.get('/api/deployments/:id', (req, res) => {
  const deployment = deployments.get(req.params.id);
  if (!deployment) {
    throw new ApiError(
      'Deployment not found',
      'DEPLOYMENT_NOT_FOUND',
      404,
      { deploymentId: req.params.id }
    );
  }
  res.json(deployment);
});

/**
 * Get seed.json data
 */
router.get('/api/seed', asyncHandler(async (req, res) => {
  try {
    // Read seed.json from project root (shared volume)
    const seedPath = path.join('/app/project-root', 'seed.json');
    const seedContent = await fs.readFile(seedPath, 'utf-8');
    const seedData = JSON.parse(seedContent);
    res.json(seedData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ApiError(
        'Seed file not found',
        'SEED_NOT_FOUND',
        404,
        null,
        [
          'Run deployment first to generate seed.json',
          'Use: npm run deploy:genesis'
        ]
      );
    }
    throw new ApiError(
      'Failed to read seed file',
      'SEED_READ_ERROR',
      500,
      { originalError: error.message }
    );
  }
}));

/**
 * Get scrolls (documentation files)
 */
router.get('/api/scrolls', asyncHandler(async (req, res) => {
  try {
    const scrollsDir = path.join(process.cwd(), 'scrolls');
    const files = await fs.readdir(scrollsDir);
    const scrolls = await Promise.all(
      files
        .filter(file => file.endsWith('.md'))
        .map(async (file) => {
          const content = await fs.readFile(path.join(scrollsDir, file), 'utf-8');
          return {
            name: file.replace('.md', ''),
            filename: file,
            content
          };
        })
    );
    res.json(scrolls);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json([]); // Return empty array if scrolls directory doesn't exist
    } else {
      throw new ApiError(
        'Failed to read scrolls',
        'SCROLLS_READ_ERROR',
        500,
        { originalError: error.message }
      );
    }
  }
}));

/**
 * Get available wallets
 */
router.get('/api/wallets', asyncHandler(async (req, res) => {
  try {
    const walletsDir = path.join(process.cwd(), 'wallets');
    const files = await fs.readdir(walletsDir);
    const wallets = files
      .filter(file => file.endsWith('.json') && !file.includes('example'))
      .map(file => ({
        name: file.replace('.json', ''),
        filename: file,
        path: path.join(walletsDir, file)
      }));
    res.json(wallets);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ApiError(
        'Wallets directory not found',
        'WALLETS_DIR_NOT_FOUND',
        404,
        null,
        [
          'Create wallets directory',
          'Add wallet.json file',
          'Use wallet.example.json as template'
        ]
      );
    }
    throw new ApiError(
      'Failed to read wallets',
      'WALLETS_READ_ERROR',
      500,
      { originalError: error.message }
    );
  }
}));

/**
 * Deploy Genesis - placeholder for now
 * TODO: Integrate with actual deployment logic
 */
router.post('/api/deploy/genesis', asyncHandler(async (req, res) => {
  const deploymentId = `genesis-${Date.now()}`;
  const deployment = {
    id: deploymentId,
    type: 'genesis',
    status: 'started',
    startTime: new Date().toISOString(),
    logs: ['Genesis deployment started'],
    requestId: req.requestId
  };

  deployments.set(deploymentId, deployment);

  // TODO: Implement actual genesis deployment logic
  // For now, simulate deployment
  setTimeout(() => {
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push('Genesis deployment completed successfully');
  }, 5000);

  res.json({ 
    deploymentId, 
    message: 'Genesis deployment started',
    requestId: req.requestId
  });
}));

/**
 * Deploy Oracle - placeholder for now
 * TODO: Integrate with actual deployment logic
 */
router.post('/api/deploy/oracle', asyncHandler(async (req, res) => {
  const deploymentId = `oracle-${Date.now()}`;
  const deployment = {
    id: deploymentId,
    type: 'oracle',
    status: 'started',
    startTime: new Date().toISOString(),
    logs: ['Oracle deployment started'],
    requestId: req.requestId
  };

  deployments.set(deploymentId, deployment);

  // TODO: Implement actual oracle deployment logic
  setTimeout(() => {
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push('Oracle deployment completed successfully');
  }, 3000);

  res.json({ 
    deploymentId, 
    message: 'Oracle deployment started',
    requestId: req.requestId
  });
}));

/**
 * Deploy Agent - placeholder for now
 * TODO: Integrate with actual deployment logic
 */
router.post('/api/deploy/agent', asyncHandler(async (req, res) => {
  const deploymentId = `agent-${Date.now()}`;
  const deployment = {
    id: deploymentId,
    type: 'agent',
    status: 'started',
    startTime: new Date().toISOString(),
    logs: ['Agent deployment started'],
    requestId: req.requestId
  };

  deployments.set(deploymentId, deployment);

  // TODO: Implement actual agent deployment logic
  setTimeout(() => {
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push('Agent deployment completed successfully');
  }, 4000);

  res.json({ 
    deploymentId, 
    message: 'Agent deployment started',
    requestId: req.requestId
  });
}));

/**
 * Full deployment (genesis + oracle + agent)
 */
router.post('/api/deploy/full', asyncHandler(async (req, res) => {
  const deploymentId = `full-${Date.now()}`;
  const deployment = {
    id: deploymentId,
    type: 'full',
    status: 'started',
    startTime: new Date().toISOString(),
    logs: ['Full deployment started'],
    requestId: req.requestId,
    steps: {
      genesis: 'pending',
      oracle: 'pending',
      agent: 'pending'
    }
  };

  deployments.set(deploymentId, deployment);

  // TODO: Implement actual full deployment logic with proper sequencing
  res.json({ 
    deploymentId, 
    message: 'Full deployment started',
    requestId: req.requestId
  });
}));

/**
 * Auto-deploy (genesis + oracle + agent) if they don't exist
 */
router.post('/api/deploy/auto', asyncHandler(async (req, res) => {
  const deploymentId = `auto-${Date.now()}`;
  const deployment = {
    id: deploymentId,
    type: 'auto',
    status: 'started',
    startTime: new Date().toISOString(),
    logs: ['Auto-deployment started'],
    requestId: req.requestId
  };

  deployments.set(deploymentId, deployment);

  try {
    deployment.logs.push('Checking for existing deployment...');
    const seedData = await autoDeployIfNeeded();
    
    if (seedData.agent?.processId) {
      deployment.logs.push('Updating agent environment...');
      await updateAgentEnvironment(seedData.agent.processId);
    }
    
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push('Auto-deployment completed successfully');
    deployment.result = seedData;

    res.json({ 
      deploymentId, 
      message: 'Auto-deployment completed',
      seedData,
      requestId: req.requestId
    });
  } catch (error) {
    deployment.status = 'failed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push(`Auto-deployment failed: ${error.message}`);
    deployment.error = error.message;
    
    throw error;
  }
}));

/**
 * Reset deployment state
 */
router.post('/api/reset', asyncHandler(async (req, res) => {
  // Clear in-memory deployments
  deployments.clear();
  
  // TODO: Reset actual deployment state files
  res.json({ 
    message: 'Deployment state reset',
    requestId: req.requestId
  });
}));

export default router;
