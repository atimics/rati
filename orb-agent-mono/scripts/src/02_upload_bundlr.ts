#!/usr/bin/env tsx
/**
 * @fileoverview Script 2: Upload Agent metadata to Arweave via Bundlr
 * Uploads all generated JSON files and verifies successful storage
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import Bundlr from '@bundlr-network/client';
import { createHash } from 'crypto';

interface UploadResult {
  index: number;
  txId: string;
  url: string;
  size: number;
  verified: boolean;
}

interface UploadSummary {
  totalFiles: number;
  successfulUploads: number;
  failedUploads: number;
  totalSize: number;
  totalCost: string;
  uploadedAt: string;
  results: UploadResult[];
}

async function initializeBundlr(): Promise<Bundlr> {
  const privateKey = process.env.BUNDLR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BUNDLR_PRIVATE_KEY environment variable is required');
  }

  console.log('🔗 Initializing Bundlr client...');
  
  const bundlr = new Bundlr('https://node1.bundlr.network', 'arweave', privateKey);
  
  // Check balance
  const balance = await bundlr.getLoadedBalance();
  console.log(`💰 Bundlr balance: ${bundlr.utils.fromAtomic(balance)} AR`);
  
  return bundlr;
}

async function uploadFile(
  bundlr: Bundlr,
  filePath: string,
  index: number
): Promise<UploadResult> {
  const data = readFileSync(filePath);
  const size = data.length;
  
  console.log(`📤 Uploading agent ${index}... (${size} bytes)`);
  
  try {
    const response = await bundlr.upload(data, {
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Agent-Index', value: index.toString() },
        { name: 'Collection', value: 'orb-agents' },
        { name: 'Generator', value: 'orb-forge-v1' },
      ],
    });
    
    const txId = response.id;
    const url = `https://arweave.net/${txId}`;
    
    // Verify upload with HEAD request
    let verified = false;
    try {
      const verifyResponse = await fetch(url, { method: 'HEAD' });
      verified = verifyResponse.ok;
    } catch (error) {
      console.warn(`⚠️  Could not verify upload for agent ${index}: ${error}`);
    }
    
    console.log(`✅ Agent ${index} uploaded: ${txId} ${verified ? '(verified)' : '(unverified)'}`);
    
    return {
      index,
      txId,
      url,
      size,
      verified,
    };
  } catch (error) {
    console.error(`❌ Failed to upload agent ${index}:`, error);
    throw error;
  }
}

async function estimateUploadCost(bundlr: Bundlr, totalSize: number): Promise<string> {
  const price = await bundlr.getPrice(totalSize);
  return bundlr.utils.fromAtomic(price);
}

async function fundBundlrIfNeeded(bundlr: Bundlr, estimatedCost: string) {
  const balance = await bundlr.getLoadedBalance();
  const balanceAR = parseFloat(bundlr.utils.fromAtomic(balance));
  const costAR = parseFloat(estimatedCost);
  
  if (balanceAR < costAR * 1.1) { // 10% buffer
    const fundAmount = Math.ceil((costAR * 1.2 - balanceAR) * 1e12); // Convert to atomic units
    console.log(`💳 Funding Bundlr with ${bundlr.utils.fromAtomic(fundAmount)} AR...`);
    
    const fundTx = await bundlr.fund(fundAmount);
    console.log(`✅ Funded: ${fundTx.id}`);
  }
}

async function main() {
  console.log('📦 Starting Arweave upload via Bundlr...');
  
  const agentsDir = join(process.cwd(), 'generated', 'agents');
  const outputDir = join(process.cwd(), 'generated', 'uploads');
  
  // Get all JSON files (excluding summary.json)
  const files = readdirSync(agentsDir)
    .filter(file => file.endsWith('.json') && file !== 'summary.json')
    .sort((a, b) => parseInt(a) - parseInt(b));
  
  console.log(`📋 Found ${files.length} agent files to upload`);
  
  // Calculate total size for cost estimation
  const totalSize = files.reduce((sum, file) => {
    const stats = readFileSync(join(agentsDir, file));
    return sum + stats.length;
  }, 0);
  
  console.log(`📏 Total upload size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  const bundlr = await initializeBundlr();
  
  // Estimate cost and fund if needed
  const estimatedCost = await estimateUploadCost(bundlr, totalSize);
  console.log(`💰 Estimated cost: ${estimatedCost} AR`);
  
  await fundBundlrIfNeeded(bundlr, estimatedCost);
  
  // Upload files with batching to avoid rate limits
  const results: UploadResult[] = [];
  const batchSize = 10;
  let totalCost = 0;
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`);
    
    const batchPromises = batch.map(async (file) => {
      const index = parseInt(file.replace('.json', ''));
      const filePath = join(agentsDir, file);
      
      try {
        const result = await uploadFile(bundlr, filePath, index);
        return result;
      } catch (error) {
        console.error(`❌ Failed to upload ${file}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
        totalCost += result.value.size;
      }
    }
    
    // Rate limiting delay
    if (i + batchSize < files.length) {
      console.log('⏳ Waiting before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Generate upload summary
  const summary: UploadSummary = {
    totalFiles: files.length,
    successfulUploads: results.length,
    failedUploads: files.length - results.length,
    totalSize,
    totalCost: bundlr.utils.fromAtomic(totalCost),
    uploadedAt: new Date().toISOString(),
    results: results.sort((a, b) => a.index - b.index),
  };
  
  // Create outputs directory and save results
  const { mkdirSync } = await import('fs');
  mkdirSync(outputDir, { recursive: true });
  
  writeFileSync(
    join(outputDir, 'upload-summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  // Create mapping file for easy lookup
  const mapping = results.reduce((map, result) => {
    map[result.index] = result.url;
    return map;
  }, {} as Record<number, string>);
  
  writeFileSync(
    join(outputDir, 'arweave-mapping.json'),
    JSON.stringify(mapping, null, 2)
  );
  
  console.log('\n📊 Upload Summary:');
  console.log(`✅ Successful uploads: ${summary.successfulUploads}/${summary.totalFiles}`);
  console.log(`❌ Failed uploads: ${summary.failedUploads}`);
  console.log(`💰 Total cost: ${summary.totalCost} AR`);
  console.log(`📁 Results saved to: ${outputDir}`);
  
  if (summary.failedUploads > 0) {
    console.warn('\n⚠️  Some uploads failed. Check the summary file for details.');
    process.exit(1);
  }
  
  console.log('\n🎉 All agent metadata successfully uploaded to Arweave!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error uploading to Arweave:', error);
    process.exit(1);
  });
}