import { useState, useEffect } from 'react';
import type { AgentData } from '../types';
import { getAgentData } from '../services/agents';

interface AgentPreviewProps {
  orbId: string;
}

export function AgentPreview({ orbId }: AgentPreviewProps) {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgentData();
  }, [orbId]);

  const loadAgentData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Convert orb ID to agent index (simplified conversion)
      const agentIndex = parseInt(orbId.slice(-4), 16) % 8888;
      const data = await getAgentData(agentIndex);
      
      if (data) {
        setAgentData(data);
      } else {
        setError('Agent data not found');
      }
    } catch (err) {
      console.error('Error loading agent data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="agent-preview loading">
        <div className="preview-skeleton">
          <div className="skeleton-image" />
          <div className="skeleton-text" />
          <div className="skeleton-text short" />
        </div>
      </div>
    );
  }

  if (error || !agentData) {
    return (
      <div className="agent-preview error">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p>Unable to preview agent: {error}</p>
        </div>
      </div>
    );
  }

  const rarityBadgeClass = agentData.rarity === 'Legendary' ? 'legendary' : 'standard';

  return (
    <div className="agent-preview">
      <div className="preview-card">
        <div className="agent-image-container">
          <img 
            src={agentData.image} 
            alt={agentData.name}
            className="agent-image"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-agent.png';
            }}
          />
          <div className={`rarity-badge ${rarityBadgeClass}`}>
            {agentData.rarity}
          </div>
        </div>
        
        <div className="agent-details">
          <h3 className="agent-name">{agentData.name}</h3>
          <p className="agent-description">{agentData.description}</p>
          
          <div className="agent-attributes">
            {agentData.attributes.map((attr, index) => (
              <div key={index} className="attribute">
                <span className="attribute-type">{attr.trait_type}</span>
                <span className="attribute-value">
                  {typeof attr.value === 'number' ? attr.value.toLocaleString() : attr.value}
                </span>
              </div>
            ))}
          </div>
          
          <div className="transformation-info">
            <div className="transformation-arrow">
              <div className="orb-icon">🔮</div>
              <div className="arrow">→</div>
              <div className="agent-icon">🤖</div>
            </div>
            <p className="transformation-text">
              Your Orb will be transformed into this unique AI Agent
            </p>
          </div>
        </div>
      </div>
      
      <div className="preview-stats">
        <div className="stat">
          <span className="stat-label">Agent Index</span>
          <span className="stat-value">#{agentData.index}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Rarity</span>
          <span className={`stat-value rarity-${agentData.rarity.toLowerCase()}`}>
            {agentData.rarity}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Generation</span>
          <span className="stat-value">Genesis</span>
        </div>
      </div>
    </div>
  );
}