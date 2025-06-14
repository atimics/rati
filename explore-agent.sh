#!/bin/bash

# Agent Memory Explorer
# This script helps you explore your agent's on-chain memories and personality

set -e

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent"
cd "$AGENT_DIR"

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$AO_PROCESS_ID" ]; then
    echo "❌ AO_PROCESS_ID not found in .env file"
    echo "Make sure you've run deploy-agent.js first"
    exit 1
fi

echo "🤖 RATi Agent Memory Explorer"
echo "Agent Process ID: $AO_PROCESS_ID"
echo ""

case "${1:-help}" in
    "soul"|"personality")
        echo "🧠 Fetching agent's soul (personality) from Arweave..."
        node -e "
        import Arweave from 'arweave';
        const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
        
        const query = \`{
          transactions(tags: [
            {name: \"Type\", values: [\"Agent-Prompt\"]},
            {name: \"Owner-Process\", values: [\"$AO_PROCESS_ID\"]}
          ], first: 1) { 
            edges { node { id } } 
          }
        }\`;
        
        arweave.api.post('/graphql', { query }).then(async res => {
          const txId = res.data.data.transactions.edges[0]?.node.id;
          if (!txId) {
            console.log('❌ No personality found for this agent');
            return;
          }
          
          console.log(\`✅ Soul TXID: \${txId}\`);
          console.log(\`🔗 View at: https://arweave.net/\${txId}\`);
          console.log('');
          
          const data = await arweave.transactions.getData(txId, { decode: true, string: true });
          console.log('📜 Agent Constitution:');
          console.log('='.repeat(50));
          console.log(data);
        }).catch(console.error);
        "
        ;;
        
    "memories"|"memory")
        COUNT=${2:-5}
        echo "📚 Fetching last $COUNT memories from Arweave..."
        node -e "
        import Arweave from 'arweave';
        const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
        
        const query = \`{
          transactions(tags: [
            {name: \"Type\", values: [\"Agent-Memory\"]},
            {name: \"Owner-Process\", values: [\"$AO_PROCESS_ID\"]}
          ], sort: HEIGHT_DESC, first: $COUNT) { 
            edges { 
              node { 
                id, 
                tags { name, value },
                block { timestamp }
              } 
            } 
          }
        }\`;
        
        arweave.api.post('/graphql', { query }).then(async res => {
          const edges = res.data.data.transactions.edges;
          if (edges.length === 0) {
            console.log('❌ No memories found for this agent');
            return;
          }
          
          console.log(\`✅ Found \${edges.length} memories\`);
          console.log('');
          
          for (const edge of edges.reverse()) {
            const seqTag = edge.node.tags.find(t => t.name === 'Sequence');
            const actionTag = edge.node.tags.find(t => t.name === 'Action');
            const timestamp = new Date(edge.node.block?.timestamp * 1000).toISOString();
            
            console.log(\`📝 Memory #\${seqTag?.value || '?'} (\${actionTag?.value || 'Unknown'})\`);
            console.log(\`   TXID: \${edge.node.id}\`);
            console.log(\`   Time: \${timestamp}\`);
            console.log(\`   View: https://arweave.net/\${edge.node.id}\`);
            
            try {
              const data = await arweave.transactions.getData(edge.node.id, { decode: true, string: true });
              const memory = JSON.parse(data);
              console.log(\`   Decision: \${memory.decision?.action || 'N/A'}\`);
              console.log(\`   Context: \${memory.context?.triggeredBy || 'N/A'}\`);
              if (memory.decision?.RATionale) {
                console.log(\`   RATionale: \${memory.decision.RATionale}\`);
              }
            } catch (e) {
              console.log('   (Could not parse memory data)');
            }
            console.log('');
          }
        }).catch(console.error);
        "
        ;;
        
    "stats"|"statistics")
        echo "📊 Fetching agent statistics..."
        node -e "
        import Arweave from 'arweave';
        const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
        
        const query = \`{
          transactions(tags: [
            {name: \"Owner-Process\", values: [\"$AO_PROCESS_ID\"]}
          ], first: 100) { 
            edges { 
              node { 
                id, 
                tags { name, value }
              } 
            } 
          }
        }\`;
        
        arweave.api.post('/graphql', { query }).then(res => {
          const edges = res.data.data.transactions.edges;
          
          const memories = edges.filter(e => e.node.tags.some(t => t.name === 'Type' && t.value === 'Agent-Memory'));
          const prompts = edges.filter(e => e.node.tags.some(t => t.name === 'Type' && t.value === 'Agent-Prompt'));
          
          const actions = {};
          memories.forEach(edge => {
            const actionTag = edge.node.tags.find(t => t.name === 'Action');
            if (actionTag) {
              actions[actionTag.value] = (actions[actionTag.value] || 0) + 1;
            }
          });
          
          console.log('📊 Agent Statistics:');
          console.log('='.repeat(30));
          console.log(\`Total Memories: \${memories.length}\`);
          console.log(\`Personality Versions: \${prompts.length}\`);
          console.log(\`Process ID: $AO_PROCESS_ID\`);
          console.log('');
          console.log('Action Breakdown:');
          Object.entries(actions).forEach(([action, count]) => {
            console.log(\`  \${action}: \${count}\`);
          });
        }).catch(console.error);
        "
        ;;
        
    "latest"|"last")
        echo "🔍 Fetching latest memory..."
        node -e "
        import Arweave from 'arweave';
        const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
        
        const query = \`{
          transactions(tags: [
            {name: \"Type\", values: [\"Agent-Memory\"]},
            {name: \"Owner-Process\", values: [\"$AO_PROCESS_ID\"]}
          ], sort: HEIGHT_DESC, first: 1) { 
            edges { 
              node { 
                id, 
                tags { name, value },
                block { timestamp }
              } 
            } 
          }
        }\`;
        
        arweave.api.post('/graphql', { query }).then(async res => {
          const edge = res.data.data.transactions.edges[0];
          if (!edge) {
            console.log('❌ No memories found for this agent');
            return;
          }
          
          const seqTag = edge.node.tags.find(t => t.name === 'Sequence');
          const actionTag = edge.node.tags.find(t => t.name === 'Action');
          const timestamp = new Date(edge.node.block?.timestamp * 1000).toISOString();
          
          console.log(\`✅ Latest Memory #\${seqTag?.value || '?'}\`);
          console.log(\`TXID: \${edge.node.id}\`);
          console.log(\`Action: \${actionTag?.value || 'Unknown'}\`);
          console.log(\`Time: \${timestamp}\`);
          console.log(\`View: https://arweave.net/\${edge.node.id}\`);
          console.log('');
          
          try {
            const data = await arweave.transactions.getData(edge.node.id, { decode: true, string: true });
            const memory = JSON.parse(data);
            console.log('📄 Memory Contents:');
            console.log(JSON.stringify(memory, null, 2));
          } catch (e) {
            console.log('❌ Could not parse memory data');
          }
        }).catch(console.error);
        "
        ;;
        
    "help"|*)
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  soul, personality    Show the agent's personality/constitution"
        echo "  memories [count]     Show recent memories (default: 5)"
        echo "  stats, statistics    Show agent statistics"
        echo "  latest, last         Show the latest memory in detail"
        echo "  help                 Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 soul              # View agent's personality"
        echo "  $0 memories 10       # View last 10 memories"
        echo "  $0 stats             # View statistics"
        echo "  $0 latest            # View latest memory in detail"
        ;;
esac
