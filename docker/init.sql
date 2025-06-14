-- Initialize the RATi database schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for tracking deployments
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_type VARCHAR(50) NOT NULL,
    txid VARCHAR(255),
    process_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Table for tracking oracle status
CREATE TABLE IF NOT EXISTS oracle_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    oracle_address VARCHAR(255) NOT NULL,
    last_heartbeat TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for proposal tracking
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id VARCHAR(255) NOT NULL UNIQUE,
    content TEXT,
    proposer_address VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deployments_type ON deployments(deployment_type);
CREATE INDEX IF NOT EXISTS idx_oracle_status_address ON oracle_status(oracle_address);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
