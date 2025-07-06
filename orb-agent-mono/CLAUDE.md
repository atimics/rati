# CLAUDE.md - Development Guidelines for Orb Agent Mono

## Project Overview

This project implements a cross-chain Agent NFT system that transforms Orbs into AI Agents across multiple blockchains using Wormhole for bridging.

## Architecture

- **Solana (Source Chain)**: OrbForge program that validates Orb ownership and burns $RATi tokens
- **EVM Chains (Target)**: AgentReceiver contract that mints Agent NFTs based on Wormhole messages
- **Bridge**: Wormhole for secure cross-chain messaging
- **Storage**: Arweave for decentralized metadata storage via Bundlr
- **Frontend**: Farcaster Frame (React + Vite) for user interaction

## Development Standards

### Code Quality
- **Type Safety**: Use TypeScript with strict mode enabled
- **Testing**: Minimum 80% code coverage across all components
- **Security**: All contracts must pass slither/cargo audit before deployment
- **Documentation**: Inline comments for complex logic, JSDoc for public APIs

### Container-First Development
- All development happens inside Docker containers
- Use `docker compose` for local development
- Pin all image versions with specific digests
- Never rely on external services during development/testing

### Smart Contract Guidelines

#### Solana (Rust/Anchor)
- Use Anchor 0.30.x framework
- Implement proper error handling with custom error types
- All CPIs must validate program IDs
- Use PDAs for deterministic account addresses
- Implement re-entrancy guards where applicable

#### EVM (Solidity)
- Use Foundry for development and testing
- Follow OpenZeppelin standards for ERC-721
- Implement comprehensive natspec documentation
- Use immutable variables for gas optimization
- Include re-entrancy guards on all state-changing functions

### Testing Strategy
1. **Unit Tests**: Individual contract functions
2. **Integration Tests**: Cross-contract interactions
3. **E2E Tests**: Full flow from Solana → Wormhole → EVM
4. **Performance Tests**: Gas optimization verification

### Security Checklist
- [ ] No hardcoded private keys in code
- [ ] All user inputs validated
- [ ] Overflow/underflow protection
- [ ] Re-entrancy guards implemented
- [ ] Access control properly configured
- [ ] Merkle proofs verified correctly
- [ ] Wormhole signatures validated

### Git Workflow
- Feature branches from `main`
- Commit messages: `type(scope): description`
- Types: feat, fix, docs, test, refactor, chore
- All commits must pass CI checks
- PRs require passing tests and security audits

### Key Commands
```bash
# Development
docker compose -f docker/compose.dev.yml up
docker compose -f docker/compose.dev.yml run --rm node bash

# Testing
pnpm test:all           # Run all test suites
anchor test            # Solana tests
forge test -vvv        # EVM tests
./scripts/e2e.sh       # End-to-end tests

# Deployment
anchor build && anchor deploy
forge script DeployReceiver --broadcast --rpc-url <RPC_URL>
```

### Environment Variables
- `INFURA`: Infura API key for EVM fork
- `BUNDLR_PRIVATE_KEY`: Key for Arweave uploads
- `SOLANA_KEYPAIR`: Deployer keypair
- `MONGODB_URI`: MongoDB connection string (when provided)

### MongoDB Integration
When MongoDB URI is provided:
- Store agent metadata for efficient querying
- Track minting history and cross-chain transactions
- Implement proper indexing for performance
- Use transactions for atomic operations

### Performance Targets
- Solana program: < 200k compute units per instruction
- EVM contract: < 300k gas for minting
- API responses: < 200ms p95
- Frame load time: < 3s on 3G

### Monitoring & Observability
- Structured logging with correlation IDs
- Prometheus metrics for key operations
- Health checks for all services
- Error tracking with proper context

## Common Pitfalls to Avoid
1. Don't use floating versions in package.json
2. Always validate Merkle proofs before minting
3. Never trust client-side data without verification
4. Ensure idempotency for all operations
5. Handle Wormhole finality correctly (15 confirmations)

## Resources
- [Anchor Book](https://book.anchor-lang.com/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Wormhole Docs](https://docs.wormhole.com/)
- [Metaplex Standards](https://docs.metaplex.com/)