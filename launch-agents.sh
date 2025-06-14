#!/bin/bash

# Quick launch script for RATi AI agents
# Usage: ./launch-agents.sh [number_of_agents]

set -e

AGENTS=${1:-1}

echo "🤖 Launching $AGENTS RATi AI Agent(s)"
echo "====================================="

# Check if configuRATion exists
if [ ! -f "agent/.env" ]; then
    echo "❌ Agent not configured. Run './setup-agent.sh' first"
    exit 1
fi

# Quick validation
source agent/.env
if [ -z "$AO_PROCESS_ID" ] || [ "$AO_PROCESS_ID" = "YOUR_AVATAR_PROCESS_ID_HERE" ]; then
    echo "❌ AO_PROCESS_ID not configured. Please edit agent/.env"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-..." ]; then
    echo "❌ OPENAI_API_KEY not configured. Please edit agent/.env"
    exit 1
fi

# Launch agents
if [ "$AGENTS" -eq 1 ]; then
    echo "🚀 Launching single agent in foreground..."
    docker-compose up ai-agent
else
    echo "🚀 Launching $AGENTS agents in background..."
    docker-compose up --scale ai-agent=$AGENTS -d ai-agent
    echo ""
    echo "✅ $AGENTS agents launched successfully!"
    echo "📊 View logs: docker-compose logs -f ai-agent"
    echo "🛑 Stop agents: docker-compose down"
    echo "📈 Monitor: docker-compose ps"
fi
