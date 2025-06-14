#!/bin/bash

# RATi AI Agent Setup Script
# This script helps you configure and deploy AI agents for your decentralized community

set -e

echo "🤖 RATi AI Agent Setup"
echo "======================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if agent directory exists
if [ ! -d "agent" ]; then
    echo "❌ Agent directory not found. Please run this script from the project root."
    exit 1
fi

# Check if wallet exists in agent directory
if [ ! -f "agent/wallet.json" ]; then
    echo "📋 Copying wallet to agent directory..."
    if [ -f "wallets/wallet.json" ]; then
        cp wallets/wallet.json agent/
        echo "✅ Wallet copied successfully"
    else
        echo "❌ No wallet found. Please ensure wallets/wallet.json exists."
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f "agent/.env" ]; then
    echo "📋 Creating agent configuRATion..."
    cp agent/.env.example agent/.env
    echo "⚠️  Please edit agent/.env with your configuRATion:"
    echo "   - Set AO_PROCESS_ID (get this from running 'npm run deploy:processes')"
    echo "   - Set OPENAI_API_KEY"
    echo "   - Customize AGENT_PERSONALITY if desired"
    echo ""
    echo "💡 Tip: Run 'npm run deploy:processes' first to create an AO process for your agent"
    exit 0
fi

# Verify required environment variables are set
source agent/.env
if [ -z "$AO_PROCESS_ID" ] || [ "$AO_PROCESS_ID" = "YOUR_AVATAR_PROCESS_ID_HERE" ]; then
    echo "❌ AO_PROCESS_ID not configured. Please edit agent/.env"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-..." ]; then
    echo "❌ OPENAI_API_KEY not configured. Please edit agent/.env"
    exit 1
fi

echo "✅ ConfiguRATion looks good!"
echo ""

# Install agent dependencies
echo "📦 Installing agent dependencies..."
cd agent
npm install
cd ..

echo "✅ Dependencies installed"
echo ""

# Build and run the agent
echo "🏗️  Building AI agent Docker image..."
docker-compose build ai-agent

echo "✅ Agent built successfully!"
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo "1) Run a single agent"
echo "2) Run multiple agents (swarm)"
echo "3) Run agent with full stack"
echo "4) Just build (don't run)"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🚀 Starting single AI agent..."
        docker-compose up ai-agent
        ;;
    2)
        read -p "How many agents would you like to run? " num_agents
        echo "🚀 Starting $num_agents AI agents..."
        docker-compose up --scale ai-agent=$num_agents -d
        echo "✅ $num_agents agents started! View logs with: docker-compose logs -f ai-agent"
        ;;
    3)
        echo "🚀 Starting full RATi stack with AI agent..."
        docker-compose up -d
        echo "✅ Full stack started! View agent logs with: docker-compose logs -f ai-agent"
        ;;
    4)
        echo "✅ Build complete! Use 'docker-compose up ai-agent' to run the agent."
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
