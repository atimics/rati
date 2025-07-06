import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAgentData, getAgentProof, searchAgents, getAgentStats } from '../../services/agents';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Agent Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up development environment
    process.env.NODE_ENV = 'development';
  });

  describe('getAgentData', () => {
    it('returns mock data in development environment', async () => {
      const agentData = await getAgentData(0);
      
      expect(agentData).toBeDefined();
      expect(agentData?.index).toBe(0);
      expect(agentData?.name).toBe('Agent #0000');
      expect(agentData?.rarity).toBe('Legendary'); // First 10 are legendary
      expect(agentData?.attributes).toBeInstanceOf(Array);
      expect(agentData?.proof).toBeInstanceOf(Array);
    });

    it('returns standard rarity for non-legendary agents', async () => {
      const agentData = await getAgentData(50);
      
      expect(agentData).toBeDefined();
      expect(agentData?.rarity).toBe('Standard');
    });

    it('returns null for invalid indices', async () => {
      const agentData = await getAgentData(99999);
      
      expect(agentData).toBeNull();
    });

    it('fetches from API in production environment', async () => {
      process.env.NODE_ENV = 'production';
      
      const mockResponse = {
        name: 'Test Agent',
        description: 'Test Description',
        image: 'test-image.png',
        attributes: [{ trait_type: 'Test', value: 'Value' }],
      };

      (fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const agentData = await getAgentData(42);
      
      expect(fetch).toHaveBeenCalledWith('/generated/agents/42.json');
      expect(agentData?.name).toBe('Test Agent');
    });

    it('handles fetch errors gracefully', async () => {
      process.env.NODE_ENV = 'production';
      
      (fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

      const agentData = await getAgentData(42);
      
      expect(agentData).toBeNull();
    });
  });

  describe('getAgentProof', () => {
    it('returns mock proof in development', async () => {
      const proof = await getAgentProof(0);
      
      expect(proof).toBeInstanceOf(Array);
      expect(proof.length).toBeGreaterThan(0);
      expect(proof[0]).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('fetches proof from merkle tree in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const mockMerkleData = {
        proofs: {
          '42': ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'],
        },
      };

      (fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMerkleData),
      });

      const proof = await getAgentProof(42);
      
      expect(fetch).toHaveBeenCalledWith('/generated/merkle/merkle-tree.json');
      expect(proof).toEqual(mockMerkleData.proofs['42']);
    });
  });

  describe('searchAgents', () => {
    it('searches through mock data in development', async () => {
      const results = await searchAgents('legendary');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // All results should contain 'legendary' in some form
      results.forEach(agent => {
        const searchableText = [
          agent.name,
          agent.description,
          ...agent.attributes.map(attr => `${attr.trait_type} ${attr.value}`)
        ].join(' ').toLowerCase();
        
        expect(searchableText).toContain('legendary');
      });
    });

    it('returns empty array for non-matching queries', async () => {
      const results = await searchAgents('nonexistent');
      
      expect(results).toEqual([]);
    });

    it('handles search errors gracefully', async () => {
      // Mock an error condition
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const results = await searchAgents('test');
      
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('getAgentStats', () => {
    it('returns mock stats in development', async () => {
      const stats = await getAgentStats();
      
      expect(stats).toHaveProperty('total', 8888);
      expect(stats).toHaveProperty('minted');
      expect(stats).toHaveProperty('legendary', 88);
      expect(stats).toHaveProperty('standard', 8800);
      expect(stats).toHaveProperty('rarityDistribution');
      expect(stats).toHaveProperty('attributeDistribution');
    });

    it('has correct rarity distribution', async () => {
      const stats = await getAgentStats();
      
      expect(stats.rarityDistribution).toHaveProperty('Legendary', 88);
      expect(stats.rarityDistribution).toHaveProperty('Standard', 8800);
    });

    it('has attribute distribution data', async () => {
      const stats = await getAgentStats();
      
      expect(stats.attributeDistribution).toHaveProperty('Background');
      expect(stats.attributeDistribution).toHaveProperty('Core Type');
      
      const backgroundStats = stats.attributeDistribution['Background'];
      expect(backgroundStats).toHaveProperty('Cyberpunk City');
      expect(backgroundStats).toHaveProperty('Legendary Nexus', 88);
    });
  });
});