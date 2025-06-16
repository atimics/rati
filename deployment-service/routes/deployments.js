import express from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { promises as fs } from 'fs';
import path from 'path';
import { autoDeployIfNeeded, updateAgentEnvironment, loadWallet, deployGenesis, deployOracle, deployDefaultAgent } from '../services/deployment.js';

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
 * Deploy Genesis - implements actual deployment logic
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

  // Perform actual genesis deployment
  try {
    deployment.logs.push('Loading wallet...');
    const wallet = await loadWallet();
    
    deployment.logs.push('Deploying genesis contract...');
    const genesisResult = await deployGenesis(wallet);
    
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push(`Genesis deployment completed successfully. Process ID: ${genesisResult.processId}`);
    deployment.result = genesisResult;

    res.json({ 
      deploymentId, 
      message: 'Genesis deployment completed',
      result: genesisResult,
      requestId: req.requestId
    });
  } catch (error) {
    deployment.status = 'failed';
    deployment.endTime = new Date().toISOString();
    deployment.error = error.message;
    deployment.logs.push(`Genesis deployment failed: ${error.message}`);
    
    throw new ApiError(
      'Genesis deployment failed',
      'GENESIS_DEPLOY_ERROR',
      500,
      { originalError: error.message, deploymentId },
      [
        'Check wallet.json exists and is valid',
        'Ensure ArLocal is running',
        'Verify network connectivity'
      ]
    );
  }
}));

/**
 * Deploy Oracle - implements actual deployment logic
 */
router.post('/api/deploy/oracle', asyncHandler(async (req, res) => {
  const { genesisProcessId } = req.body;
  
  if (!genesisProcessId) {
    throw new ApiError(
      'Genesis process ID is required for oracle deployment',
      'MISSING_GENESIS_ID',
      400,
      null,
      ['Deploy genesis first', 'Provide genesisProcessId in request body']
    );
  }

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

  // Perform actual oracle deployment
  try {
    deployment.logs.push('Loading wallet...');
    const wallet = await loadWallet();
    
    deployment.logs.push(`Deploying oracle contract with genesis ID: ${genesisProcessId}...`);
    const oracleResult = await deployOracle(wallet, genesisProcessId);
    
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push(`Oracle deployment completed successfully. Process ID: ${oracleResult.processId}`);
    deployment.result = oracleResult;

    res.json({ 
      deploymentId, 
      message: 'Oracle deployment completed',
      result: oracleResult,
      requestId: req.requestId
    });
  } catch (error) {
    deployment.status = 'failed';
    deployment.endTime = new Date().toISOString();
    deployment.error = error.message;
    deployment.logs.push(`Oracle deployment failed: ${error.message}`);
    
    throw new ApiError(
      'Oracle deployment failed',
      'ORACLE_DEPLOY_ERROR',
      500,
      { originalError: error.message, deploymentId },
      [
        'Check wallet.json exists and is valid',
        'Ensure genesis process ID is valid',
        'Verify network connectivity'
      ]
    );
  }
}));

/**
 * Deploy Agent - implements actual deployment logic
 */
router.post('/api/deploy/agent', asyncHandler(async (req, res) => {
  const { genesisProcessId } = req.body;
  
  if (!genesisProcessId) {
    throw new ApiError(
      'Genesis process ID is required for agent deployment',
      'MISSING_GENESIS_ID',
      400,
      null,
      ['Deploy genesis first', 'Provide genesisProcessId in request body']
    );
  }

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

  // Perform actual agent deployment
  try {
    deployment.logs.push('Loading wallet...');
    const wallet = await loadWallet();
    
    deployment.logs.push(`Deploying agent with genesis ID: ${genesisProcessId}...`);
    const agentResult = await deployDefaultAgent(wallet, genesisProcessId);
    
    deployment.logs.push('Updating agent environment...');
    await updateAgentEnvironment(agentResult.processId);
    
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push(`Agent deployment completed successfully. Process ID: ${agentResult.processId}`);
    deployment.result = agentResult;

    res.json({ 
      deploymentId, 
      message: 'Agent deployment completed',
      result: agentResult,
      requestId: req.requestId
    });
  } catch (error) {
    deployment.status = 'failed';
    deployment.endTime = new Date().toISOString();
    deployment.error = error.message;
    deployment.logs.push(`Agent deployment failed: ${error.message}`);
    
    throw new ApiError(
      'Agent deployment failed',
      'AGENT_DEPLOY_ERROR',
      500,
      { originalError: error.message, deploymentId },
      [
        'Check wallet.json exists and is valid',
        'Ensure genesis process ID is valid',
        'Verify agent code exists'
      ]
    );
  }
}));

/**
 * Full deployment (genesis + oracle + agent) with proper sequencing
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

  // Perform sequential deployment
  try {
    deployment.logs.push('Loading wallet...');
    const wallet = await loadWallet();
    
    // Step 1: Deploy Genesis
    deployment.logs.push('Step 1/3: Deploying genesis...');
    deployment.steps.genesis = 'running';
    const genesisResult = await deployGenesis(wallet);
    deployment.steps.genesis = 'completed';
    deployment.logs.push(`Genesis deployed successfully. Process ID: ${genesisResult.processId}`);
    
    // Step 2: Deploy Oracle
    deployment.logs.push('Step 2/3: Deploying oracle...');
    deployment.steps.oracle = 'running';
    const oracleResult = await deployOracle(wallet, genesisResult.processId);
    deployment.steps.oracle = 'completed';
    deployment.logs.push(`Oracle deployed successfully. Process ID: ${oracleResult.processId}`);
    
    // Step 3: Deploy Agent
    deployment.logs.push('Step 3/3: Deploying agent...');
    deployment.steps.agent = 'running';
    const agentResult = await deployDefaultAgent(wallet, genesisResult.processId);
    deployment.steps.agent = 'completed';
    deployment.logs.push(`Agent deployed successfully. Process ID: ${agentResult.processId}`);
    
    // Update agent environment
    deployment.logs.push('Updating agent environment configuration...');
    await updateAgentEnvironment(agentResult.processId);
    
    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.logs.push('Full deployment completed successfully!');
    
    const result = {
      genesis: genesisResult,
      oracle: oracleResult,
      agent: agentResult
    };
    deployment.result = result;

    res.json({ 
      deploymentId, 
      message: 'Full deployment completed',
      result,
      requestId: req.requestId
    });
  } catch (error) {
    // Mark failed step
    if (deployment.steps.genesis === 'running') deployment.steps.genesis = 'failed';
    if (deployment.steps.oracle === 'running') deployment.steps.oracle = 'failed';
    if (deployment.steps.agent === 'running') deployment.steps.agent = 'failed';
    
    deployment.status = 'failed';
    deployment.endTime = new Date().toISOString();
    deployment.error = error.message;
    deployment.logs.push(`Full deployment failed: ${error.message}`);
    
    throw new ApiError(
      'Full deployment failed',
      'FULL_DEPLOY_ERROR',
      500,
      { originalError: error.message, deploymentId, steps: deployment.steps },
      [
        'Check wallet.json exists and is valid',
        'Ensure all source files exist',
        'Verify network connectivity'
      ]
    );
  }
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
  
  // Remove seed.json if it exists
  try {
    const seedPath = path.join('/app/project-root', 'seed.json');
    await fs.unlink(seedPath);
    console.log('✅ Removed seed.json');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('⚠️  Could not remove seed.json:', error.message);
    }
  }
  
  res.json({ 
    message: 'Deployment state reset successfully',
    requestId: req.requestId
  });
}));

export default router;
