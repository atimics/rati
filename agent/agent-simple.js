console.log('=== RATi Agent Starting ===');

// Import required modules
const express = require('express');

// Start metrics server
const metricsApp = express();
const METRICS_PORT = process.env.METRICS_PORT || 3003;

metricsApp.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP agent_status Agent status
# TYPE agent_status gauge
agent_status{agent_id="main"} 1
# HELP agent_uptime_seconds Agent uptime in seconds
# TYPE agent_uptime_seconds counter
agent_uptime_seconds ${process.uptime()}
# HELP agent_messages_processed_total Total messages processed
# TYPE agent_messages_processed_total counter
agent_messages_processed_total 0
`);
});

metricsApp.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rati-agent',
    uptime: process.uptime()
  });
});

metricsApp.listen(METRICS_PORT, () => {
  console.log(`✅ Agent metrics server running on port ${METRICS_PORT}`);
});

// Simple agent simulation
console.log('🤖 AI Agent initialized');
console.log('📊 Metrics available at:', `http://localhost:${METRICS_PORT}/metrics`);
console.log('🏥 Health check at:', `http://localhost:${METRICS_PORT}/health`);

// Keep the process running
setInterval(() => {
  console.log(`Agent heartbeat - ${new Date().toISOString()}`);
}, 30000);

console.log('✅ RATi Agent is running...');