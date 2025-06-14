#!/bin/bash

# RATi Platform Setup Script
# Automated setup for the complete dockerized deployment system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "🤖 RATi Digital Cell Platform Setup"
echo "===================================="
echo -e "${NC}"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Create necessary directories
echo -e "${BLUE}Creating necessary directories...${NC}"
mkdir -p wallets logs agent/logs

# Check if wallet exists
if [ ! -f "wallets/wallet.json" ]; then
    echo -e "${YELLOW}⚠️  No wallet found in wallets/wallet.json${NC}"
    echo "You'll need to add a wallet file before deploying."
    echo "Visit https://arweave.app/ to create a wallet."
fi

# Check if agent environment is configured
if [ ! -f "agent/.env" ]; then
    echo -e "${BLUE}Creating agent environment file...${NC}"
    if [ -f "agent/.env.example" ]; then
        cp agent/.env.example agent/.env
        echo -e "${GREEN}✅ Created agent/.env from example${NC}"
        echo -e "${YELLOW}⚠️  Please edit agent/.env with your configuRATion${NC}"
    else
        echo -e "${YELLOW}⚠️  agent/.env.example not found, creating basic config${NC}"
        cat > agent/.env << EOF
# AO ConfiguRATion
AO_PROCESS_ID=""

# OpenAI-Compatible API ConfiguRATion
OPENAI_API_KEY="your-api-key-here"
OPENAI_API_URL="https://api.openai.com/v1"

# Polling ConfiguRATion
POLLING_INTERVAL=15000
EOF
        echo -e "${GREEN}✅ Created basic agent/.env${NC}"
    fi
fi

# Build containers
echo -e "${BLUE}Building Docker containers...${NC}"
docker-compose build

echo -e "${GREEN}"
echo "🎉 Setup Complete!"
echo "=================="
echo -e "${NC}"

echo "Next steps:"
echo "1. Add your Arweave wallet to wallets/wallet.json"
echo "2. Configure agent/.env with your API keys"
echo "3. Start the platform: make up"
echo "4. Open http://localhost:3030 in your browser"
echo ""
echo "Quick start commands:"
echo "  make up          # Start all services"
echo "  make logs        # View logs"
echo "  make deploy-all  # Deploy everything"
echo "  make down        # Stop services"
echo ""
echo -e "${BLUE}For full documentation, see README.md${NC}"
