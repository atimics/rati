#!/bin/bash

# RATi End-to-End Deployment Test
# Tests all deployment scripts and verifies they work in both local and Docker environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

cleanup() {
    print_info "Cleaning up test environment..."
    docker-compose down arlocal 2>/dev/null || true
}

trap cleanup EXIT

main() {
    print_header "RATi End-to-End Deployment Test"
    
    # 1. Test Arweave connectivity
    print_header "Testing Arweave Connectivity"
    if npm run test-arweave; then
        print_success "Arweave connectivity test passed"
    else
        print_error "Arweave connectivity test failed"
        print_info "Starting ArLocal..."
        npm run start-arlocal
        sleep 5
        if npm run test-arweave; then
            print_success "Arweave connectivity established after starting ArLocal"
        else
            print_error "Failed to establish Arweave connectivity"
            exit 1
        fi
    fi
    
    # 2. Test Genesis Deployment
    print_header "Testing Genesis Deployment"
    if node scripts/deploy-genesis.js; then
        print_success "Genesis deployment test passed"
    else
        print_error "Genesis deployment test failed"
        exit 1
    fi
    
    # 3. Test Enhanced Deployment (quick mode)
    print_header "Testing Enhanced Deployment (Quick Mode)"
    if node scripts/enhanced-deploy.js quick; then
        print_success "Enhanced deployment test passed"
    else
        print_error "Enhanced deployment test failed"
        exit 1
    fi
    
    # 4. Test Frontend Build
    print_header "Testing Frontend Build"
    if cd frontend && npm run build && cd ..; then
        print_success "Frontend build test passed"
    else
        print_error "Frontend build test failed"
        exit 1
    fi
    
    # 5. Test Linting
    print_header "Testing Code Quality (Linting)"
    if npm run lint; then
        print_success "Code quality test passed"
    else
        print_error "Code quality test failed"
        exit 1
    fi
    
    # 6. Test Docker Compose Configuration
    print_header "Testing Docker Compose Configuration"
    if docker-compose config > /dev/null 2>&1; then
        print_success "Docker Compose configuration is valid"
    else
        print_error "Docker Compose configuration is invalid"
        exit 1
    fi
    
    print_header "🎉 All Tests Passed!"
    print_success "RATi repository is ready for use"
    print_info "You can now:"
    echo "  • Start the full stack: npm run docker:up"
    echo "  • Deploy agents: npm run agent:setup && npm run agent:launch"
    echo "  • Summon avatar: npm run summon-avatar"
    echo "  • Run health checks: npm run health:check"
}

main "$@"
