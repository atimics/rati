#!/usr/bin/env node

import { readFileSync } from 'fs';
import path from 'path';

// Configuration
const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 'http://deployment-service:3032';

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════╗
║              RATi CLI                 ║
║        Deployment Management          ║
╚═══════════════════════════════════════╝
`;

// Command handlers
const commands = {
  async summon(args) {
    const personalityFile = args[0] || '/app/agent/prompt.md';
    const agentName = args[1] || 'RATi-Agent';
    
    console.log(banner);
    console.log('🎭 Summoning agent with personality...');
    console.log(`📜 Personality file: ${personalityFile}`);
    console.log(`🏷️  Agent name: ${agentName}\n`);
    
    try {
      // Read personality prompt
      const personalityPrompt = readFileSync(personalityFile, 'utf-8');
      
      // Call deployment service
      const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/api/summon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalityPrompt,
          agentName
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      console.log('✅ Summoning request submitted');
      console.log(`📋 Deployment ID: ${result.deploymentId}`);
      console.log('\n📊 Monitor progress at:');
      console.log(`   ${DEPLOYMENT_SERVICE_URL}/api/deployments/${result.deploymentId}`);
      
      // Poll for completion
      await pollDeployment(result.deploymentId);
      
    } catch (error) {
      console.error('❌ Summoning failed:', error.message);
      process.exit(1);
    }
  },

  async deploy(args) {
    const type = args[0] || 'full';
    const validTypes = ['genesis', 'oracle', 'agent', 'full'];
    
    if (!validTypes.includes(type)) {
      console.error(`❌ Invalid deployment type: ${type}`);
      console.error(`Valid types: ${validTypes.join(', ')}`);
      process.exit(1);
    }
    
    console.log(banner);
    console.log(`🚀 Starting ${type} deployment...\n`);
    
    try {
      const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/api/deploy/${type}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      console.log('✅ Deployment request submitted');
      console.log(`📋 Deployment ID: ${result.deploymentId}`);
      
      // Poll for completion
      await pollDeployment(result.deploymentId);
      
    } catch (error) {
      console.error(`❌ ${type} deployment failed:`, error.message);
      process.exit(1);
    }
  },

  async status(args) {
    const deploymentId = args[0];
    
    try {
      const url = deploymentId 
        ? `${DEPLOYMENT_SERVICE_URL}/api/deployments/${deploymentId}`
        : `${DEPLOYMENT_SERVICE_URL}/api/deployments`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        console.log(banner);
        console.log('📋 All Deployments:\n');
        data.forEach(deployment => {
          displayDeployment(deployment);
        });
      } else {
        displayDeployment(data);
      }
      
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    }
  },

  help() {
    console.log(banner);
    console.log('Available commands:');
    console.log('');
    console.log('  summon [personality-file] [agent-name]');
    console.log('    Summon an agent with specified personality');
    console.log('    Default: prompt.md, RATi-Agent');
    console.log('');
    console.log('  deploy [type]');
    console.log('    Deploy components (genesis|oracle|agent|full)');
    console.log('    Default: full');
    console.log('');
    console.log('  status [deployment-id]');
    console.log('    Show deployment status');
    console.log('');
    console.log('  help');
    console.log('    Show this help message');
    console.log('');
  }
};

// Helper functions
async function pollDeployment(deploymentId) {
  console.log('\n🔄 Monitoring deployment progress...\n');
  
  let lastLogCount = 0;
  
  while (true) {
    try {
      const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/api/deployments/${deploymentId}`);
      const deployment = await response.json();
      
      // Show new logs
      if (deployment.logs && deployment.logs.length > lastLogCount) {
        const newLogs = deployment.logs.slice(lastLogCount);
        newLogs.forEach(log => {
          const icon = log.level === 'error' ? '❌' : 
                      log.level === 'warn' ? '⚠️' : 'ℹ️';
          console.log(`${icon} ${log.message}`);
        });
        lastLogCount = deployment.logs.length;
      }
      
      if (deployment.status === 'completed') {
        console.log('\n✅ Deployment completed successfully!');
        if (deployment.result) {
          if (deployment.result.processId) {
            console.log(`🆔 Process ID: ${deployment.result.processId}`);
          }
          if (deployment.result.personalityTxid) {
            console.log(`💾 Personality TX: ${deployment.result.personalityTxid}`);
          }
          if (deployment.result.message) {
            console.log(`📝 ${deployment.result.message}`);
          }
        }
        break;
      }
      
      if (deployment.status === 'failed') {
        console.log('\n❌ Deployment failed!');
        if (deployment.error) {
          console.log(`Error: ${deployment.error}`);
        }
        process.exit(1);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('❌ Error monitoring deployment:', error.message);
      process.exit(1);
    }
  }
}

function displayDeployment(deployment) {
  const statusIcon = deployment.status === 'completed' ? '✅' : 
                    deployment.status === 'failed' ? '❌' : 
                    deployment.status === 'starting' ? '🚀' : '🔄';
  
  console.log(`${statusIcon} ${deployment.type.toUpperCase()} - ${deployment.id}`);
  console.log(`   Status: ${deployment.status}`);
  console.log(`   Started: ${new Date(deployment.startTime).toLocaleString()}`);
  if (deployment.endTime) {
    console.log(`   Ended: ${new Date(deployment.endTime).toLocaleString()}`);
  }
  if (deployment.result && deployment.result.processId) {
    console.log(`   Process ID: ${deployment.result.processId}`);
  }
  if (deployment.error) {
    console.log(`   Error: ${deployment.error}`);
  }
  console.log('');
}

// Main execution
async function main() {
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);
  
  if (commands[command]) {
    await commands[command](args);
  } else {
    console.error(`❌ Unknown command: ${command}`);
    commands.help();
    process.exit(1);
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ for fetch support');
  process.exit(1);
}

main().catch(error => {
  console.error('❌ CLI Error:', error.message);
  process.exit(1);
});
