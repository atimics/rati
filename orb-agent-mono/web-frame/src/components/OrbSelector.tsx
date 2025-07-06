import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { OrbData, ChainType } from '../types';
import { getUserOrbs } from '../services/solana';
import { trackEvent } from '../utils/analytics';

interface OrbSelectorProps {
  userAddress: string;
  onSelect: (orbId: string) => void;
  chain: ChainType;
}

export function OrbSelector({ userAddress, onSelect, chain }: OrbSelectorProps) {
  const [orbs, setOrbs] = useState<OrbData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrb, setSelectedOrb] = useState<string | null>(null);

  useEffect(() => {
    loadUserOrbs();
  }, [userAddress, chain]);

  const loadUserOrbs = async () => {
    setLoading(true);
    setError(null);

    try {
      if (chain === 'solana') {
        const userPublicKey = new PublicKey(userAddress);
        const userOrbs = await getUserOrbs(userPublicKey);
        
        // Convert to OrbData format
        const orbData: OrbData[] = userOrbs.map((orb, index) => ({
          mint: orb.mint,
          name: orb.metadata.name || `Orb #${index}`,
          image: orb.metadata.image || '/placeholder-orb.png',
          attributes: orb.metadata.attributes || [],
          owner: userAddress,
          metadata_uri: orb.metadata.uri,
        }));

        setOrbs(orbData);
      } else {
        // For EVM chains, we would need to query ERC-721 contracts
        // For now, show mock data
        setOrbs([
          {
            mint: '0x1234567890abcdef',
            name: 'Cross-Chain Orb #001',
            image: '/placeholder-orb.png',
            attributes: [
              { trait_type: 'Type', value: 'Genesis' },
              { trait_type: 'Power', value: 85 },
            ],
            owner: userAddress,
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading orbs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orbs');
    } finally {
      setLoading(false);
    }
  };

  const handleOrbSelect = (orbId: string) => {
    setSelectedOrb(orbId);
    onSelect(orbId);
    
    trackEvent('orb_selected', {
      orbId,
      chain,
      userAddress,
    });
  };

  if (loading) {
    return (
      <div className="orb-selector loading">
        <div className="loading-spinner" />
        <p>Loading your Orbs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orb-selector error">
        <div className="error-message">
          <strong>Error loading Orbs:</strong> {error}
        </div>
        <button className="btn btn-secondary" onClick={loadUserOrbs}>
          Try Again
        </button>
      </div>
    );
  }

  if (orbs.length === 0) {
    return (
      <div className="orb-selector empty">
        <div className="empty-state">
          <div className="empty-icon">🔮</div>
          <h3>No Orbs Found</h3>
          <p>
            You don't have any Orbs in your wallet yet. 
            {chain === 'solana' 
              ? ' Get some Orbs from the marketplace to start forging agents!' 
              : ' Connect your Solana wallet to see your Orbs.'
            }
          </p>
          <button className="btn btn-primary" onClick={loadUserOrbs}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-selector">
      <div className="orb-grid">
        {orbs.map((orb) => (
          <div
            key={orb.mint}
            className={`orb-card ${selectedOrb === orb.mint ? 'selected' : ''}`}
            onClick={() => handleOrbSelect(orb.mint)}
          >
            <div className="orb-image">
              <img 
                src={orb.image} 
                alt={orb.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-orb.png';
                }}
              />
            </div>
            
            <div className="orb-info">
              <h4 className="orb-name">{orb.name}</h4>
              <div className="orb-id">
                {orb.mint.slice(0, 8)}...{orb.mint.slice(-6)}
              </div>
              
              {orb.attributes.length > 0 && (
                <div className="orb-attributes">
                  {orb.attributes.slice(0, 3).map((attr, index) => (
                    <div key={index} className="attribute">
                      <span className="attr-type">{attr.trait_type}:</span>
                      <span className="attr-value">{attr.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="orb-actions">
              <button
                className={`btn ${selectedOrb === orb.mint ? 'btn-primary' : 'btn-secondary'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOrbSelect(orb.mint);
                }}
              >
                {selectedOrb === orb.mint ? 'Selected' : 'Select'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="orb-selector-footer">
        <p className="orb-count">
          {orbs.length} Orb{orbs.length !== 1 ? 's' : ''} available for transformation
        </p>
        <button className="btn btn-secondary refresh-btn" onClick={loadUserOrbs}>
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}