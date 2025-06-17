#!/usr/bin/env node

// Start metrics server first
console.log('Starting agent metrics server...');
require('./metrics-server.js');

// Small delay to let metrics server start
setTimeout(() => {
  console.log('Starting main agent...');
  require('./agent.js');
}, 1000);