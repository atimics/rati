#!/usr/bin/env tsx
/**
 * @fileoverview Script 3: Generate Merkle tree and publish CSV
 * Creates Merkle tree of (orbIndex, uri) pairs and outputs root for smart contracts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'js-sha3';

interface ArweaveMapping {
  [index: string]: string;
}

interface MerkleData {
  index: number;
  uri: string;
  leaf: string;
}

interface MerkleTreeOutput {
  root: string;
  totalLeaves: number;
  generatedAt: string;
  leaves: MerkleData[];
  proofs: Record<number, string[]>;
}

function generateLeaf(index: number, uri: string): string {
  // Create leaf hash as keccak256(abi.encodePacked(index, uri))
  // This matches the Solidity contract implementation
  const indexBytes = Buffer.alloc(32);
  indexBytes.writeUInt32BE(index, 28); // Store as uint256 (32 bytes, big endian)
  
  const uriBytes = Buffer.from(uri, 'utf8');
  const combined = Buffer.concat([indexBytes, uriBytes]);
  
  return '0x' + keccak256(combined);
}

function createMerkleTree(data: MerkleData[]): MerkleTree {
  const leaves = data.map(item => item.leaf);
  
  // Use keccak256 for hashing (matches Solidity)
  const tree = new MerkleTree(leaves, (data) => {
    return Buffer.from(keccak256(data), 'hex');
  }, { 
    sortPairs: true,
    hashLeaves: false, // We've already hashed the leaves
  });
  
  return tree;
}

function generateCSV(data: MerkleData[]): string {
  const header = 'index,uri,leaf_hash\n';
  const rows = data
    .map(item => `${item.index},"${item.uri}",${item.leaf}`)
    .join('\n');
  
  return header + rows;
}

async function main() {
  console.log('🌳 Generating Merkle tree from Arweave mappings...');
  
  const uploadDir = join(process.cwd(), 'generated', 'uploads');
  const outputDir = join(process.cwd(), 'generated', 'merkle');
  
  // Read Arweave mapping
  const mappingPath = join(uploadDir, 'arweave-mapping.json');
  if (!require('fs').existsSync(mappingPath)) {
    throw new Error('Arweave mapping not found. Run upload script first.');
  }
  
  const mapping: ArweaveMapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
  const indices = Object.keys(mapping).map(Number).sort((a, b) => a - b);
  
  console.log(`📋 Processing ${indices.length} agent entries...`);
  
  // Generate leaf data
  const merkleData: MerkleData[] = indices.map(index => {
    const uri = mapping[index];
    const leaf = generateLeaf(index, uri);
    
    return { index, uri, leaf };
  });
  
  console.log('🔧 Building Merkle tree...');
  const tree = createMerkleTree(merkleData);
  const root = tree.getHexRoot();
  
  console.log(`🌳 Merkle root: ${root}`);
  
  // Generate proofs for all leaves
  console.log('🔐 Generating Merkle proofs...');
  const proofs: Record<number, string[]> = {};
  
  for (const data of merkleData) {
    const proof = tree.getHexProof(data.leaf);
    proofs[data.index] = proof;
  }
  
  // Verify all proofs
  console.log('✅ Verifying proofs...');
  let verificationErrors = 0;
  
  for (const data of merkleData) {
    const proof = proofs[data.index];
    const isValid = tree.verify(proof, data.leaf, root);
    
    if (!isValid) {
      console.error(`❌ Invalid proof for index ${data.index}`);
      verificationErrors++;
    }
  }
  
  if (verificationErrors > 0) {
    throw new Error(`${verificationErrors} proof verification errors found`);
  }
  
  console.log('✅ All proofs verified successfully');
  
  // Create output directory
  const { mkdirSync } = await import('fs');
  mkdirSync(outputDir, { recursive: true });
  
  // Generate outputs
  const treeOutput: MerkleTreeOutput = {
    root,
    totalLeaves: merkleData.length,
    generatedAt: new Date().toISOString(),
    leaves: merkleData,
    proofs,
  };
  
  // Save complete tree data
  writeFileSync(
    join(outputDir, 'merkle-tree.json'),
    JSON.stringify(treeOutput, null, 2)
  );
  
  // Save just the root for smart contract deployment
  const rootData = {
    root,
    totalAgents: merkleData.length,
    generatedAt: new Date().toISOString(),
  };
  
  writeFileSync(
    join(outputDir, 'root.json'),
    JSON.stringify(rootData, null, 2)
  );
  
  // Generate CSV for external verification
  const csvContent = generateCSV(merkleData);
  writeFileSync(join(outputDir, 'agents.csv'), csvContent);
  
  // Generate Solidity constant file for easy integration
  const solidityConstants = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentConstants
 * @notice Constants for Agent NFT deployment
 * @dev Generated on ${new Date().toISOString()}
 */
library AgentConstants {
    /// @notice Merkle root of all valid (orbIndex, uri) pairs
    bytes32 public constant MERKLE_ROOT = ${root};
    
    /// @notice Total number of possible agents
    uint256 public constant TOTAL_AGENTS = ${merkleData.length};
}
`;
  
  writeFileSync(join(outputDir, 'AgentConstants.sol'), solidityConstants);
  
  // Generate TypeScript constants file
  const tsConstants = `/**
 * Agent NFT Constants
 * Generated on ${new Date().toISOString()}
 */

export const MERKLE_ROOT = '${root}';
export const TOTAL_AGENTS = ${merkleData.length};

export interface AgentData {
  index: number;
  uri: string;
  proof: string[];
}

// Sample function to get agent data by index
export function getAgentData(index: number): AgentData | null {
  const proofs = ${JSON.stringify(proofs, null, 2)};
  const uris = ${JSON.stringify(mapping, null, 2)};
  
  if (!proofs[index] || !uris[index]) {
    return null;
  }
  
  return {
    index,
    uri: uris[index],
    proof: proofs[index],
  };
}
`;
  
  writeFileSync(join(outputDir, 'constants.ts'), tsConstants);
  
  console.log('\n📊 Merkle Tree Summary:');
  console.log(`🌳 Root: ${root}`);
  console.log(`📋 Total leaves: ${merkleData.length}`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log('\n📄 Generated files:');
  console.log('  - merkle-tree.json (complete tree data)');
  console.log('  - root.json (just root and metadata)');
  console.log('  - agents.csv (CSV export)');
  console.log('  - AgentConstants.sol (Solidity constants)');
  console.log('  - constants.ts (TypeScript constants)');
  
  console.log('\n🎉 Merkle tree generation complete!');
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Update AgentReceiver deployment script with root: ${root}`);
  console.log(`  2. Deploy AgentReceiver contract with this root`);
  console.log(`  3. Use the generated proofs for minting validation`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error generating Merkle tree:', error);
    process.exit(1);
  });
}