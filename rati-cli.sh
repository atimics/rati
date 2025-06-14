#!/bin/bash

# RATi CLI Wrapper
# Runs commands inside the Docker network where arlocal is accessible

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🤖 RATi CLI - Running inside Docker network"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start arlocal if not running
echo "⏳ Ensuring arlocal is running..."
docker-compose up -d arlocal

# Wait a moment for arlocal to be ready
echo "⏳ Waiting for arlocal to be ready..."
sleep 3

# Check if arlocal is responding
if ! docker-compose exec -T arlocal curl -s http://localhost:1984/info > /dev/null; then
    echo "⏳ Arlocal still starting up, waiting a bit more..."
    sleep 5
fi

# Run the command inside the Docker network
if [ $# -eq 0 ]; then
    echo "🎯 Available commands:"
    echo "  summon        - Summon a new AI agent"
    echo "  deploy-agent  - Deploy agent script"
    echo "  shell         - Open interactive shell"
    echo ""
    echo "Usage: ./rati-cli.sh <command>"
else
    case "$1" in
        "summon")
            echo "🔮 Summoning new AI agent..."
            docker-compose run --rm rati-cli node scripts/deploy-agent.js
            ;;
        "deploy-agent")
            echo "🎯 Running agent deployment..."
            docker-compose run --rm rati-cli node scripts/deploy-agent.js
            ;;
        "shell")
            echo "🐚 Opening interactive shell..."
            docker-compose run --rm rati-cli bash
            ;;
        *)
            echo "❌ Unknown command: $1"
            echo "Available commands: summon, deploy-agent, shell"
            exit 1
            ;;
    esac
fi

echo "✅ Command completed!"
