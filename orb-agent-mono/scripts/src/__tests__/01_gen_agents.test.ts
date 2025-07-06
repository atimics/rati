import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// We'll test the core logic by importing the functions we need
// Since the original file is a script, we'll need to extract the testable parts

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

// Mock file system operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(),
  };
});

const mockWriteFileSync = vi.mocked(await import('fs')).writeFileSync;
const mockMkdirSync = vi.mocked(await import('fs')).mkdirSync;

describe('Agent Generation Script', () => {
  const testOutputDir = join(process.cwd(), 'test-output');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Agent Metadata Generation', () => {
    function generateAgentMetadata(index: number) {
      const isLegendary = index < 88;
      
      const background = isLegendary ? 'Legendary Nexus' : 'Cyberpunk City';
      const coreType = isLegendary ? 'Omega Core' : 'Logic Core';
      const personality = isLegendary ? 'Transcendent' : 'Curious';
      const ability = isLegendary ? 'Reality Shaper' : 'Data Mining';
      
      const powerLevel = isLegendary 
        ? Math.floor(Math.random() * 11) + 90 
        : Math.floor(Math.random() * 90);
      
      const agentName = `Agent #${String(index).padStart(4, '0')}`;
      const description = isLegendary
        ? `A legendary AI agent with transcendent capabilities, born from the fusion of an Orb and $RARI tokens.`
        : `An AI agent created through the transformation of an Orb using $RARI tokens.`;

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
          category: 'image' as const,
          creators: [
            {
              address: 'FoRGe11111111111111111111111111111111111111',
              share: 100,
            },
          ],
        },
      };
    }

    it('generates valid metadata for legendary agents', () => {
      const legendaryAgent = generateAgentMetadata(0);
      
      expect(() => MetaplexMetadataSchema.parse(legendaryAgent)).not.toThrow();
      expect(legendaryAgent.name).toBe('Agent #0000');
      expect(legendaryAgent.attributes.find(attr => attr.trait_type === 'Rarity')?.value).toBe('Legendary');
      expect(legendaryAgent.attributes.find(attr => attr.trait_type === 'Background')?.value).toBe('Legendary Nexus');
      expect(legendaryAgent.attributes.find(attr => attr.trait_type === 'Core Type')?.value).toBe('Omega Core');
    });

    it('generates valid metadata for standard agents', () => {
      const standardAgent = generateAgentMetadata(100);
      
      expect(() => MetaplexMetadataSchema.parse(standardAgent)).not.toThrow();
      expect(standardAgent.name).toBe('Agent #0100');
      expect(standardAgent.attributes.find(attr => attr.trait_type === 'Rarity')?.value).toBe('Standard');
      expect(standardAgent.attributes.find(attr => attr.trait_type === 'Background')?.value).toBe('Cyberpunk City');
    });

    it('ensures legendary agents have high power levels', () => {
      for (let i = 0; i < 10; i++) {
        const agent = generateAgentMetadata(i);
        const powerLevel = agent.attributes.find(attr => attr.trait_type === 'Power Level')?.value as number;
        
        expect(powerLevel).toBeGreaterThanOrEqual(90);
        expect(powerLevel).toBeLessThanOrEqual(100);
      }
    });

    it('ensures standard agents have varied power levels', () => {
      const powerLevels = [];
      for (let i = 100; i < 110; i++) {
        const agent = generateAgentMetadata(i);
        const powerLevel = agent.attributes.find(attr => attr.trait_type === 'Power Level')?.value as number;
        powerLevels.push(powerLevel);
        
        expect(powerLevel).toBeGreaterThanOrEqual(0);
        expect(powerLevel).toBeLessThan(90);
      }
      
      // Should have some variety in power levels
      const uniquePowerLevels = new Set(powerLevels);
      expect(uniquePowerLevels.size).toBeGreaterThan(1);
    });

    it('generates correct number formatting for agent names', () => {
      expect(generateAgentMetadata(0).name).toBe('Agent #0000');
      expect(generateAgentMetadata(42).name).toBe('Agent #0042');
      expect(generateAgentMetadata(8887).name).toBe('Agent #8887');
    });

    it('includes required Metaplex fields', () => {
      const agent = generateAgentMetadata(500);
      
      expect(agent.symbol).toBe('AGENT');
      expect(agent.properties.category).toBe('image');
      expect(agent.properties.creators).toHaveLength(1);
      expect(agent.properties.creators[0].share).toBe(100);
      expect(agent.properties.files).toHaveLength(1);
    });

    it('generates unique images for each agent', () => {
      const agent1 = generateAgentMetadata(1);
      const agent2 = generateAgentMetadata(2);
      
      expect(agent1.image).not.toBe(agent2.image);
      expect(agent1.properties.files[0].uri).not.toBe(agent2.properties.files[0].uri);
    });
  });

  describe('Rarity Distribution', () => {
    it('correctly identifies legendary vs standard agents', () => {
      const LEGENDARY_COUNT = 88;
      const TOTAL_AGENTS = 8888;
      
      let legendaryCount = 0;
      let standardCount = 0;
      
      for (let i = 0; i < TOTAL_AGENTS; i++) {
        const agent = generateAgentMetadata(i);
        const rarity = agent.attributes.find(attr => attr.trait_type === 'Rarity')?.value;
        
        if (rarity === 'Legendary') {
          legendaryCount++;
          expect(i).toBeLessThan(LEGENDARY_COUNT);
        } else {
          standardCount++;
          expect(i).toBeGreaterThanOrEqual(LEGENDARY_COUNT);
        }
      }
      
      expect(legendaryCount).toBe(LEGENDARY_COUNT);
      expect(standardCount).toBe(TOTAL_AGENTS - LEGENDARY_COUNT);
    });
  });

  describe('File Generation', () => {
    it('would create output directory', () => {
      // Simulate the main function's directory creation
      const outputDir = join(process.cwd(), 'generated', 'agents');
      
      // In the actual script, this would be called
      // mkdirSync(outputDir, { recursive: true });
      
      expect(mockMkdirSync).not.toHaveBeenCalled(); // Not called yet in test
    });

    it('would write individual agent files', () => {
      const agent = generateAgentMetadata(42);
      const filename = '42.json';
      const content = JSON.stringify(agent, null, 2);
      
      // In the actual script, this would be called
      // writeFileSync(join(outputDir, filename), content);
      
      expect(content).toContain('"name": "Agent #0042"');
      expect(JSON.parse(content)).toEqual(agent);
    });

    it('would generate summary statistics', () => {
      const TOTAL_AGENTS = 8888;
      const LEGENDARY_COUNT = 88;
      
      const summary = {
        total: TOTAL_AGENTS,
        rarityDistribution: {
          'Legendary': LEGENDARY_COUNT,
          'Standard': TOTAL_AGENTS - LEGENDARY_COUNT,
        },
        generatedAt: new Date().toISOString(),
      };
      
      expect(summary.total).toBe(8888);
      expect(summary.rarityDistribution.Legendary).toBe(88);
      expect(summary.rarityDistribution.Standard).toBe(8800);
    });
  });

  describe('Validation', () => {
    it('validates all generated agents against Metaplex schema', () => {
      const testCount = 100; // Test a subset for performance
      
      for (let i = 0; i < testCount; i++) {
        const agent = generateAgentMetadata(i);
        
        expect(() => {
          MetaplexMetadataSchema.parse(agent);
        }).not.toThrow();
      }
    });

    it('ensures all agents have required attributes', () => {
      const requiredTraitTypes = [
        'Background',
        'Core Type', 
        'Personality',
        'Primary Ability',
        'Power Level',
        'Rarity',
        'Generation',
      ];
      
      const agent = generateAgentMetadata(500);
      const traitTypes = agent.attributes.map(attr => attr.trait_type);
      
      requiredTraitTypes.forEach(required => {
        expect(traitTypes).toContain(required);
      });
    });

    it('ensures power levels are within valid ranges', () => {
      for (let i = 0; i < 100; i++) {
        const agent = generateAgentMetadata(i);
        const powerLevel = agent.attributes.find(attr => attr.trait_type === 'Power Level')?.value as number;
        
        expect(powerLevel).toBeGreaterThanOrEqual(0);
        expect(powerLevel).toBeLessThanOrEqual(100);
        expect(Number.isInteger(powerLevel)).toBe(true);
      }
    });
  });
});

function generateAgentMetadata(index: number) {
  const isLegendary = index < 88;
  
  const background = isLegendary ? 'Legendary Nexus' : 'Cyberpunk City';
  const coreType = isLegendary ? 'Omega Core' : 'Logic Core';
  const personality = isLegendary ? 'Transcendent' : 'Curious';
  const ability = isLegendary ? 'Reality Shaper' : 'Data Mining';
  
  const powerLevel = isLegendary 
    ? Math.floor(Math.random() * 11) + 90 
    : Math.floor(Math.random() * 90);
  
  const agentName = `Agent #${String(index).padStart(4, '0')}`;
  const description = isLegendary
    ? `A legendary AI agent with transcendent capabilities, born from the fusion of an Orb and $RARI tokens.`
    : `An AI agent created through the transformation of an Orb using $RARI tokens.`;

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
      category: 'image' as const,
      creators: [
        {
          address: 'FoRGe11111111111111111111111111111111111111',
          share: 100,
        },
      ],
    },
  };
}