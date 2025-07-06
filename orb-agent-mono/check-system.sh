#!/bin/bash
set -euo pipefail

# System Health Check Script
# Comprehensive validation of the Orb Agent system

echo "🔍 Orb Agent System Health Check"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

# Detect container engine
if command -v podman &> /dev/null; then
    CONTAINER_ENGINE="podman"
    COMPOSE_CMD="podman-compose"
    
    if ! command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
    fi
elif command -v docker &> /dev/null; then
    CONTAINER_ENGINE="docker"
    COMPOSE_CMD="docker compose"
    
    if ! command -v docker compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    fi
else
    echo -e "${RED}❌ Neither Podman nor Docker found${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Using: $CONTAINER_ENGINE${NC}"
echo -e "${BLUE}📋 Compose: $COMPOSE_CMD${NC}"

check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC} $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} $2"
        ((CHECKS_FAILED++))
    fi
}

# Check Container services
echo -e "\n${BLUE}📦 Container Services${NC}"
echo "======================"

# Solana
$COMPOSE_CMD -f docker/compose.dev.yml exec -T solana solana cluster-version >/dev/null 2>&1
check_status $? "Solana validator is running"

# EVM
$COMPOSE_CMD -f docker/compose.dev.yml exec -T evm cast block-number --rpc-url http://localhost:8545 >/dev/null 2>&1
check_status $? "EVM node is running"

# Wormhole
$COMPOSE_CMD -f docker/compose.dev.yml exec -T wormhole curl -f http://localhost:7071/v1/heartbeats >/dev/null 2>&1
check_status $? "Wormhole guardian is running"

# Node service
$COMPOSE_CMD -f docker/compose.dev.yml exec -T node node --version >/dev/null 2>&1
check_status $? "Node.js service is running"

# Check contract deployments
echo -e "\n${BLUE}📜 Smart Contracts${NC}"
echo "==================="

