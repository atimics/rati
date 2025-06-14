#!/bin/bash

# RATi Platform Welcome Script
# Provides guided startup experience

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art
echo -e "${PURPLE}"
cat << "EOF"
██████╗  █████╗ ████████╗██╗
██╔══██╗██╔══██╗╚══██╔══╝██║
██████╔╝███████║   ██║   ██║
██╔══██╗██╔══██║   ██║   ██║
██║  ██║██║  ██║   ██║   ██║
╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝

Digital Cell Platform
EOF
echo -e "${NC}"

echo -e "${CYAN}🤖 Welcome to RATi - Your Digital Cell Platform${NC}"
echo -e "${BLUE}Building the future of decentralized digital organisms${NC}"
echo ""

# Check if this is first run
if [ ! -f "wallets/wallet.json" ]; then
    echo -e "${YELLOW}⚠️  First Time Setup Required${NC}"
    echo ""
    echo -e "${BLUE}Before starting, you'll need:${NC}"
    echo "1. 📄 An Arweave wallet (wallets/wallet.json)"
    echo "2. 🔑 OpenAI API key (agent/.env)"
    echo ""
    echo -e "${YELLOW}Would you like to run the setup wizard? (y/n)${NC}"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔧 Running setup wizard...${NC}"
        ./setup.sh
        echo ""
        echo -e "${GREEN}✅ Setup complete! Now let's start the platform.${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping setup. Make sure to configure wallets and API keys manually.${NC}"
    fi
    echo ""
fi

echo -e "${BLUE}🚀 Starting RATi Digital Cell Platform...${NC}"
echo ""

# Start the platform
docker-compose up -d

echo ""
echo -e "${GREEN}✅ Platform started successfully!${NC}"
echo ""

# Show status
echo -e "${CYAN}📊 Service Status:${NC}"
echo "🌐 Frontend:        http://localhost:3030"
echo "💬 Chat Interface:  http://localhost:3030 (default tab)"
echo "⚙️  Deployment API:  http://localhost:3032"
echo "📈 Monitoring:      http://localhost:3031 (admin/admin)"
echo "🔗 ArLocal:         http://localhost:1984"
echo ""

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to initialize...${NC}"
sleep 8

# Check if services are responding
echo -e "${BLUE}🔍 Checking service health...${NC}"

if curl -s -f http://localhost:3030 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend ready${NC}"
else
    echo -e "${YELLOW}⏳ Frontend still starting...${NC}"
fi

if curl -s -f http://localhost:3032/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Deployment service ready${NC}"
else
    echo -e "${YELLOW}⏳ Deployment service still starting...${NC}"
fi

echo ""
echo -e "${PURPLE}🎉 Welcome to your Digital Cell Platform!${NC}"
echo ""
echo -e "${CYAN}💬 Your AI agent is ready to chat!${NC}"
echo -e "${BLUE}Open your browser to start interacting with your digital cell.${NC}"
echo ""

# Auto-open browser
echo -e "${BLUE}🌐 Opening chat interface...${NC}"
if command -v open > /dev/null 2>&1; then
    open http://localhost:3030
    echo -e "${GREEN}✅ Browser opened automatically${NC}"
else
    echo -e "${YELLOW}Please open http://localhost:3030 in your browser${NC}"
fi

echo ""
echo -e "${CYAN}Quick Commands:${NC}"
echo "  make chat      - Open chat interface"
echo "  make dashboard - Open deployment dashboard"
echo "  make monitor   - Open monitoring"
echo "  make logs      - View real-time logs"
echo "  make down      - Stop all services"
echo ""
echo -e "${GREEN}Enjoy building your digital cell! 🚀${NC}"
