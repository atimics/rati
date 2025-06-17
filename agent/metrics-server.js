const express = require('express');
const client = require('prom-client');

// Create metrics server
const app = express();
const register = new client.Registry();

// Set default labels
register.setDefaultLabels({
  app: 'rati-agent'
});

// Enable default metrics collection
client.collectDefaultMetrics({ register });

// Custom metrics
const messagesProcessed = new client.Counter({
  name: 'agent_messages_processed_total',
  help: 'Total number of messages processed by the agent'
});

const agentStatus = new client.Gauge({
  name: 'agent_status',
  help: 'Agent status (1 = running, 0 = stopped)',
  labelNames: ['agent_id']
});

register.registerMetric(messagesProcessed);
register.registerMetric(agentStatus);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rati-agent'
  });
});

// Start metrics server
const PORT = process.env.METRICS_PORT || 3003;
app.listen(PORT, () => {
  console.log(`Agent metrics server running on port ${PORT}`);
});

module.exports = {
  messagesProcessed,
  agentStatus
};