# RATi - Decentralized Movement Platform
# Simplified Docker Compose based deployment

.PHONY: help build up down logs deploy-all reset clean status summon

# Default target
help:
	@echo "🤖 RATi - Decentralized Movement Platform"
	@echo ""
	@echo "Available commands:"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make build       - Build all containers"
	@echo "  make logs        - Show logs for all services"
	@echo "  make status      - Show service status"
	@echo "  make deploy-all  - Run full deployment pipeline"
	@echo "  make summon      - Summon a new AI agent"
	@echo "  make cli         - Open RATi CLI interface"
	@echo "  make reset       - Reset deployment state"
	@echo "  make clean       - Clean up containers and volumes"
	@echo ""
	@echo "CLI commands (via make cli):"
	@echo "  summon [personality-file] [agent-name]  - Summon agent"
	@echo "  deploy [type]                          - Deploy components"
	@echo "  status [deployment-id]                 - Check status"
	@echo ""
	@echo "Web interfaces:"
	@echo "  Frontend:        http://localhost:3030"
	@echo "  Deployment UI:   http://localhost:3032"
	@echo "  Grafana:         http://localhost:3031 (admin/admin)"
	@echo "  Prometheus:      http://localhost:9090"
	@echo "  ArLocal:         http://localhost:1984"

# Build all containers
build:
	@echo "🔨 Building all containers..."
	@./detect-platform.sh
	docker-compose build

# Start all services
up:
	@echo "🚀 Starting RATi platform..."
	@./detect-platform.sh
	docker-compose up -d
	@echo "✅ All services started!"
	@echo ""
	@echo "🌐 Frontend available at: http://localhost:3030"
	@echo "💬 Chat interface will open automatically"
	@echo "⚙️  Deployment UI at: http://localhost:3032"
	@echo "📊 Grafana dashboard at: http://localhost:3031"
	@echo ""
	@echo "⏳ Waiting for services to be ready..."
	@sleep 5
	@echo "🌐 Opening chat interface..."
	@open http://localhost:3030 2>/dev/null || echo "Please open http://localhost:3030 manually"

# Stop all services
down:
	@echo "🛑 Stopping all services..."
	docker-compose down

# Show logs
logs:
	docker-compose logs -f

# Show service status
status:
	@echo "📊 Service Status:"
	docker-compose ps
	@echo ""
	@echo "💾 Volume Usage:"
	docker volume ls | grep RATi

# Run full deployment pipeline via API
deploy-all:
	@echo "🚀 Starting full deployment pipeline..."
	@curl -X POST http://localhost:3032/api/deploy/full \
		-H "Content-Type: application/json" \
		-d '{}' || echo "❌ Deployment service not available. Run 'make up' first."

# Open RATi CLI interface
cli:
	@echo "🖥️  Opening RATi CLI..."
	@./detect-platform.sh
	@echo "Type 'help' for available commands"
	@docker-compose run --rm rati-cli

# Summon a new AI agent via CLI
summon:
	@echo "🎭 Summoning AI agent via CLI..."
	@echo "⏳ Starting arlocal if not running..."
	@./detect-platform.sh
	@docker-compose up -d arlocal
	@echo "⏳ Waiting for arlocal to be ready..."
	@./scripts/wait-for-arlocal.sh
	@echo "🎯 Starting deployment service..."
	@docker-compose up -d deployment-service
	@echo "🔮 Running summon command..."
	@docker-compose run --rm rati-cli bash /app/summon

# Reset deployment state
reset:
	@echo "🔄 Resetting deployment state..."
	@curl -X POST http://localhost:3032/api/reset || echo "❌ Deployment service not available"

# Clean up everything
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v
	docker system prune -f
	@echo "✅ Cleanup complete"

# Development shortcuts
dev-build:
	docker-compose build frontend deployment-service

dev-restart:
	docker-compose restart frontend deployment-service

dev-logs:
	docker-compose logs -f frontend deployment-service

# Interface shortcuts
chat: ## Open chat interface
	@echo "💬 Opening chat interface..."
	@open http://localhost:3030 || echo "Chat interface: http://localhost:3030"

dashboard: ## Open deployment dashboard
	@echo "📊 Opening deployment dashboard..."
	@open http://localhost:3032 || echo "Deployment dashboard: http://localhost:3032"

monitor: ## Open monitoring dashboard
	@echo "📈 Opening Grafana monitoring..."
	@open http://localhost:3031 || echo "Monitoring dashboard: http://localhost:3031 (admin/admin)"

# Quick launch with browser
start: up chat ## Start platform and open chat interface immediately
