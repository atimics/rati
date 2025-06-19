import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useDeploymentStore } from '../store';
import arweaveSDK from '../services/ArweaveSDK';
import './ModernDeploymentInterface.css';

/**
 * Modern Deployment Interface
 * 
 * A clean, user-friendly deployment interface that replaces
 * the complex existing deployment system with a streamlined UX.
 */

const DEPLOYMENT_TYPES = {
  AGENT: {
    id: 'agent',
    title: 'Deploy Agent',
    description: 'Deploy your digital avatar to the Arweave network',
    icon: '🤖',
    color: '#4CAF50'
  },
  JOURNAL: {
    id: 'journal',
    title: 'Publish Journal',
    description: 'Publish a journal entry to the permanent web',
    icon: '📖',
    color: '#2196F3'
  },
  FRONTEND: {
    id: 'frontend',
    title: 'Deploy Frontend',
    description: 'Deploy the entire frontend application',
    icon: '🌐',
    color: '#FF9800'
  }
};

const ModernDeploymentInterface = () => {
  const { isConnected, connect } = useWallet();
  const { addDeployment, deployments } = useDeploymentStore();
  
  const [selectedType, setSelectedType] = useState(null);
  const [deploymentData, setDeploymentData] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState({ status: '', progress: 0 });
  const [estimatedCost, setEstimatedCost] = useState(null);

  // Estimate cost when data changes
  React.useEffect(() => {
    if (deploymentData && isConnected) {
      const estimate = async () => {
        try {
          const cost = await arweaveSDK.estimateCost(deploymentData);
          setEstimatedCost(cost);
        } catch (error) {
          console.error('Cost estimation failed:', error);
        }
      };
      
      // Debounce the estimation
      const timer = setTimeout(estimate, 500);
      return () => clearTimeout(timer);
    }
  }, [deploymentData, isConnected]);

  const handleDeploy = async () => {
    if (!selectedType || !deploymentData) return;
    
    setDeploying(true);
    
    try {
      let result;
      
      switch (selectedType.id) {
        case 'agent':
          result = await arweaveSDK.deployAgent(
            JSON.parse(deploymentData),
            {
              onProgress: setProgress
            }
          );
          break;
          
        case 'journal':
          result = await arweaveSDK.publishJournal(
            deploymentData,
            {
              onProgress: setProgress
            }
          );
          break;
          
        case 'frontend':
          result = await arweaveSDK.deploy(
            deploymentData,
            {
              contentType: 'text/html',
              tags: [
                { name: 'Type', value: 'Frontend-Deployment' },
                { name: 'App-Name', value: 'RATi-Frontend' }
              ],
              onProgress: setProgress
            }
          );
          break;
          
        default:
          throw new Error('Unknown deployment type');
      }
      
      // Add to store
      addDeployment({
        type: selectedType.id,
        txId: result.txId,
        url: result.url,
        status: 'pending',
        data: deploymentData
      });
      
      // Reset form
      setSelectedType(null);
      setDeploymentData('');
      setEstimatedCost(null);
      
    } catch (error) {
      console.error('Deployment failed:', error);
      setProgress({ 
        status: 'error', 
        progress: 0, 
        error: error.message 
      });
    } finally {
      setDeploying(false);
    }
  };

  // Wallet not connected view
  if (!isConnected) {
    return (
      <div className="modern-deployment">
        <div className="deployment-hero">
          <div className="hero-icon">🚀</div>
          <h2>Deploy to Arweave</h2>
          <p>Connect your wallet to deploy your digital avatar and content to the permanent web</p>
          <button className="connect-button" onClick={connect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modern-deployment">
      <div className="deployment-header">
        <h2>🚀 Deploy to Arweave</h2>
        <p>Choose what you'd like to deploy to the permanent web</p>
      </div>

      {/* Deployment Type Selection */}
      {!selectedType && (
        <div className="deployment-types">
          {Object.values(DEPLOYMENT_TYPES).map(type => (
            <div
              key={type.id}
              className="deployment-type-card"
              onClick={() => setSelectedType(type)}
              style={{ borderColor: type.color }}
            >
              <div className="type-icon" style={{ color: type.color }}>
                {type.icon}
              </div>
              <h3>{type.title}</h3>
              <p>{type.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Deployment Form */}
      {selectedType && !deploying && (
        <div className="deployment-form">
          <div className="form-header">
            <button 
              className="back-button"
              onClick={() => {
                setSelectedType(null);
                setDeploymentData('');
                setEstimatedCost(null);
              }}
            >
              ← Back
            </button>
            <div className="selected-type">
              <span className="type-icon">{selectedType.icon}</span>
              <h3>{selectedType.title}</h3>
            </div>
          </div>

          <div className="form-content">
            <label htmlFor="deploymentData">
              {selectedType.id === 'journal' ? 'Journal Content' : 'Deployment Data'}
            </label>
            <textarea
              id="deploymentData"
              value={deploymentData}
              onChange={(e) => setDeploymentData(e.target.value)}
              placeholder={
                selectedType.id === 'journal' 
                  ? 'Write your journal entry...'
                  : selectedType.id === 'agent'
                  ? 'Paste your agent configuration JSON...'
                  : 'Paste your frontend HTML/JS...'
              }
              rows={12}
            />

            {estimatedCost && (
              <div className="cost-estimate">
                <h4>💰 Estimated Cost</h4>
                <div className="cost-details">
                  <div className="cost-item">
                    <span>Size:</span>
                    <span>{(estimatedCost.bytes / 1024).toFixed(2)} KB</span>
                  </div>
                  <div className="cost-item">
                    <span>Cost:</span>
                    <span>{estimatedCost.ar} AR (~${estimatedCost.usd.toFixed(4)})</span>
                  </div>
                </div>
              </div>
            )}

            <button
              className="deploy-button"
              onClick={handleDeploy}
              disabled={!deploymentData.trim()}
              style={{ backgroundColor: selectedType.color }}
            >
              Deploy {selectedType.title}
            </button>
          </div>
        </div>
      )}

      {/* Deployment Progress */}
      {deploying && (
        <div className="deployment-progress">
          <div className="progress-header">
            <span className="progress-icon">{selectedType.icon}</span>
            <h3>Deploying {selectedType.title}...</h3>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${progress.progress}%`,
                backgroundColor: selectedType.color
              }}
            />
          </div>

          <div className="progress-status">
            {progress.status === 'creating' && '📝 Creating transaction...'}
            {progress.status === 'signing' && '✍️ Signing with wallet...'}
            {progress.status === 'submitting' && '📡 Submitting to Arweave...'}
            {progress.status === 'success' && '✅ Deployment successful!'}
            {progress.status === 'error' && `❌ Error: ${progress.error}`}
          </div>
        </div>
      )}

      {/* Recent Deployments */}
      {deployments.length > 0 && (
        <div className="recent-deployments">
          <h3>📋 Recent Deployments</h3>
          <div className="deployments-list">
            {deployments.slice(0, 5).map(deployment => (
              <div key={deployment.id} className="deployment-item">
                <div className="deployment-info">
                  <span className="deployment-type">
                    {DEPLOYMENT_TYPES[deployment.type.toUpperCase()]?.icon || '📄'}
                  </span>
                  <div className="deployment-details">
                    <div className="deployment-title">
                      {DEPLOYMENT_TYPES[deployment.type.toUpperCase()]?.title || deployment.type}
                    </div>
                    <div className="deployment-id">
                      {deployment.txId.slice(0, 12)}...
                    </div>
                  </div>
                </div>
                <div className="deployment-actions">
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-button"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernDeploymentInterface;
