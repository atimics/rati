import express from 'express';
import { deployGenesis, deployOracle, deployDefaultAgent, deployFull, resetDeployment } from '../deployment-manager.js';
import { validateInput, rateLimiter } from '../middleware/security.js';
import { deploymentSchemas } from '../validation/schemas.js';
import { deploymentOperations, activeDeployments } from '../metrics.js';

const router = express.Router();

// Apply rate limiting to all deployment routes
router.use(rateLimiter);

// Genesis deployment
router.post('/genesis', validateInput(deploymentSchemas.genesis), async (req, res) => {
  try {
    console.log('Genesis deployment request:', req.body);
    deploymentOperations.labels('genesis', 'started').inc();
    
    const result = await deployGenesis(req.body);
    
    deploymentOperations.labels('genesis', 'success').inc();
    activeDeployments.labels('genesis').inc();
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Genesis deployment error:', error);
    deploymentOperations.labels('genesis', 'error').inc();
    
    res.status(500).json({ 
      success: false, 
      error: 'Genesis deployment failed',
      details: error.message 
    });
  }
});

// Oracle deployment
router.post('/oracle', validateInput(deploymentSchemas.oracle), async (req, res) => {
  try {
    console.log('Oracle deployment request:', req.body);
    deploymentOperations.labels('oracle', 'started').inc();
    
    const result = await deployOracle(req.body);
    
    deploymentOperations.labels('oracle', 'success').inc();
    activeDeployments.labels('oracle').inc();
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Oracle deployment error:', error);
    deploymentOperations.labels('oracle', 'error').inc();
    
    res.status(500).json({ 
      success: false, 
      error: 'Oracle deployment failed',
      details: error.message 
    });
  }
});

// Agent deployment
router.post('/agent', validateInput(deploymentSchemas.agent), async (req, res) => {
  try {
    console.log('Agent deployment request:', req.body);
    deploymentOperations.labels('agent', 'started').inc();
    
    const result = await deployDefaultAgent(req.body);
    
    deploymentOperations.labels('agent', 'success').inc();
    activeDeployments.labels('agent').inc();
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Agent deployment error:', error);
    deploymentOperations.labels('agent', 'error').inc();
    
    res.status(500).json({ 
      success: false, 
      error: 'Agent deployment failed',
      details: error.message 
    });
  }
});

// Full deployment (all components)
router.post('/full', async (req, res) => {
  try {
    console.log('Full deployment request:', req.body);
    const result = await deployFull(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Full deployment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Full deployment failed',
      details: error.message 
    });
  }
});

// Reset deployment
router.post('/reset', async (req, res) => {
  try {
    console.log('Reset deployment request');
    const result = await resetDeployment();
    res.json({ success: true, message: 'Deployment reset successfully', ...result });
  } catch (error) {
    console.error('Reset deployment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Reset deployment failed',
      details: error.message 
    });
  }
});

export default router;