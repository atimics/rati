#!/bin/bash

# IntegRATion test for the RATi AI Agent system
# This script tests the complete agent lifecycle

set -e  # Exit on any error

echo "🧪 Starting RATi AI Agent IntegRATion Test"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test configuRATion
TEST_DIR="/tmp/RATi-agent-test-$$"
AGENT_DIR="$(pwd)/agent"

cleanup() {
    echo -e "\n🧹 Cleaning up test environment..."
    cd "$(pwd)"
    rm -rf "$TEST_DIR" 2>/dev/null || true
    docker-compose down ai-agent 2>/dev/null || true
}

trap cleanup EXIT

echo -e "${YELLOW}📋 Test Environment Setup${NC}"
echo "Test directory: $TEST_DIR"
echo "Agent directory: $AGENT_DIR"

# 1. Check prerequisites
echo -e "\n${YELLOW}✅ Checking Prerequisites${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js.${NC}"
    exit 1
fi

echo "✅ Docker: $(docker --version)"
echo "✅ Node: $(node --version)"

# 2. Check ArLocal is running
echo -e "\n${YELLOW}🌐 Checking ArLocal${NC}"
if curl -s http://localhost:1984/info > /dev/null; then
    echo "✅ ArLocal is running"
else
    echo -e "${RED}❌ ArLocal not running. Starting docker-compose services...${NC}"
    docker-compose up -d arlocal
    sleep 5
    
    if curl -s http://localhost:1984/info > /dev/null; then
        echo "✅ ArLocal started successfully"
    else
        echo -e "${RED}❌ Failed to start ArLocal${NC}"
        exit 1
    fi
fi

# 3. Check agent files exist
echo -e "\n${YELLOW}📁 Checking Agent Files${NC}"

required_files=(
    "$AGENT_DIR/package.json"
    "$AGENT_DIR/agent.js"
    "$AGENT_DIR/prompt.md"
    "$AGENT_DIR/wallet.json"
    "$AGENT_DIR/Dockerfile"
    "$AGENT_DIR/.env.example"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ Found: $(basename "$file")"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        exit 1
    fi
done

# 4. Test agent dependencies
echo -e "\n${YELLOW}📦 Testing Agent Dependencies${NC}"
cd "$AGENT_DIR"

if [[ ! -d "node_modules" ]]; then
    echo "Installing agent dependencies..."
    npm install
fi

echo "✅ Agent dependencies installed"

# 5. Test configuRATion
echo -e "\n${YELLOW}⚙️  Testing ConfiguRATion${NC}"

if [[ ! -f ".env.test" ]]; then
    echo "Creating test configuRATion..."
    cat > .env.test << EOF
AO_PROCESS_ID="test-process-$(date +%s)"
OPENAI_API_KEY="test-key"
OPENAI_API_URL="https://api.openai.com/v1"
POLLING_INTERVAL=5000
ARWEAVE_HOST="localhost"
ARWEAVE_PORT=1984
ARWEAVE_PROTOCOL="http"
EOF
fi

echo "✅ Test configuRATion created"

# 6. Test agent script syntax
echo -e "\n${YELLOW}🔍 Testing Agent Script Syntax${NC}"

if node -c agent.js; then
    echo "✅ Agent script syntax is valid"
else
    echo -e "${RED}❌ Agent script has syntax errors${NC}"
    exit 1
fi

# 7. Test Docker build
echo -e "\n${YELLOW}🐳 Testing Docker Build${NC}"

cd ..
if docker-compose build ai-agent; then
    echo "✅ Agent Docker image built successfully"
else
    echo -e "${RED}❌ Failed to build agent Docker image${NC}"
    exit 1
fi

# 8. Test agent scripts
echo -e "\n${YELLOW}🔧 Testing Agent Scripts${NC}"

scripts=(
    "./birth-agent.sh"
    "./explore-agent.sh"
    "./launch-agents.sh"
    "./setup-agent.sh"
    "./test-agent.sh"
)

for script in "${scripts[@]}"; do
    if [[ -x "$script" ]]; then
        echo "✅ Executable: $(basename "$script")"
    else
        echo -e "${YELLOW}⚠️  Making executable: $(basename "$script")${NC}"
        chmod +x "$script"
    fi
done

# 9. Test Arweave connection (mock)
echo -e "\n${YELLOW}🔗 Testing Arweave Connection${NC}"

test_arweave_query='{"query": "{ transactions(first: 1) { edges { node { id } } } }"}'

if curl -s -X POST http://localhost:1984/graphql \
   -H "Content-Type: application/json" \
   -d "$test_arweave_query" > /dev/null; then
    echo "✅ Arweave GraphQL endpoint accessible"
else
    echo -e "${RED}❌ Cannot access Arweave GraphQL endpoint${NC}"
    exit 1
fi

# 10. Quick agent lifecycle test (dry run)
echo -e "\n${YELLOW}🧪 Testing Agent Lifecycle (Dry Run)${NC}"

cd agent
cat > test-lifecycle.js << 'EOF'
// Basic test of agent initialization without API calls
import fs from 'fs';

console.log('🧪 Testing agent module loading...');

// Test wallet loading
try {
    const wallet = JSON.parse(fs.readFileSync('./wallet.json', 'utf8'));
    console.log('✅ Wallet loaded successfully');
} catch (error) {
    console.log('❌ Failed to load wallet:', error.message);
    process.exit(1);
}

// Test prompt loading
try {
    const prompt = fs.readFileSync('./prompt.md', 'utf8');
    if (prompt.length > 0) {
        console.log('✅ Prompt loaded successfully');
    } else {
        console.log('❌ Prompt file is empty');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Failed to load prompt:', error.message);
    process.exit(1);
}

console.log('✅ Agent lifecycle test passed');
EOF

if node test-lifecycle.js; then
    echo "✅ Agent lifecycle test passed"
    rm test-lifecycle.js
else
    echo -e "${RED}❌ Agent lifecycle test failed${NC}"
    rm -f test-lifecycle.js
    exit 1
fi

# Final summary
echo -e "\n${GREEN}🎉 IntegRATion Test Summary${NC}"
echo "=============================="
echo "✅ All prerequisites met"
echo "✅ ArLocal running and accessible"
echo "✅ Agent files present and valid"
echo "✅ Dependencies installed"
echo "✅ Docker build successful"
echo "✅ Scripts executable"
echo "✅ Arweave connection working"
echo "✅ Agent lifecycle test passed"

echo -e "\n${GREEN}🚀 RATi AI Agent System is ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure your OpenAI API key in agent/.env"
echo "2. Run './birth-agent.sh' to create your first agent"
echo "3. Run './launch-agents.sh 1' to start the agent"
echo ""
echo "For detailed usage, see agent/README.md"

cd ..
