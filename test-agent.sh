#!/bin/bash

# Simple test script to verify AI agent setup
# This tests the basic configuRATion and connectivity

set -e

echo "🧪 Testing RATi AI Agent Setup"
echo "==============================="

# Test 1: Check required files exist
echo "📁 Checking required files..."

required_files=(
    "agent/package.json"
    "agent/agent.js"
    "agent/Dockerfile"
    "agent/.env.example"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Test 2: Check if wallet exists
if [ -f "agent/wallet.json" ]; then
    echo "✅ agent/wallet.json exists"
elif [ -f "wallets/wallet.json" ]; then
    echo "⚠️  wallet.json in wallets/ directory (run setup to copy)"
else
    echo "❌ No wallet.json found"
    exit 1
fi

# Test 3: Check Docker setup
echo ""
echo "🐳 Testing Docker setup..."

if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
else
    echo "❌ Docker not found"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose is installed"
else
    echo "❌ Docker Compose not found"
    exit 1
fi

# Test 4: Check if we can build the agent
echo ""
echo "🏗️  Testing agent build..."

if docker-compose build ai-agent &> /dev/null; then
    echo "✅ Agent builds successfully"
else
    echo "❌ Agent build failed"
    echo "💡 Make sure agent/wallet.json exists and dependencies are correct"
    exit 1
fi

# Test 5: Check configuRATion
echo ""
echo "⚙️  Checking configuRATion..."

if [ -f "agent/.env" ]; then
    echo "✅ agent/.env exists"
    
    # Check if properly configured
    source agent/.env
    if [ -z "$AO_PROCESS_ID" ] || [ "$AO_PROCESS_ID" = "YOUR_CELL_PROCESS_ID_HERE" ]; then
        echo "⚠️  AO_PROCESS_ID not configured"
    else
        echo "✅ AO_PROCESS_ID configured"
    fi
    
    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-..." ]; then
        echo "⚠️  OPENAI_API_KEY not configured"
    else
        echo "✅ OPENAI_API_KEY configured"
    fi
else
    echo "⚠️  agent/.env not found (run setup script)"
fi

echo ""
echo "🎉 Basic setup test complete!"
echo "💡 Next steps:"
echo "   1. Run './setup-agent.sh' to configure your agent"
echo "   2. Run 'npm run deploy:processes' to create AO processes"
echo "   3. Run 'npm run agent:launch' to start your agent"
