#!/bin/bash

# RATi Health Check Script
# Monitors the health of all services and provides detailed status

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_service_health() {
    local service=$1
    local url=$2
    local expected_status=${3:-200}
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        print_success "$service is healthy"
        return 0
    else
        print_error "$service is not responding"
        return 1
    fi
}

check_docker_services() {
    print_header "Docker Services Status"
    
    if ! docker-compose ps --services --filter "status=running" > /dev/null 2>&1; then
        print_error "Docker Compose services are not running"
        return 1
    fi
    
    local services=(
        "RATi-arlocal:ArLocal:http://localhost:1984/info"
        "RATi-frontend:Frontend:http://localhost:3030"
        "RATi-redis:Redis:redis://localhost:6379"
        "RATi-postgres:PostgreSQL:postgresql://localhost:5432"
        "RATi-prometheus:Prometheus:http://localhost:9090/-/healthy"
        "RATi-grafana:Grafana:http://localhost:3031/api/health"
    )
    
    local all_healthy=true
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r container_name service_name url <<< "$service_info"
        
        if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
            if [[ "$url" == http* ]]; then
                if check_service_health "$service_name" "$url"; then
                    :
                else
                    all_healthy=false
                fi
            elif [[ "$url" == redis* ]]; then
                if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
                    print_success "$service_name is healthy"
                else
                    print_error "$service_name is not responding"
                    all_healthy=false
                fi
            elif [[ "$url" == postgresql* ]]; then
                if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
                    print_success "$service_name is healthy"
                else
                    print_error "$service_name is not responding"
                    all_healthy=false
                fi
            fi
        else
            print_warning "$container_name is not running"
            all_healthy=false
        fi
    done
    
    return $([[ "$all_healthy" == true ]] && echo 0 || echo 1)
}

check_arweave_connectivity() {
    print_header "Arweave Connectivity"
    
    # Check ArLocal
    if check_service_health "ArLocal" "http://localhost:1984/info"; then
        local arlocal_info=$(curl -s http://localhost:1984/info)
        echo "  Network: $(echo "$arlocal_info" | jq -r '.network // "unknown"')"
        echo "  Height: $(echo "$arlocal_info" | jq -r '.height // "unknown"')"
    fi
    
    # Check mainnet connectivity
    if check_service_health "Arweave Mainnet" "https://arweave.net/info"; then
        local mainnet_info=$(curl -s https://arweave.net/info)
        echo "  Network: $(echo "$mainnet_info" | jq -r '.network // "unknown"')"
        echo "  Height: $(echo "$mainnet_info" | jq -r '.height // "unknown"')"
    fi
}

check_ao_connectivity() {
    print_header "AO Network Connectivity"
    
    # Check if we can reach AO services
    local ao_urls=(
        "https://ao-cu.herokuapp.com/info"
        "https://ao-su.herokuapp.com/info"
    )
    
    for url in "${ao_urls[@]}"; do
        if check_service_health "AO Service" "$url"; then
            echo "  Service: $url"
        fi
    done
}

check_wallets() {
    print_header "Wallet ConfiguRATion"
    
    if [ -f "./wallets/wallet.json" ]; then
        print_success "Wallet file exists"
        
        # Check wallet format
        if jq empty ./wallets/wallet.json 2>/dev/null; then
            print_success "Wallet file is valid JSON"
        else
            print_error "Wallet file is corrupted"
        fi
        
        # Check wallet permissions
        local perms=$(stat -f "%A" ./wallets/wallet.json 2>/dev/null || stat -c "%a" ./wallets/wallet.json 2>/dev/null)
        if [ "$perms" = "600" ] || [ "$perms" = "400" ]; then
            print_success "Wallet file has secure permissions ($perms)"
        else
            print_warning "Wallet file permissions are not secure ($perms). Consider: chmod 600 ./wallets/wallet.json"
        fi
    else
        print_error "Wallet file not found. Run: ./deploy.sh setup"
    fi
}

check_deployment_status() {
    print_header "Deployment Status"
    
    if [ -f "./deployment-info.json" ]; then
        print_success "Deployment info file exists"
        
        local genesis_txid=$(jq -r '.genesis_txid // empty' ./deployment-info.json 2>/dev/null)
        local oracle_process_id=$(jq -r '.oracle_process_id // empty' ./deployment-info.json 2>/dev/null)
        local avatar_process_id=$(jq -r '.avatar_process_id // empty' ./deployment-info.json 2>/dev/null)
        
        if [ -n "$genesis_txid" ]; then
            print_success "Genesis TXID: $genesis_txid"
        else
            print_warning "Genesis not deployed"
        fi
        
        if [ -n "$oracle_process_id" ]; then
            print_success "Oracle Process ID: $oracle_process_id"
        else
            print_warning "Oracle process not deployed"
        fi
        
        if [ -n "$avatar_process_id" ]; then
            print_success "Avatar Process ID: $avatar_process_id"
        else
            print_warning "Avatar process not deployed"
        fi
    else
        print_warning "No deployment info found. Run deployment to create processes."
    fi
}

check_logs() {
    print_header "Recent Logs Summary"
    
    # Check for any error logs in the last 5 minutes
    local error_count=$(docker-compose logs --since 5m 2>/dev/null | grep -i error | wc -l)
    local warning_count=$(docker-compose logs --since 5m 2>/dev/null | grep -i warning | wc -l)
    
    if [ "$error_count" -eq 0 ]; then
        print_success "No errors in recent logs"
    else
        print_warning "$error_count errors found in recent logs"
    fi
    
    if [ "$warning_count" -eq 0 ]; then
        print_success "No warnings in recent logs"
    else
        print_warning "$warning_count warnings found in recent logs"
    fi
}

generate_report() {
    print_header "System Resource Usage"
    
    # Docker resource usage
    echo "Docker Containers:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "  Unable to get container stats"
    
    echo ""
    echo "Disk Usage:"
    df -h . 2>/dev/null || echo "  Unable to get disk usage"
    
    echo ""
    echo "Memory Usage:"
    if command -v free >/dev/null 2>&1; then
        free -h
    elif command -v vm_stat >/dev/null 2>&1; then
        vm_stat | head -5
    else
        echo "  Unable to get memory stats"
    fi
}

main() {
    echo "RATi Health Check - $(date)"
    echo "======================================"
    
    local exit_code=0
    
    check_docker_services || exit_code=1
    echo ""
    
    check_arweave_connectivity
    echo ""
    
    check_ao_connectivity
    echo ""
    
    check_wallets
    echo ""
    
    check_deployment_status
    echo ""
    
    check_logs
    echo ""
    
    if [ "${1:-}" = "--detailed" ]; then
        generate_report
        echo ""
    fi
    
    if [ $exit_code -eq 0 ]; then
        print_success "All systems opeRATional"
    else
        print_error "Some issues detected. Check the output above."
    fi
    
    echo ""
    echo "Quick Commands:"
    echo "  ./deploy.sh logs     - View all logs"
    echo "  ./deploy.sh status   - Service status"  
    echo "  ./health-check.sh --detailed - Detailed report"
    
    exit $exit_code
}

main "$@"
