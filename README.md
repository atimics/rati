# RATi - Decentralized Digital Avatar Platform

<div align="center">
  <img src="frontend/public/rati-logo-light.png" alt="RATi Logo" width="200">
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
  
  *A cutting-edge decentralized community platform built on Arweave and AO*
</div>

## 🚀 Overview

RATi is a revolutionary decentralized platform that enables the creation and management of digital avatars on the Arweave blockchain. Built with modern web technologies and powered by AO processes, RATi provides a seamless experience for deploying, managing, and interacting with AI agents in a decentralized environment.

## ✨ Features

- **🤖 AI-Powered Digital Avatars** - Deploy intelligent agents with persistent on-chain memory
- **🌐 Decentralized Architecture** - Built on Arweave for permanent, censorship-resistant storage
- **⚡ Real-time Communication** - WebSocket-based live updates and interactions
- **🎨 Modern UI** - Beautiful, responsive interface with dark/light theme support
- **🔒 Secure Wallet Integration** - Built-in wallet management and cryptographic security
- **📊 Deployment Management** - Comprehensive deployment pipeline with monitoring
- **🐳 Docker Ready** - Containerized services for easy deployment and scaling

## �️ Technology Stack

### Frontend
- **React 19** - Modern React with hooks and concurrent features
- **Vite** - Lightning-fast build tool and development server
- **CSS3** - Custom styling with gradients and animations
- **WebSocket** - Real-time communication

### Backend
- **Node.js 18+** - Modern JavaScript runtime
- **Express.js** - Web application framework
- **WebSocket Server** - Real-time bidirectional communication
- **Arweave** - Decentralized storage network
- **AO Connect** - Arweave's Actor Oriented compute platform

