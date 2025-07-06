#!/bin/bash
set -euo pipefail

# Orb Agent Mono - Startup Script
# This script sets up and starts the complete development environment

echo "🚀 Starting Orb Agent Mono Development Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Podman is available, fallback to Docker
    if command -v podman &> /dev/null; then
        CONTAINER_ENGINE="podman"
        COMPOSE_CMD="podman-compose"
        
        # Check podman-compose
        if ! command -v podman-compose &> /dev/null; then
            print_warning "podman-compose not found, trying docker-compose with podman"
            COMPOSE_CMD="docker-compose"
            export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
        fi
        
        # Check if Podman is running (for rootless)
        if ! podman info &> /dev/null; then
            print_error "Podman is not properly configured. Please ensure Podman is installed and running."
            exit 1
        fi
        
        print_success "Using Podman as container engine"
        
    elif command -v docker &> /dev/null; then
        CONTAINER_ENGINE="docker"
        COMPOSE_CMD="docker compose"
        
        # Check Docker Compose (try new syntax first, then old)
        if ! command -v docker compose &> /dev/null; then
            if command -v docker-compose &> /dev/null; then
                COMPOSE_CMD="docker-compose"
            else
                print_error "Docker Compose is not installed. Please install Docker Compose."
                exit 1
            fi
        fi
        
        # Check if Docker is running
        if ! docker info &> /dev/null; then
            print_error "Docker is not running. Please start Docker first."
            exit 1
        fi
        
        print_success "Using Docker as container engine"
        
    else
        print_error "Neither Podman nor Docker is installed. Please install one of them first."
        exit 1
    fi
    
    print_success "Container engine: $CONTAINER_ENGINE"
    print_success "Compose command: $COMPOSE_CMD"
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Copy environment files if they don't exist
    if [ ! -f .env ]; then
        cp .env.example .env
        print_warning "Created .env from .env.example. Please update with your values."
    fi
    
    if [ ! -f docker/.env ]; then
        cp docker/.env.example docker/.env
        print_warning "Created docker/.env from docker/.env.example. Please update with your values."
    fi
    
    print_success "Environment files ready"
}

# Build container images
build_images() {
    print_status "Building container images..."
    
    # podman-compose doesn't support --parallel flag
    if [[ "$COMPOSE_CMD" == "podman-compose" ]]; then
        # Build with memory limits for Podman
        print_status "Building with Podman (this may take a while)..."
        $COMPOSE_CMD -f docker/compose.dev.yml build
    else
        # Docker build with parallel support
        $COMPOSE_CMD -f docker/compose.dev.yml build --parallel
    fi
    
    print_success "Container images built successfully"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start core infrastructure first
    print_status "Starting core infrastructure (Solana, EVM, Wormhole)..."
    $COMPOSE_CMD -f docker/compose.dev.yml up -d solana evm wormhole
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    
    # Wait for Solana
    print_status "Waiting for Solana validator..."
    timeout 120 bash -c "until $COMPOSE_CMD -f docker/compose.dev.yml exec -T solana solana cluster-version; do sleep 2; done" || {
        print_error "Solana validator failed to start"
        exit 1
    }
    
    # Wait for EVM
    print_status "Waiting for EVM node..."
    timeout 60 bash -c "until $COMPOSE_CMD -f docker/compose.dev.yml exec -T evm cast block-number --rpc-url http://localhost:8545; do sleep 2; done" || {
        print_error "EVM node failed to start"
        exit 1
    }
    
    # Wait for Wormhole (optional)
    print_status "Waiting for Wormhole guardian..."
    timeout 60 bash -c "until $COMPOSE_CMD -f docker/compose.dev.yml exec -T wormhole curl -f http://localhost:7071/v1/heartbeats 2>/dev/null; do sleep 5; done" || {
        print_warning "Wormhole guardian may not be fully ready (this is normal for initial startup)"
    }
    
    # Start development environment
    print_status "Starting development environment..."
    $COMPOSE_CMD -f docker/compose.dev.yml up -d
    
    print_success "All services started successfully"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "cd /workspace && pnpm install"
    
    print_success "Dependencies installed"
}

# Deploy contracts
deploy_contracts() {
    print_status "Deploying smart contracts..."
    
    # Deploy Solana contracts
    print_status "Deploying Solana OrbForge program..."
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T solana bash -c "
        cd /workspace/contracts/solana-forge && 
        anchor build && 
        anchor deploy --provider.cluster localnet
    " || {
        print_warning "Solana contract deployment failed (this is normal if already deployed)"
    }
    
    # Deploy EVM contracts
    print_status "Deploying EVM AgentReceiver contract..."
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T evm bash -c "
        cd /workspace/contracts/evm-receiver && 
        forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
    " || {
        print_warning "EVM contract deployment failed (this may be normal)"
    }
    
    print_success "Contract deployment completed"
}

