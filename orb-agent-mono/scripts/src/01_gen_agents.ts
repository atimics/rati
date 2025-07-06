#!/usr/bin/env tsx
/**
 * @fileoverview Script 1: Generate Agent JSON metadata files
 * Creates 8,888 agent JSON files conforming to Metaplex standard
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// Metaplex NFT metadata schema validation
const MetaplexMetadataSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  description: z.string(),
  image: z.string().url(),
  external_url: z.string().url().optional(),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.union([z.string(), z.number()]),
  })),
  properties: z.object({
    files: z.array(z.object({
      uri: z.string().url(),
      type: z.string(),
    })),
    category: z.literal('image'),
    creators: z.array(z.object({
      address: z.string(),
      share: z.number().int().min(0).max(100),
    })),
  }),
});

type MetaplexMetadata = z.infer<typeof MetaplexMetadataSchema>;

// Agent trait rarities and distributions
const TRAITS = {
  background: [
    { name: 'Cyberpunk City', weight: 20 },
    { name: 'Neural Network', weight: 15 },
    { name: 'Quantum Field', weight: 12 },
    { name: 'Digital Void', weight: 10 },
    { name: 'Matrix Grid', weight: 8 },
    { name: 'Holographic', weight: 5 },
  ],
  core_type: [
    { name: 'Logic Core', weight: 25 },
    { name: 'Emotion Core', weight: 20 },
    { name: 'Creative Core', weight: 15 },
    { name: 'Analytical Core', weight: 12 },
    { name: 'Quantum Core', weight: 3 },
  ],
  personality: [
    { name: 'Curious', weight: 18 },
    { name: 'Analytical', weight: 16 },
    { name: 'Empathetic', weight: 14 },
    { name: 'Innovative', weight: 12 },
    { name: 'Stoic', weight: 10 },
    { name: 'Chaotic', weight: 8 },
    { name: 'Zen', weight: 2 },
  ],
  ability: [
    { name: 'Data Mining', weight: 20 },
    { name: 'Pattern Recognition', weight: 18 },
    { name: 'Language Processing', weight: 16 },
    { name: 'Prediction', weight: 14 },
    { name: 'Cross-Chain Bridge', weight: 8 },
    { name: 'Quantum Entanglement', weight: 2 },
  ],
};

// Legendary agents with specific traits (1% of total)
const LEGENDARY_AGENTS = 88; // 1% of 8,888

function weightedRandom<T extends { name: string; weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  
  return items[items.length - 1];
}

function generateAgentMetadata(index: number): MetaplexMetadata {
  const isLegendary = index < LEGENDARY_AGENTS;
  
  // Generate traits based on rarity
  const background = isLegendary ? 'Legendary Nexus' : weightedRandom(TRAITS.background).name;
  const coreType = isLegendary ? 'Omega Core' : weightedRandom(TRAITS.core_type).name;
  const personality = isLegendary ? 'Transcendent' : weightedRandom(TRAITS.personality).name;
  const ability = isLegendary ? 'Reality Shaper' : weightedRandom(TRAITS.ability).name;
  
  // Power level (0-100, legendaries get 90-100)
  const powerLevel = isLegendary 
    ? Math.floor(Math.random() * 11) + 90 
    : Math.floor(Math.random() * 90);
  
  const agentName = `Agent #${String(index).padStart(4, '0')}`;
  const description = isLegendary
    ? `A legendary AI agent with transcendent capabilities, born from the fusion of an Orb and $RARI tokens. This agent possesses reality-shaping abilities and operates beyond conventional digital boundaries.`
    : `An AI agent created through the transformation of an Orb using $RARI tokens. This agent specializes in ${ability.toLowerCase()} and exhibits a ${personality.toLowerCase()} personality within the digital realm.`;

  return {
    name: agentName,
    symbol: 'AGENT',
    description,
    image: `ar://[PLACEHOLDER_IMAGE_${index}]`,
    external_url: 'https://orb-agents.xyz',
    attributes: [
      { trait_type: 'Background', value: background },
      { trait_type: 'Core Type', value: coreType },
      { trait_type: 'Personality', value: personality },
      { trait_type: 'Primary Ability', value: ability },
      { trait_type: 'Power Level', value: powerLevel },
      { trait_type: 'Rarity', value: isLegendary ? 'Legendary' : 'Standard' },
      { trait_type: 'Generation', value: 'Genesis' },
    ],
    properties: {
      files: [
        {
          uri: `ar://[PLACEHOLDER_IMAGE_${index}]`,
          type: 'image/png',
        },
      ],
      category: 'image',
      creators: [
        {
          address: 'FoRGe11111111111111111111111111111111111111', // OrbForge program
          share: 100,
        },
      ],
    },
  };
}

async function main() {
  console.log('🤖 Generating Agent metadata files...');
  
  const outputDir = join(process.cwd(), 'generated', 'agents');
  mkdirSync(outputDir, { recursive: true });
  
  const agents: MetaplexMetadata[] = [];
  
  for (let i = 0; i < 8888; i++) {
    const metadata = generateAgentMetadata(i);
    
    // Validate against Metaplex schema
    try {
      MetaplexMetadataSchema.parse(metadata);
    } catch (error) {
      console.error(`❌ Validation failed for agent ${i}:`, error);
      process.exit(1);
    }
    
    agents.push(metadata);
    
    // Write individual JSON file
    const filename = `${i}.json`;
    writeFileSync(
      join(outputDir, filename),
      JSON.stringify(metadata, null, 2)
    );
    
    if (i % 1000 === 0) {
      console.log(`✅ Generated ${i + 1}/8888 agents...`);
    }
  }
  
  // Generate summary statistics
  const rarityStats = agents.reduce((stats, agent) => {
    const rarity = agent.attributes.find(attr => attr.trait_type === 'Rarity')?.value as string;
    stats[rarity] = (stats[rarity] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);
  
  console.log('\n📊 Generation Summary:');
  console.log(`Total Agents: ${agents.length}`);
  console.log('Rarity Distribution:', rarityStats);
  
  // Write summary file
  const summary = {
    total: agents.length,
    rarityDistribution: rarityStats,
    generatedAt: new Date().toISOString(),
    traits: TRAITS,
  };
  
  writeFileSync(
    join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log(`\n🎉 Successfully generated ${agents.length} agent metadata files!`);
  console.log(`📁 Output directory: ${outputDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error generating agents:', error);
    process.exit(1);
  });
}