import React, { useState, useEffect } from 'react';
import { deployToArweave, estimateTransactionCost, getTransactionStatus } from '../utils/arweave.js';
import './DeploymentInterface.css';

const DeploymentInterface = ({ wallet, appData }) => {
  const [deploying, setDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState(null);
  const [error, setError] = useState(null);
  const [deploymentStatus, setDeploymentStatus] = useState(null);

  // Estimate deployment cost when app data changes
  useEffect(() => {
    if (appData) {
      const estimateCost = async () => {
        try {
          const dataSize = new Blob([appData]).size;
          const cost = await estimateTransactionCost(dataSize);
          setEstimatedCost(cost);
        } catch (err) {
          console.error('Failed to estimate cost:', err);
        }
      };
      estimateCost();
    }
  }, [appData]);

  // Poll deployment status
  useEffect(() => {
    if (deploymentResult?.txId && !deploymentStatus?.confirmed) {
      const pollStatus = async () => {
        try {
          const status = await getTransactionStatus(deploymentResult.txId);
          setDeploymentStatus(status);
          
          // Stop polling once confirmed
          if (status.confirmed) {
            return;
          }
        } catch (err) {
          console.error('Failed to check deployment status:', err);
        }
      };

      // Poll every 30 seconds
      const interval = setInterval(pollStatus, 30000);
      
      // Initial check
      pollStatus();

      return () => clearInterval(interval);
    }
  }, [deploymentResult?.txId, deploymentStatus?.confirmed]);

  const handleDeploy = async () => {
    if (!wallet || !appData) {
      setError('Wallet not connected or app data not available');
      return;
    }

    setDeploying(true);
    setError(null);
    setDeploymentResult(null);
    setDeploymentStatus(null);

    try {
      const result = await deployToArweave(
        appData,
        'text/html',
        [
          { name: 'Title', value: 'RATi Frontend - Digital Avatar Interface' },
          { name: 'Description', value: 'Decentralized frontend for RATi digital avatar platform' },
          { name: 'Deployment-Date', value: new Date().toISOString() },
          { name: 'Version', value: '0.2.0' }
        ]
      );

      setDeploymentResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatAR = (ar) => {
    return ar < 0.001 ? ar.toFixed(6) : ar.toFixed(3);
  };

  if (!wallet) {
    return (
      <div className="deployment-interface">
        <div className="deployment-status">
          <div className="status-icon">🔒</div>
          <div className="status-message">
            Connect your wallet to deploy the RATi frontend to Arweave
          </div>
        </div>
      </div>
    );
  }

  if (!appData) {
    return (
      <div className="deployment-interface">
        <div className="deployment-status">
          <div className="status-icon">⏳</div>
          <div className="status-message">
            Building application data for deployment...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="deployment-interface">
      <div className="deployment-header">
        <h3>Deploy to Arweave</h3>
        <p>Deploy the RATi frontend as a permanent, decentralized web application</p>
      </div>

      <div className="deployment-info">
        <div className="info-item">
          <span className="info-label">Bundle Size:</span>
          <span className="info-value">{formatFileSize(new Blob([appData]).size)}</span>
        </div>
        {estimatedCost && (
          <div className="info-item">
            <span className="info-label">Estimated Cost:</span>
            <span className="info-value">{formatAR(estimatedCost.ar)} AR</span>
          </div>
        )}
      </div>

      {!deploymentResult ? (
        <div className="deployment-actions">
          <button
            className="deploy-button"
            onClick={handleDeploy}
            disabled={deploying}
          >
            {deploying ? (
              <>
                <span className="spinner">⏳</span>
                Deploying to Arweave...
              </>
            ) : (
              <>
                <span className="deploy-icon">🚀</span>
                Deploy Frontend
              </>
            )}
          </button>
          {error && (
            <div className="deployment-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{error}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="deployment-result">
          <div className="result-header">
            <div className="result-icon">✅</div>
            <div className="result-title">Deployment Successful!</div>
          </div>
          
          <div className="result-details">
            <div className="detail-item">
              <span className="detail-label">Transaction ID:</span>
              <span className="detail-value tx-id">{deploymentResult.txId}</span>
              <button
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(deploymentResult.txId)}
                title="Copy transaction ID"
              >
                📋
              </button>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Arweave URL:</span>
              <a
                href={deploymentResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-link"
              >
                {deploymentResult.url}
              </a>
            </div>

            {deploymentStatus && (
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className={`status-badge ${deploymentStatus.confirmed ? 'confirmed' : 'pending'}`}>
                  {deploymentStatus.confirmed ? (
                    <>✅ Confirmed ({deploymentStatus.block_height} blocks)</>
                  ) : (
                    <>⏳ Pending Confirmation</>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="result-actions">
            <a
              href={deploymentResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="view-button"
            >
              🌐 View Deployed App
            </a>
            <button
              className="deploy-again-button"
              onClick={() => {
                setDeploymentResult(null);
                setDeploymentStatus(null);
                setError(null);
              }}
            >
              🔄 Deploy Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentInterface;
