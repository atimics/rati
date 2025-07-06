# Orb Agent Mono 🤖

**Transform Orbs into AI Agents across multiple blockchains using $RARI tokens**

A production-grade, test-driven, container-first system for creating cross-chain Agent NFTs from Orbs via Wormhole bridging.

## 🌟 Features

- **Cross-Chain Minting**: Transform Orbs on Solana into Agent NFTs on any supported EVM chain
- **Wormhole Integration**: Secure cross-chain messaging with guardian validation
- **Decentralized Storage**: Agent metadata permanently stored on Arweave via Bundlr
- **Merkle Proof Validation**: Cryptographic verification of all agent metadata
- **Container-First Development**: Fully dockerized with reproducible builds (Docker & Podman support)
- **Comprehensive Testing**: Unit, integration, and end-to-end test suites
- **Production Ready**: Security audited with CI/CD pipeline

### Development Environment

- **Local Wormhole Service**: Comprehensive mock implementation for development
- **Multi-Architecture Support**: Works on ARM64 (Apple Silicon) and x86_64
- **Podman Compatible**: Enhanced security with rootless containers

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Solana        │    │    Wormhole      │    │   EVM Chains    │
│   OrbForge      │◄──►│    Guardian      │◄──►│ AgentReceiver   │
│   Program       │    │    Network       │    │   Contract      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐                            ┌─────────────────┐
│   $RARI Token   │                            │   Agent NFT     │
│   (Burned)      │                            │   (Minted)      │
└─────────────────┘                            └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Git

### 1. Clone and Setup

```bash
git clone https://github.com/orb-agents/orb-agent-mono.git
cd orb-agent-mono
```

### 2. Start Development Environment

```bash
# One-command setup and start
./start.sh

# Or start without tests
./start.sh start --skip-tests
```

This automatically:
- ✅ Builds all Docker images
- ✅ Starts Solana validator, EVM node, and Wormhole guardian
- ✅ Deploys smart contracts
- ✅ Generates test data
- ✅ Runs test suites
- ✅ Starts development server

**Services Available:**
- **Web Frame**: http://localhost:5173
- **Solana RPC**: http://localhost:8899
- **EVM RPC**: http://localhost:8545
- **Wormhole API**: http://localhost:7071

### 3. Explore the System

```bash
# View status and logs
./start.sh status
./start.sh logs

# Run tests manually
./start.sh test

# Stop services
./start.sh stop

# Clean up everything
./start.sh clean
```

### 4. Development Workflow

```bash
# Generate agent data pipeline
pnpm pipeline:full

# Run individual components
pnpm test:scripts    # TypeScript utilities
pnpm test:contracts  # Smart contracts  
pnpm test:web        # Web frame
pnpm test:e2e        # End-to-end flow

# Deploy to testnets (see DEPLOYMENT.md)
pnpm deploy:contracts
```

## 📁 Project Structure

```
orb-agent-mono/
├── contracts/
│   ├── solana-forge/          # Anchor program (Rust)
│   └── evm-receiver/          # Foundry project (Solidity)
├── scripts/                   # Agent generation & utilities (TypeScript)
├── web-frame/                 # Farcaster Frame (React + Vite)
├── docker/                    # Container configurations
├── .github/workflows/         # CI/CD pipeline
└── docs/                      # Documentation
```

## 🔧 Development

### Environment Setup

1. **Copy environment files**:
   ```bash
   cp .env.example .env
   cp docker/.env.example docker/.env
   ```

2. **Configure required variables**:
   - `INFURA_API_KEY`: For EVM RPC access
   - `BUNDLR_PRIVATE_KEY`: For Arweave uploads
   - `MONGODB_URI`: Database connection (optional)

3. **Start development environment**:
   ```bash
   pnpm dev
   ```

### Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start full development stack |
| `pnpm build` | Build all components |
| `pnpm test` | Run test suites |
| `pnpm lint` | Lint all code |
| `pnpm deploy:contracts` | Deploy smart contracts |
| `pnpm pipeline:full` | Generate agents end-to-end |

