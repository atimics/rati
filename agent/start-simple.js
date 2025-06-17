#!/usr/bin/env node

console.log('=== RATi Agent Startup ===');

// Start metrics server
console.log('Starting metrics server...');
const express = require('express');
const metricsApp = express();

metricsApp.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP agent_status Agent status
# TYPE agent_status gauge
agent_status{agent_id="main"} 1
# HELP agent_uptime_seconds Agent uptime in seconds
# TYPE agent_uptime_seconds counter
agent_uptime_seconds ${process.uptime()}
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

const METRICS_PORT = process.env.METRICS_PORT || 3003;
metricsApp.listen(METRICS_PORT, () => {
  console.log(`✅ Metrics server running on port ${METRICS_PORT}`);
});

// Small delay then start main agent
setTimeout(() => {
  console.log('Starting main agent process...');
  try {
    // Initialize simple journal before starting agent
    const SimpleJournal = require('./simple-journal.js');
    global.agentJournal = new SimpleJournal('main-agent');
    
    require('./agent.js');
    console.log('✅ Main agent started successfully');
  } catch (error) {
    console.error('❌ Failed to start main agent:', error.message);
    process.exit(1);
  }
}, 1000);