### DevOps
- **Docker & Docker Compose** - Containerization and orchestration
- **ESLint** - Code linting and quality assurance
- **Modern Build Pipeline** - Automated builds and deployments

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │ Deployment      │    │   AI Agent      │
│   (React)       │◄──►│   Service       │◄──►│   (Node.js)     │
│                 │    │   (Express)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │      Arweave &          │
                    │    AO Processes         │
                    │  (Decentralized         │
                    │     Storage)            │
                    └─────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Docker & Docker Compose** - [Get Docker](https://docs.docker.com/get-docker/)
- **Git** - [Install Git](https://git-scm.com/downloads)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/rati.git
   cd rati
   ```

2. **Quick Start (Recommended)**
   ```bash
   # Run the welcome script for guided setup
   ./welcome.sh
   ```

3. **Manual Setup**
   ```bash
   # Install all dependencies
   npm run setup
   
   # Create necessary directories and config files
   ./setup.sh
   ```

4. **Add Your Wallet and API Keys**
   ```bash
   # 1. Add your Arweave wallet to wallets/wallet.json
   # 2. Configure agent/.env with your OpenAI API key (copy from agent/.env.example)
   # 3. Optional: Configure integrations (Farcaster, Matrix)
   
   # Quick setup:
   cp agent/.env.example agent/.env
   # Edit agent/.env with your API keys
   ```

5. **Start the Platform**
   ```bash
   # Using Make (recommended)
   make up
   
   # Or using Docker Compose directly
   docker-compose up -d
   ```

6. **Deploy Your Digital Avatar**
   ```bash
   # Full deployment pipeline
   make deploy-all
   
   # Or deploy components individually
   npm run deploy:genesis
   npm run deploy:processes
   ```

7. **Access the Applications**
   - **💬 Chat Interface**: http://localhost:3030
   - **⚙️ Deployment Dashboard**: http://localhost:3032
   - **📊 Monitoring (Grafana)**: http://localhost:3031
   - **📈 Metrics (Prometheus)**: http://localhost:9090

## 📖 Usage Guide

### Deploying Your First Digital Avatar

1. **Setup your agent configuration**
   ```bash
   # Interactive setup wizard
   ./setup-agent.sh
   ```

2. **Configure your environment**
   Edit `agent/.env` with your configuration:
   ```env
   # Core Configuration
   AO_PROCESS_ID=your_process_id_here
   OPENAI_API_KEY=your_openai_key_here
   OPENAI_API_URL=https://api.openai.com/v1
   
   # Agent Behavior
   POLLING_INTERVAL=15000
   AI_ACTION_HISTORY_LENGTH=20
   
   # Optional Integrations
   FARCASTER_API_KEY=your_farcaster_key
   FARCASTER_SIGNER_UUID=your_signer_uuid
   MATRIX_HOMESERVER=https://matrix.org
   MATRIX_ACCESS_TOKEN=your_matrix_token
   ```

3. **Launch your agent**
   ```bash
   # Single agent
   npm run agent:launch
   
   # Agent swarm (multiple instances)
   npm run agent:swarm
   
   # With custom personality
   ./summon-avatar.sh
   ```

4. **Monitor your agent**
   ```bash
   # View real-time logs
   npm run agent:logs
   
   # Run health checks
   npm run health:check
   
   # Interactive agent explorer
   ./explore-agent.sh
   ```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Install all dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run deploy:genesis` | Deploy genesis scrolls to Arweave |
| `npm run deploy:processes` | Deploy AO processes |
| `npm run deploy:full` | Full deployment pipeline |
| `npm run agent:setup` | Setup agent configuration |
| `npm run agent:launch` | Launch a single agent |
| `npm run agent:swarm` | Launch multiple agents |
| `npm run agent:logs` | View agent logs |
| `npm run agent:stop` | Stop running agents |
| `npm run health:check` | Run system health checks |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run end-to-end tests |
| `make up` | Start all Docker services |
| `make down` | Stop all Docker services |
| `make logs` | View all service logs |
| `make deploy-all` | Deploy everything via API |
| `make clean` | Clean up containers and volumes |
| `./welcome.sh` | Interactive welcome and setup |
| `./summon-avatar.sh` | Summon agent with custom personality |
| `./explore-agent.sh` | Interactive agent monitoring |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Arweave Configuration
ARWEAVE_HOST=localhost
ARWEAVE_PORT=1984
ARWEAVE_PROTOCOL=http

# AO Configuration
AO_MODULE_ID=SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk
AO_SCHEDULER_ID=_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA

# Application Configuration
NODE_ENV=development
PORT=3030
```

### Docker Configuration

The project includes multiple Docker services:

- **Frontend** - React application
- **Deployment Service** - Backend API
- **AI Agent** - Intelligent agent runner
- **ArLocal** - Local Arweave node for development

## 🧪 Development

### Project Structure

```
rati/
├── agent/                 # AI agent implementation
├── deployment-service/    # Backend deployment service
├── frontend/             # React frontend application
├── scripts/              # Deployment and utility scripts
├── scrolls/              # Genesis documents
├── src/                  # Core AO process code
├── wallets/              # Wallet files (gitignored)
├── docker-compose.yml    # Docker services configuration
└── package.json          # Root package configuration
```

### Development Workflow

1. **Start services**
   ```bash
   docker-compose up -d
   ```

2. **Develop frontend**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test deployments**
   ```bash
   ./test-integration.sh
   ```

4. **Monitor logs**
   ```bash
   docker-compose logs -f
   ```

## 🔒 Security

- **Wallet Security** - All wallet files are automatically excluded from version control
- **Environment Variables** - Sensitive configuration is stored in environment files
- **CORS Protection** - Properly configured CORS policies
- **Input Validation** - All user inputs are validated and sanitized

## 🚀 Deployment

### Production Deployment

1. **Build for production**
   ```bash
   npm run build
   ```

2. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Configure production environment**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation** - [Visit our docs](https://docs.rati.ai)
- **Issues** - [GitHub Issues](https://github.com/your-username/rati/issues)
- **Discussions** - [GitHub Discussions](https://github.com/your-username/rati/discussions)
- **Discord** - [Join our community](https://discord.gg/rati)

## 🌟 Roadmap

- [ ] Multi-agent coordination protocols
- [ ] Advanced AI personality templates
- [ ] Mobile application
- [ ] Plugin system for custom behaviors
- [ ] Integration with other blockchain networks
- [ ] Advanced analytics and monitoring
- [ ] Governance token and DAO features

---

<div align="center">
  <p>Built with ❤️ by the RATi community</p>
  <p>
    <a href="https://github.com/your-username/rati">GitHub</a> •
    <a href="https://docs.rati.ai">Documentation</a> •
    <a href="https://discord.gg/rati">Discord</a>
  </p>
</div>

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Docker Issues
```bash
# If Docker services fail to start
docker-compose down -v
docker system prune -f
make up

# Check service status
make status
docker-compose ps
```

#### Arweave Connection Issues
```bash
# Check ArLocal status
curl http://localhost:3032/api/arweave/status

# Restart ArLocal
docker-compose restart arlocal

# Manual block mining (development)
curl -X POST http://localhost:3032/api/arweave/mine
```

#### Wallet and Deployment Issues
```bash
# Check wallet balance
curl http://localhost:3032/api/wallet/balance

# Add test funds (development only)
curl -X POST http://localhost:3032/api/wallet/mint/1

# Reset deployment state
curl -X POST http://localhost:3032/api/reset
```

#### Agent Configuration Issues
```bash
# Validate agent configuration
./setup-agent.sh

# Check agent environment
cat agent/.env

# Test API connections
curl -X POST http://localhost:3032/api/agent/test-connection/openai
```

#### Port Conflicts
If ports are already in use, modify `docker-compose.yml`:
- Frontend: Change `3030:80` to `3031:80`
- Deployment Service: Change `3032:3032` to `3033:3032`
- Grafana: Change `3031:3000` to `3034:3000`

#### Performance Issues
```bash
# Check resource usage
docker stats

# Restart specific services
docker-compose restart deployment-service
docker-compose restart ai-agent

# Clean up logs
docker-compose logs --tail=100
```

### Getting Help

- **💬 GitHub Discussions**: [Ask questions and share ideas](https://github.com/your-username/rati/discussions)
- **🐛 Bug Reports**: [Report issues](https://github.com/your-username/rati/issues)
- **📖 Documentation**: [Wiki and guides](https://github.com/your-username/rati/wiki)
- **💡 Feature Requests**: [Suggest improvements](https://github.com/your-username/rati/issues/new?template=feature_request.md)