### VS Code Development

The project includes a `.devcontainer.json` for consistent development environments:

1. Install the "Remote - Containers" extension
2. Open project in VS Code
3. Command Palette → "Remote-Containers: Reopen in Container"

## 🧪 Testing

### Test Suites

- **Unit Tests**: Individual component testing
- **Integration Tests**: Cross-component interactions  
- **Contract Tests**: Solana (Anchor) and EVM (Foundry)
- **E2E Tests**: Complete cross-chain flow
- **Security Tests**: Automated vulnerability scanning

### Running Tests

```bash
# All tests
pnpm test:all

# Specific test types
pnpm test:scripts     # TypeScript utilities
pnpm test:solana      # Solana contracts  
pnpm test:evm         # EVM contracts
pnpm test:web         # Web interface
pnpm test:e2e         # End-to-end flow
```

### Test Coverage

The project maintains >80% test coverage across all components. Coverage reports are generated in the `coverage/` directory.

## 🔐 Security

### Security Features

- **Merkle Proof Validation**: All agent metadata cryptographically verified
- **Re-entrancy Guards**: Protection against common smart contract attacks
- **Input Validation**: Comprehensive validation of all user inputs
- **Access Controls**: Proper permission management across contracts
- **Audit Trail**: All transactions logged and traceable

### Security Auditing

```bash
# Run security audits
pnpm security:audit    # Dependency vulnerabilities
pnpm security:slither  # Solidity static analysis
```

### Responsible Disclosure

Found a security issue? Please email security@orb-agents.xyz with details.

## 🚢 Deployment

### Testnet Deployment

1. **Configure environment**:
   ```bash
   export SOLANA_RPC_URL=https://api.devnet.solana.com
   export EVM_RPC_URL=https://goerli.infura.io/v3/YOUR_KEY
   ```

2. **Fund deployer accounts**:
   ```bash
   # Solana devnet faucet
   solana airdrop 2 YOUR_PUBKEY --url devnet
   
   # EVM testnet faucet  
   # Visit appropriate faucet website
   ```

3. **Deploy contracts**:
   ```bash
   pnpm deploy:contracts
   ```

### Mainnet Deployment

⚠️ **IMPORTANT**: Never commit private keys to version control.

1. **Secure key management**:
   ```bash
   # Use hardware wallets or secure key management
   export SOLANA_DEPLOYER_KEYPAIR_PATH=/secure/path/to/keypair.json
   export EVM_DEPLOYER_PRIVATE_KEY=0x...
   ```

2. **Deploy with verification**:
   ```bash
   # Deploy and verify contracts
   pnpm deploy:contracts
   ```

## 📊 Monitoring

### Application Metrics

- Transaction success rates
- Cross-chain bridging latency  
- Gas usage optimization
- User engagement metrics

### Infrastructure Monitoring

- Container health and resource usage
- Blockchain node synchronization status
- API endpoint response times
- Error rates and alerting

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm test:all`
5. Commit using conventional commits: `git commit -m "feat: add amazing feature"`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Quality

- **TypeScript**: Strict mode enabled
- **Prettier**: Code formatting  
- **ESLint**: Linting and best practices
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Standardized commit messages

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [Smart Contract API](docs/contracts.md)
- [Agent Generation](docs/agent-generation.md)
- [Cross-Chain Flow](docs/cross-chain.md)
- [Deployment Guide](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🔗 Links

- **Website**: https://orb-agents.xyz
- **Documentation**: https://docs.orb-agents.xyz  
- **Discord**: https://discord.gg/orb-agents
- **Twitter**: https://twitter.com/orb_agents
- **GitHub**: https://github.com/orb-agents

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Wormhole](https://wormhole.com/) for cross-chain infrastructure
- [Arweave](https://arweave.org/) & [Bundlr](https://bundlr.network/) for permanent storage
- [Anchor](https://anchor-lang.com/) for Solana development framework
- [Foundry](https://getfoundry.sh/) for Ethereum development toolkit

---

**Built with ❤️ by the Orb Agents team**