import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { checkArweaveConnection } from '../services/arweave.js';

const router = express.Router();

/**
 * Basic health check endpoint
 */
router.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    requestId: req.requestId
  };

  res.json(health);
}));

/**
 * Prometheus metrics endpoint
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  const metrics = [
    '# HELP rati_service_up Service availability',
    '# TYPE rati_service_up gauge',
    'rati_service_up 1',
    '',
    '# HELP rati_service_uptime_seconds Service uptime in seconds',
    '# TYPE rati_service_uptime_seconds counter',
    `rati_service_uptime_seconds ${process.uptime()}`,
    '',
    '# HELP rati_memory_usage_bytes Memory usage in bytes',
    '# TYPE rati_memory_usage_bytes gauge',
    `rati_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
    `rati_memory_usage_bytes{type="heap_used"} ${process.memoryUsage().heapUsed}`,
    `rati_memory_usage_bytes{type="heap_total"} ${process.memoryUsage().heapTotal}`,
    '',
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics);
}));

/**
 * Detailed system status endpoint
 */
router.get('/api/status', asyncHandler(async (req, res) => {
  const status = {
    service: 'RATi Deployment Service',
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requestId: req.requestId
  };

  // Check Arweave connectivity
  try {
    const arweaveStatus = await checkArweaveConnection();
    status.arweave = {
      connected: arweaveStatus.connected,
      network: arweaveStatus.info.network,
      height: arweaveStatus.info.height,
      current: arweaveStatus.info.current
    };
  } catch (error) {
    status.arweave = {
      connected: false,
      error: error.message
    };
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'operational' ? 200 : 503;
  res.status(httpStatus).json(status);
}));

export default router;
