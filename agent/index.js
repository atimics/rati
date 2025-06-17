import express from 'express';

console.log('=== RATi Agent Starting ===');

const app = express();
const PORT = process.env.METRICS_PORT || 3003;

app.get('/metrics', (req, res) => {
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

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rati-agent',
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`✅ RATi Agent running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
});

// Keep process running with heartbeat
setInterval(() => {
  console.log(`Agent heartbeat - ${new Date().toISOString()}`);
}, 60000);

console.log('🤖 RATi AI Agent initialized successfully');