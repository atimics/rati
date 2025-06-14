#!/bin/bash

# RATi Deployment Manager
# Containerized deployment script for the RATi decentralized community platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ConfiguRATion
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
WALLETS_DIR="./wallets"
LOGS_DIR="./logs"

# Print colored output
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
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Setup directories
setup_directories() {
    print_status "Setting up directories..."
    
    mkdir -p "$WALLETS_DIR"
    mkdir -p "$LOGS_DIR"
    
    print_success "Directories created"
}

# Generate environment file
generate_env() {
    if [ ! -f "$ENV_FILE" ]; then
        print_status "GeneRATing environment file..."
        cat > "$ENV_FILE" << EOF
# RATi Environment ConfiguRATion
COMPOSE_PROJECT_NAME=RATi

# Database ConfiguRATion
POSTGRES_DB=RATi
POSTGRES_USER=RATi
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Redis ConfiguRATion
REDIS_PASSWORD=$(openssl rand -base64 32)

# Application ConfiguRATion
NODE_ENV=development
ARWEAVE_HOST=arlocal
ARWEAVE_PORT=1984
ARWEAVE_PROTOCOL=http

# Oracle ConfiguRATion
ORACLE_QUORUM_THRESHOLD=2
ORACLE_HEARTBEAT_INTERVAL=100

# Monitoring
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 16)
EOF
        print_success "Environment file generated"
    else
        print_warning "Environment file already exists"
    fi
}

# Generate wallet
generate_wallet() {
    if [ ! -f "$WALLETS_DIR/wallet.json" ]; then
        print_status "GeneRATing Arweave wallet..."
        
        # Use arlocal's built-in wallet geneRATion or create a simple one
        docker run --rm -v "$(pwd)/$WALLETS_DIR:/wallets" \
            textury/arlocal:latest \
            node -e "
                const Arweave = require('arweave');
                const fs = require('fs');
                const arweave = Arweave.init({});
                arweave.wallets.generate().then(key => {
                    fs.writeFileSync('/wallets/wallet.json', JSON.stringify(key, null, 2));
                    console.log('Wallet generated successfully');
                }).catch(console.error);
            "
        
        print_success "Wallet generated at $WALLETS_DIR/wallet.json"
    else
        print_warning "Wallet already exists"
    fi
}

# Start services
start_services() {
    print_status "Starting RATi services..."
    
    # Start core services first
    docker-compose up -d arlocal redis postgres
    
    # Wait for ArLocal to be ready
    print_status "Waiting for ArLocal to be ready..."
    sleep 10
    
    # Check ArLocal health
    max_attempts=30
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:1984/info > /dev/null; then
            print_success "ArLocal is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "ArLocal failed to start after $max_attempts attempts"
            exit 1
        fi
        
        print_status "Attempt $attempt/$max_attempts: Waiting for ArLocal..."
        sleep 5
        ((attempt++))
    done
    
    # Start remaining services
    docker-compose up -d
    
    print_success "All services started"
}

# Deploy genesis
deploy_genesis() {
    print_status "Deploying genesis document..."
    
    docker-compose exec scripts node scripts/enhanced-deploy.js genesis
    
    print_success "Genesis document deployed"
}

# Deploy processes
deploy_processes() {
    print_status "Deploying ao processes..."
    
    docker-compose exec scripts node scripts/enhanced-deploy.js processes
    
    print_success "Processes deployed"
}

# Full deployment
deploy_full() {
    print_status "Running full deployment..."
    
    docker-compose exec scripts node scripts/enhanced-deploy.js full
    
    print_success "Full deployment completed"
}

# Show status
show_status() {
    print_status "Service Status:"
    docker-compose ps
    
    echo ""
    print_status "Access URLs:"
    echo "  Frontend:    http://localhost:3030"
    echo "  ArLocal:     http://localhost:1984"
    echo "  Grafana:     http://localhost:3031 (admin/admin)"
    echo "  Prometheus:  http://localhost:9090"
    echo "  PostgreSQL:  localhost:5432"
    echo "  Redis:       localhost:6379"
}

# Stop services
stop_services() {
    print_status "Stopping RATi services..."
    docker-compose down
    print_success "Services stopped"
}

# Clean up everything
cleanup() {
    print_warning "This will remove all containers, volumes, and data. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Show logs
show_logs() {
    service="${1:-}"
    if [ -n "$service" ]; then
        docker-compose logs -f "$service"
    else
        docker-compose logs -f
    fi
}

# Main menu
show_help() {
    echo "RATi Deployment Manager"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup           - Complete setup (directories, env, wallet)"
    echo "  start           - Start all services"
    echo "  stop            - Stop all services"
    echo "  restart         - Restart all services"
    echo "  status          - Show service status and URLs"
    echo "  deploy          - Full deployment (genesis + processes)"
    echo "  deploy:genesis  - Deploy genesis document only"
    echo "  deploy:processes- Deploy ao processes only"
    echo "  health          - Run health checks"
    echo "  health:detailed - Run detailed health checks"
    echo "  logs [svc]      - Show logs (optionally for specific service)"
    echo "  cleanup         - Remove all containers and data"
    echo "  help            - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 start"
    echo "  $0 deploy"
    echo "  $0 health:detailed"
    echo "  $0 logs frontend"
}

# Main execution
main() {
    case "${1:-help}" in
        setup)
            check_prerequisites
            setup_directories
            generate_env
            generate_wallet
            print_success "Setup completed"
            ;;
        start)
            check_prerequisites
            start_services
            show_status
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services
            show_status
            ;;
        status)
            show_status
            ;;
        deploy)
            deploy_full
            ;;
        deploy:genesis)
            deploy_genesis
            ;;
        deploy:processes)
            deploy_processes
            ;;
        health)
            ./health-check.sh
            ;;
        health:detailed)
            ./health-check.sh --detailed
            ;;
        logs)
            show_logs "$2"
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