# Check Solana program
SOLANA_PROGRAM_EXISTS=$($COMPOSE_CMD -f docker/compose.dev.yml exec -T solana solana program show FoRGe11111111111111111111111111111111111111 --url http://localhost:8899 2>/dev/null | grep -c "Program Id" || echo "0")
if [ "$SOLANA_PROGRAM_EXISTS" -gt 0 ]; then
    check_status 0 "Solana OrbForge program deployed"
else
    check_status 1 "Solana OrbForge program not deployed"
fi

# Check EVM contract (simplified check)
EVM_CONTRACT_EXISTS=$($COMPOSE_CMD -f docker/compose.dev.yml exec -T evm cast code 0x5fbdb2315678afecb367f032d93f642f64180aa3 --rpc-url http://localhost:8545 2>/dev/null | grep -c "0x" || echo "0")
if [ "$EVM_CONTRACT_EXISTS" -gt 0 ]; then
    check_status 0 "EVM AgentReceiver contract deployed"
else
    check_status 1 "EVM AgentReceiver contract not deployed"
fi

# Check dependencies
echo -e "\n${BLUE}📚 Dependencies${NC}"
echo "================"

# Check if node_modules exist
if $COMPOSE_CMD -f docker/compose.dev.yml exec -T node test -d /workspace/node_modules >/dev/null 2>&1; then
    check_status 0 "Root dependencies installed"
else
    check_status 1 "Root dependencies not installed"
fi

# Check scripts dependencies
if $COMPOSE_CMD -f docker/compose.dev.yml exec -T node test -d /workspace/scripts/node_modules >/dev/null 2>&1; then
    check_status 0 "Scripts dependencies installed"
else
    check_status 1 "Scripts dependencies not installed"
fi

# Check web-frame dependencies
if $COMPOSE_CMD -f docker/compose.dev.yml exec -T node test -d /workspace/web-frame/node_modules >/dev/null 2>&1; then
    check_status 0 "Web frame dependencies installed"
else
    check_status 1 "Web frame dependencies not installed"
fi

# Check generated data
echo -e "\n${BLUE}🤖 Generated Data${NC}"
echo "=================="

# Check if agent data exists
if $COMPOSE_CMD -f docker/compose.dev.yml exec -T node test -d /workspace/scripts/generated/agents >/dev/null 2>&1; then
    AGENT_COUNT=$($COMPOSE_CMD -f docker/compose.dev.yml exec -T node find /workspace/scripts/generated/agents -name "*.json" | wc -l)
    if [ "$AGENT_COUNT" -gt 100 ]; then
        check_status 0 "Agent metadata generated ($AGENT_COUNT files)"
    else
        check_status 1 "Insufficient agent metadata ($AGENT_COUNT files)"
    fi
else
    check_status 1 "Agent metadata not generated"
fi

# Check Merkle tree
if $COMPOSE_CMD -f docker/compose.dev.yml exec -T node test -f /workspace/scripts/generated/merkle/root.json >/dev/null 2>&1; then
    check_status 0 "Merkle tree generated"
else
    check_status 1 "Merkle tree not generated"
fi

# Check environment configuration
echo -e "\n${BLUE}⚙️  Configuration${NC}"
echo "================="

# Check environment files
if [ -f .env ]; then
    check_status 0 "Root .env file exists"
else
    check_status 1 "Root .env file missing"
fi

if [ -f docker/.env ]; then
    check_status 0 "Docker .env file exists"
else
    check_status 1 "Docker .env file missing"
fi

# Check critical env vars
if grep -q "INFURA_API_KEY" .env 2>/dev/null; then
    check_status 0 "INFURA_API_KEY configured"
else
    check_status 1 "INFURA_API_KEY not configured"
fi

# Test basic functionality
echo -e "\n${BLUE}🧪 Basic Functionality${NC}"
echo "======================="

# Test Solana balance check
SOLANA_BALANCE_CHECK=$($COMPOSE_CMD -f docker/compose.dev.yml exec -T solana solana balance --url http://localhost:8899 2>/dev/null | grep -c "SOL" || echo "0")
if [ "$SOLANA_BALANCE_CHECK" -gt 0 ]; then
    check_status 0 "Solana balance query works"
else
    check_status 1 "Solana balance query failed"
fi

# Test EVM latest block
EVM_BLOCK_CHECK=$($COMPOSE_CMD -f docker/compose.dev.yml exec -T evm cast block-number --rpc-url http://localhost:8545 2>/dev/null)
if [ -n "$EVM_BLOCK_CHECK" ] && [ "$EVM_BLOCK_CHECK" -gt 0 ]; then
    check_status 0 "EVM block query works (block: $EVM_BLOCK_CHECK)"
else
    check_status 1 "EVM block query failed"
fi

# Test TypeScript compilation
TS_COMPILE_CHECK=$($COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "cd /workspace/scripts && npx tsc --noEmit" 2>&1)
if [ $? -eq 0 ]; then
    check_status 0 "TypeScript compilation successful"
else
    check_status 1 "TypeScript compilation failed"
fi

# Check web server availability
if curl -f http://localhost:5173 >/dev/null 2>&1; then
    check_status 0 "Web development server responding"
else
    check_status 1 "Web development server not responding"
fi

# System performance checks
echo -e "\n${BLUE}⚡ Performance${NC}"
echo "=============="

# Check container memory usage
if [ "$CONTAINER_ENGINE" = "docker" ]; then
    CONTAINER_MEMORY=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | tail -n +2 | head -4)
    echo "Memory usage:"
    echo "$CONTAINER_MEMORY"
    
    # Check disk usage of volumes
    CONTAINER_VOLUMES=$(docker system df -v | grep "Local Volumes" -A 10 | tail -n +3)
    echo -e "\nVolume usage:"
    echo "$CONTAINER_VOLUMES" | head -5
else
    # Podman stats
    CONTAINER_MEMORY=$(podman stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | tail -n +2 | head -4)
    echo "Memory usage:"
    echo "$CONTAINER_MEMORY"
    
    # Podman volume usage
    echo -e "\nVolume usage:"
    podman volume ls --format "table {{.Name}}\t{{.Driver}}" | head -5
fi

# Security checks
echo -e "\n${BLUE}🔒 Security${NC}"
echo "==========="

# Check for exposed private keys (basic check)
if grep -r "private.*key.*=" . --include="*.ts" --include="*.js" --include="*.json" 2>/dev/null | grep -v "example" | grep -v "test" | grep -v "mock" >/dev/null; then
    check_status 1 "Potential private keys found in code"
else
    check_status 0 "No obvious private keys in code"
fi

# Check if .env files are in .gitignore
if grep -q "\.env" .gitignore 2>/dev/null; then
    check_status 0 ".env files are gitignored"
else
    check_status 1 ".env files not in .gitignore"
fi

# Final summary
echo -e "\n${BLUE}📊 Summary${NC}"
echo "=========="

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
PASS_PERCENTAGE=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

echo -e "Total checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo -e "Success rate: $PASS_PERCENTAGE%"

if [ $PASS_PERCENTAGE -ge 80 ]; then
    echo -e "\n${GREEN}🎉 System is healthy and ready for development!${NC}"
    exit 0
elif [ $PASS_PERCENTAGE -ge 60 ]; then
    echo -e "\n${YELLOW}⚠️  System has some issues but is mostly functional.${NC}"
    echo -e "${YELLOW}Consider running: ./start.sh${NC}"
    exit 1
else
    echo -e "\n${RED}💥 System has significant issues.${NC}"
    echo -e "${RED}Please run: ./start.sh clean && ./start.sh${NC}"
    exit 2
fi