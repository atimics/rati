# Deployment Guide

## Quick Start

```bash
# Start the complete development environment
./start.sh

# Stop services
./start.sh stop

# View status
./start.sh status
```

## Production Deployment

### Prerequisites

1. **Environment Setup**:
   ```bash
   # Copy and configure environment files
   cp .env.example .env
   cp docker/.env.example docker/.env
   
   # Update with production values:
   # - INFURA_API_KEY
   # - BUNDLR_PRIVATE_KEY
   # - MONGODB_URI
   # - Deployment private keys
   ```

2. **MongoDB Database**:
   - Set up MongoDB Atlas or self-hosted instance
   - Update `MONGODB_URI` in `.env`
   - Database and collections are created automatically

### Testnet Deployment

1. **Deploy to Solana Devnet**:
   ```bash
   # Update RPC URLs for devnet
   export SOLANA_RPC_URL=https://api.devnet.solana.com
   
   # Deploy contracts
   cd contracts/solana-forge
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. **Deploy to Base Goerli**:
   ```bash
   # Update RPC URLs for testnet
   export EVM_RPC_URL=https://goerli.base.org
   
   # Deploy contracts
   cd contracts/evm-receiver
   forge script script/Deploy.s.sol --rpc-url $EVM_RPC_URL --broadcast --verify
   ```

3. **Generate and Upload Agent Data**:
   ```bash
   # Generate all 8,888 agents
   pnpm gen:agents
   
   # Upload to Arweave (requires BUNDLR_PRIVATE_KEY)
   pnpm upload:bundlr
   
   # Generate Merkle tree
   pnpm publish:csv
   ```

### Mainnet Deployment

⚠️ **SECURITY CRITICAL**: Never commit private keys to version control.

1. **Secure Key Management**:
   ```bash
   # Use hardware wallets or secure key management
   export SOLANA_DEPLOYER_KEYPAIR_PATH=/secure/path/to/keypair.json
   export EVM_DEPLOYER_PRIVATE_KEY=0x...
   ```

2. **Deploy Solana Contracts**:
   ```bash
   export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   
   cd contracts/solana-forge
   anchor build
   anchor deploy --provider.cluster mainnet-beta
   ```

3. **Deploy EVM Contracts**:
   ```bash
   export EVM_RPC_URL=https://mainnet.base.org
   
   cd contracts/evm-receiver
   forge script script/Deploy.s.sol --rpc-url $EVM_RPC_URL --broadcast --verify
   ```

4. **Update Contract Addresses**:
   - Update `.env` with deployed contract addresses
   - Update frontend configuration files
   - Deploy updated web frame to Arweave

### Web Frame Deployment

1. **Build for Production**:
   ```bash
   cd web-frame
   pnpm build
   ```

2. **Deploy to Arweave**:
   ```bash
   # Upload built frame to Arweave
   bundlr upload-dir dist/ --content-type text/html
   
   # Note the returned transaction ID
   FRAME_TX=your_transaction_id_here
   ```

3. **Configure Farcaster Frame**:
   ```json
   {
     "image": "https://arweave.net/FRAME_TX/splash.png",
     "buttons": [
       {
         "label": "Mint on Solana",
         "action": "https://arweave.net/FRAME_TX/?chain=sol"
       },
       {
         "label": "Mint on Base",
         "action": "https://arweave.net/FRAME_TX/?chain=base"
       }
     ]
   }
   ```

## Monitoring

### Health Checks

The system includes built-in health checks:

```bash
# Check service health
curl http://localhost:8899/health          # Solana
curl http://localhost:8545                 # EVM
curl http://localhost:7071/v1/heartbeats   # Wormhole
```

### Logging

Logs are structured and sent to:
- Console (development)
- File system (production)
- External logging service (configurable)

### Metrics

Key metrics to monitor:
- Transaction success rates
- Cross-chain bridging latency
- Gas usage optimization
- User engagement
- Error rates

## Troubleshooting

### Common Issues

1. **Docker Services Not Starting**:
   ```bash
   # Check Docker status
   docker info
   
   # Restart Docker
   sudo systemctl restart docker
   
   # Clean up containers
   ./start.sh clean
   ```

2. **Contract Deployment Failures**:
   ```bash
   # Check RPC connectivity
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"getVersion","id":1}' \
     $SOLANA_RPC_URL
   
   # Verify account balances
   solana balance --url $SOLANA_RPC_URL
   cast balance $DEPLOYER_ADDRESS --rpc-url $EVM_RPC_URL
   ```

3. **Wormhole Integration Issues**:
   ```bash
   # Check guardian network status (mock service in development)
   curl http://localhost:7071/v1/heartbeats
   
   # Note: Development uses a mock Wormhole service
   # For production, configure actual Wormhole guardian endpoints
   ```

4. **Frontend Build Issues**:
   ```bash
   # Clear node modules
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   
   # Check environment variables
   env | grep VITE_
   ```

### Performance Optimization

1. **Solana Program Optimization**:
   - Keep compute units under 200k
   - Optimize account access patterns
   - Use appropriate data types

2. **EVM Contract Optimization**:
   - Minimize storage writes
   - Use events for data logging
   - Optimize gas usage

3. **Frontend Optimization**:
   - Code splitting
   - Lazy loading
   - Caching strategies

## Security Considerations

### Smart Contract Security

1. **Solana Programs**:
   - Validate all account inputs
   - Use proper access controls
   - Implement re-entrancy protection
   - Regular security audits

2. **EVM Contracts**:
   - Use OpenZeppelin libraries
   - Implement proper access controls
   - Validate Merkle proofs
   - Prevent re-entrancy attacks

### Infrastructure Security

1. **Environment Variables**:
   - Never commit secrets to git
   - Use secure key management
   - Rotate keys regularly

2. **API Security**:
   - Rate limiting
   - Input validation
   - CORS configuration
   - HTTPS only

3. **Database Security**:
   - Use connection strings with authentication
   - Implement proper indexing
   - Regular backups
   - Monitor for anomalies

## Maintenance

### Regular Tasks

1. **Update Dependencies**:
   ```bash
   pnpm update
   cargo update
   forge update
   ```

2. **Security Audits**:
   ```bash
   pnpm security:audit
   cargo audit
   slither contracts/
   ```

3. **Performance Monitoring**:
   - Monitor gas usage
   - Track transaction success rates
   - Analyze user behavior

4. **Backup Procedures**:
   - Database backups
   - Contract verification
   - Arweave data integrity

### Incident Response

1. **Emergency Procedures**:
   - Contract pause mechanisms
   - Service degradation handling
   - Communication protocols

2. **Recovery Procedures**:
   - Database restoration
   - Service restart procedures
   - Data integrity verification

## Support

For deployment support:
- Check GitHub Issues: https://github.com/orb-agents/orb-agent-mono/issues
- Discord: https://discord.gg/orb-agents
- Documentation: https://docs.orb-agents.xyz