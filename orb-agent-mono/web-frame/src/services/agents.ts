import type { AgentData } from '../types';
import { config } from '../config';

// Mock agent data for development - in production this would come from generated files
const MOCK_AGENTS: Record<number, AgentData> = {};

// Initialize mock data
for (let i = 0; i < 100; i++) {
  const isLegendary = i < 10;
  MOCK_AGENTS[i] = {
    index: i,
    name: `Agent #${String(i).padStart(4, '0')}`,
    description: isLegendary
      ? `A legendary AI agent with transcendent capabilities, born from the fusion of an Orb and $RARI tokens.`
      : `An AI agent created through the transformation of an Orb using $RARI tokens.`,
    image: `${config.arweave.gateway}/mock-agent-${i}.png`,
    uri: `${config.arweave.gateway}/mock-agent-${i}.json`,
    attributes: [
      { trait_type: 'Background', value: isLegendary ? 'Legendary Nexus' : 'Cyberpunk City' },
      { trait_type: 'Core Type', value: isLegendary ? 'Omega Core' : 'Logic Core' },
      { trait_type: 'Personality', value: isLegendary ? 'Transcendent' : 'Curious' },
      { trait_type: 'Primary Ability', value: isLegendary ? 'Reality Shaper' : 'Data Mining' },
      { trait_type: 'Power Level', value: isLegendary ? 95 : Math.floor(Math.random() * 80) + 10 },
      { trait_type: 'Rarity', value: isLegendary ? 'Legendary' : 'Standard' },
      { trait_type: 'Generation', value: 'Genesis' },
    ],
    rarity: isLegendary ? 'Legendary' : 'Standard',
    proof: generateMockProof(i),
  };
}

function generateMockProof(index: number): string[] {
  // Generate mock Merkle proof for testing
  const proof = [];
  const depth = Math.ceil(Math.log2(8888)); // Tree depth for 8888 agents
  
  for (let i = 0; i < depth; i++) {
    proof.push(`0x${Math.random().toString(16).substr(2, 64)}`);
  }
  
  return proof;
}

export async function getAgentData(index: number): Promise<AgentData | null> {
  try {
    // In production, this would fetch from generated files or API
    if (process.env.NODE_ENV === 'development') {
      return MOCK_AGENTS[index] || null;
    }
    
    // Try to load from generated files
    const response = await fetch(`/generated/agents/${index}.json`);
    if (!response.ok) {
      return null;
    }
    
    const metadata = await response.json();
    
    // Convert Metaplex metadata to AgentData
    return {
      index,
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      uri: metadata.external_url || `${config.arweave.gateway}/${index}.json`,
      attributes: metadata.attributes,
      rarity: metadata.attributes.find((attr: any) => attr.trait_type === 'Rarity')?.value || 'Standard',
      proof: await getAgentProof(index),
    };
  } catch (error) {
    console.error('Error fetching agent data:', error);
    return null;
  }
}

export async function getAgentProof(index: number): Promise<string[]> {
  try {
    // In production, this would fetch from generated Merkle tree file
    if (process.env.NODE_ENV === 'development') {
      return generateMockProof(index);
    }
    
    const response = await fetch('/generated/merkle/merkle-tree.json');
    if (!response.ok) {
      throw new Error('Failed to fetch Merkle tree');
    }
    
    const merkleData = await response.json();
    return merkleData.proofs[index] || [];
  } catch (error) {
    console.error('Error fetching agent proof:', error);
    return [];
  }
}

export async function getAgentsByRarity(rarity: 'Standard' | 'Legendary'): Promise<AgentData[]> {
  try {
    const agents = [];
    
    if (process.env.NODE_ENV === 'development') {
      // Return mock data filtered by rarity
      for (const agent of Object.values(MOCK_AGENTS)) {
        if (agent.rarity === rarity) {
          agents.push(agent);
        }
      }
      return agents;
    }
    
    // In production, this would be optimized with proper indexing
    for (let i = 0; i < 8888; i++) {
      const agent = await getAgentData(i);
      if (agent && agent.rarity === rarity) {
        agents.push(agent);
      }
    }
    
    return agents;
  } catch (error) {
    console.error('Error fetching agents by rarity:', error);
    return [];
  }
}

export async function searchAgents(query: string): Promise<AgentData[]> {
  try {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    if (process.env.NODE_ENV === 'development') {
      // Search mock data
      for (const agent of Object.values(MOCK_AGENTS)) {
        if (
          agent.name.toLowerCase().includes(lowerQuery) ||
          agent.description.toLowerCase().includes(lowerQuery) ||
          agent.attributes.some(attr => 
            attr.trait_type.toLowerCase().includes(lowerQuery) ||
            String(attr.value).toLowerCase().includes(lowerQuery)
          )
        ) {
          results.push(agent);
        }
      }
      return results;
    }
    
    // In production, this would use a proper search index
    // For now, we'll do a simple scan (not recommended for large datasets)
    for (let i = 0; i < Math.min(1000, 8888); i++) {
      const agent = await getAgentData(i);
      if (agent) {
        if (
          agent.name.toLowerCase().includes(lowerQuery) ||
          agent.description.toLowerCase().includes(lowerQuery)
        ) {
          results.push(agent);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error searching agents:', error);
    return [];
  }
}

export async function getRandomAgents(count: number = 10): Promise<AgentData[]> {
  try {
    const agents = [];
    const indices = new Set<number>();
    
    // Generate random unique indices
    while (indices.size < count && indices.size < 8888) {
      const randomIndex = Math.floor(Math.random() * 8888);
      indices.add(randomIndex);
    }
    
    // Fetch agent data for each index
    for (const index of indices) {
      const agent = await getAgentData(index);
      if (agent) {
        agents.push(agent);
      }
    }
    
    return agents;
  } catch (error) {
    console.error('Error fetching random agents:', error);
    return [];
  }
}

export async function getAgentStats() {
  try {
    if (process.env.NODE_ENV === 'development') {
      // Return mock stats
      return {
        total: 8888,
        minted: 1247,
        legendary: 88,
        standard: 8800,
        rarityDistribution: {
          'Legendary': 88,
          'Standard': 8800,
        },
        attributeDistribution: {
          'Background': {
            'Cyberpunk City': 1778,
            'Neural Network': 1333,
            'Quantum Field': 1067,
            'Digital Void': 889,
            'Matrix Grid': 711,
            'Holographic': 444,
            'Legendary Nexus': 88,
          },
          'Core Type': {
            'Logic Core': 2222,
            'Emotion Core': 1778,
            'Creative Core': 1333,
            'Analytical Core': 1067,
            'Quantum Core': 267,
            'Omega Core': 88,
          },
        },
      };
    }
    
    // In production, this would query a database or analytics service
    // For now, return basic stats
    return {
      total: 8888,
      minted: 0, // Would be fetched from blockchain
      legendary: 88,
      standard: 8800,
    };
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return {
      total: 8888,
      minted: 0,
      legendary: 88,
      standard: 8800,
    };
  }
}