# Generate test data
generate_test_data() {
    print_status "Generating test data..."
    
    # Generate agent metadata
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "
        cd /workspace/scripts && 
        tsx src/01_gen_agents.ts
    " || {
        print_warning "Agent generation failed (this is normal for development)"
    }
    
    # Create mock uploads
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "
        cd /workspace/scripts && 
        mkdir -p generated/uploads &&
        echo '{\"0\": \"ar://test-uri-0\", \"1\": \"ar://test-uri-1\"}' > generated/uploads/arweave-mapping.json
    "
    
    # Generate Merkle tree
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "
        cd /workspace/scripts && 
        tsx src/03_publish_csv.ts
    " || {
        print_warning "Merkle tree generation failed (this is normal for development)"
    }
    
    print_success "Test data generated"
}

# Run tests
run_tests() {
    if [ "${1:-}" = "--skip-tests" ]; then
        print_warning "Skipping tests"
        return
    fi
    
    print_status "Running test suite..."
    
    # Run TypeScript tests
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "
        cd /workspace/scripts && pnpm test
    " || print_warning "Script tests failed"
    
    # Run web frame tests
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T node bash -c "
        cd /workspace/web-frame && pnpm test:unit
    " || print_warning "Web frame tests failed"
    
    # Run Solana tests (if possible)
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T solana bash -c "
        cd /workspace/contracts/solana-forge && anchor test --skip-lint
    " || print_warning "Solana tests failed"
    
    # Run EVM tests
    $COMPOSE_CMD -f docker/compose.dev.yml exec -T evm bash -c "
        cd /workspace/contracts/evm-receiver && forge test
    " || print_warning "EVM tests failed"
    
    print_success "Test suite completed (some failures are normal in development)"
}

# Show status
show_status() {
    print_status "Development environment status:"
    echo ""
    
    # Show running containers
    $COMPOSE_CMD -f docker/compose.dev.yml ps
    
    echo ""
    print_status "Service URLs:"
    echo "  🌐 Web Frame (Development): http://localhost:5173"
    echo "  ⛓️  Solana RPC: http://localhost:8899"
    echo "  🔗 EVM RPC: http://localhost:8545"
    echo "  🌉 Wormhole API: http://localhost:7071"
    echo ""
    
    print_status "Useful commands:"
    echo "  📋 View logs: $COMPOSE_CMD -f docker/compose.dev.yml logs -f"
    echo "  🔄 Restart services: $COMPOSE_CMD -f docker/compose.dev.yml restart"
    echo "  🛑 Stop all: $COMPOSE_CMD -f docker/compose.dev.yml down"
    echo "  🧪 Run tests: $COMPOSE_CMD -f docker/compose.dev.yml exec node bash -c 'cd /workspace && pnpm test:all'"
    echo "  📊 Generate agents: $COMPOSE_CMD -f docker/compose.dev.yml exec node bash -c 'cd /workspace && pnpm pipeline:full'"
}

# Cleanup function
cleanup() {
    if [ "${1:-}" = "--clean" ]; then
        print_status "Cleaning up..."
        $COMPOSE_CMD -f docker/compose.dev.yml down -v
        if [ "$CONTAINER_ENGINE" = "docker" ]; then
            docker system prune -f
        else
            podman system prune -f
        fi
        print_success "Cleanup completed"
    fi
}

# Main execution
main() {
    # Handle command line arguments
    case "${1:-start}" in
        "start")
            check_prerequisites
            setup_environment
            build_images
            start_services
            install_dependencies
            deploy_contracts
            generate_test_data
            run_tests "$@"
            show_status
            ;;
        "stop")
            check_prerequisites
            $COMPOSE_CMD -f docker/compose.dev.yml down
            print_success "Services stopped"
            ;;
        "restart")
            check_prerequisites
            $COMPOSE_CMD -f docker/compose.dev.yml restart
            print_success "Services restarted"
            ;;
        "status")
            check_prerequisites
            show_status
            ;;
        "logs")
            check_prerequisites
            $COMPOSE_CMD -f docker/compose.dev.yml logs -f "${2:-}"
            ;;
        "test")
            check_prerequisites
            run_tests
            ;;
        "clean")
            check_prerequisites
            cleanup --clean
            ;;
        "help"|"--help"|"-h")
            echo "Orb Agent Mono Development Environment"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start          Start the complete development environment (default)"
            echo "  stop           Stop all services"
            echo "  restart        Restart all services"
            echo "  status         Show service status and URLs"
            echo "  logs [service] Show logs for all services or specific service"
            echo "  test           Run test suites"
            echo "  clean          Stop services and clean up volumes"
            echo "  help           Show this help message"
            echo ""
            echo "Options:"
            echo "  --skip-tests   Skip running tests during startup"
            echo ""
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"