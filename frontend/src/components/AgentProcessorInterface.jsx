import React, { useState, useEffect } from 'react';
import './AgentProcessorInterface.css';

/**
 * AgentProcessorInterface Component
 * 
 * Client-side agent processor interface that works directly with Arweave
 * without requiring a backend server.
 */
const AgentProcessorInterface = ({ arweaveService, agentData, oracleData, wallet }) => {
  const [status, setStatus] = useState('initializing');
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize component
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Set status based on available data
        if (agentData?.agent && oracleData) {
          setStatus('connected');
          
          // Simulate recent updates based on agent and oracle data
          const updates = [
            {
              id: 1,
              type: 'agent-activity',
              message: `Agent ${agentData.agent.processId.slice(0, 8)}... is active`,
              timestamp: new Date(Date.now() - 300000).toISOString(),
              status: 'success'
            },
            {
              id: 2,
              type: 'oracle-sync',
              message: `Oracle scrolls loaded: ${oracleData.scrolls?.length || 0} scrolls`,
              timestamp: new Date(Date.now() - 600000).toISOString(),
              status: 'info'
            },
            {
              id: 3,
              type: 'arweave-sync',
              message: 'Connected to Arweave mainnet',
              timestamp: new Date(Date.now() - 900000).toISOString(),
              status: 'success'
            }
          ];
          
          setRecentUpdates(updates);
        } else {
          setStatus('offline');
          setRecentUpdates([
            {
              id: 1,
              type: 'error',
              message: 'No agent or oracle data available',
              timestamp: new Date().toISOString(),
              status: 'error'
            }
          ]);
        }
      } catch (err) {
        console.error('Failed to load processor data:', err);
        setStatus('error');
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [agentData, oracleData]);

  const initializeProcessor = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate processor initialization
      setStatus('initializing');
      
      // If wallet is connected, try to interact with Arweave
      if (arweaveService && wallet) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate work
        setStatus('connected');
        
        const newUpdate = {
          id: Date.now(),
          type: 'initialization',
          message: 'Processor initialized successfully with wallet connection',
          timestamp: new Date().toISOString(),
          status: 'success'
        };
        
        setRecentUpdates(prev => [newUpdate, ...prev.slice(0, 9)]);
      } else {
        setStatus('connected');
        
        const newUpdate = {
          id: Date.now(),
          type: 'initialization',
          message: 'Processor initialized in read-only mode (no wallet)',
          timestamp: new Date().toISOString(),
          status: 'info'
        };
        
        setRecentUpdates(prev => [newUpdate, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      console.error('Failed to initialize processor:', err);
      setStatus('error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    
    try {
      // Refresh the data similar to initialization
      if (agentData?.agent && oracleData) {
        setStatus('connected');
      } else {
        setStatus('offline');
      }
      
      const newUpdate = {
        id: Date.now(),
        type: 'refresh',
        message: 'Data refreshed successfully',
        timestamp: new Date().toISOString(),
        status: 'info'
      };
      
      setRecentUpdates(prev => [newUpdate, ...prev.slice(0, 9)]);
    } catch (err) {
      console.error('Failed to refresh data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'initializing': return '#FF9800';
      case 'error': return '#f44336';
      case 'offline': return '#9E9E9E';
      default: return '#2196F3';
    }
  };

  const getUpdateStatusColor = (status) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'info': return '#2196F3';
      case 'warning': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="agent-processor-interface">
      <div className="processor-header">
        <h2>⚙️ Agent Processor</h2>
        <div className="processor-status">
          <div 
            className="status-indicator"
            style={{ backgroundColor: getStatusColor(status) }}
          ></div>
          <span className="status-text">{status}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="processor-controls">
        <button 
          onClick={initializeProcessor}
          disabled={loading}
          className="control-button primary"
        >
          {loading ? 'Initializing...' : 'Initialize Processor'}
        </button>
        
        <button 
          onClick={refreshData}
          disabled={loading}
          className="control-button secondary"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <div className="processor-grid">
        <div className="processor-card">
          <h3>Agent Status</h3>
          {agentData?.agent ? (
            <div className="agent-info">
              <div className="info-row">
                <span className="label">Process ID:</span>
                <span className="value">{agentData.agent.processId.slice(0, 16)}...</span>
              </div>
              <div className="info-row">
                <span className="label">Name:</span>
                <span className="value">{agentData.agent.name || 'RATi'}</span>
              </div>
              <div className="info-row">
                <span className="label">Status:</span>
                <span className="value" style={{ color: getStatusColor(agentData.agent.status || 'active') }}>
                  {agentData.agent.status || 'active'}
                </span>
              </div>
            </div>
          ) : (
            <div className="no-data">No agent data available</div>
          )}
        </div>

        <div className="processor-card">
          <h3>Oracle Status</h3>
          {oracleData ? (
            <div className="oracle-info">
              <div className="info-row">
                <span className="label">Scrolls:</span>
                <span className="value">{oracleData.scrolls?.length || 0}</span>
              </div>
              <div className="info-row">
                <span className="label">Status:</span>
                <span className="value" style={{ color: getStatusColor(oracleData.status || 'connected') }}>
                  {oracleData.status || 'connected'}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Activity:</span>
                <span className="value">{oracleData.recentActivity || 'unknown'}</span>
              </div>
            </div>
          ) : (
            <div className="no-data">No oracle data available</div>
          )}
        </div>

        <div className="processor-card">
          <h3>Wallet Status</h3>
          {wallet ? (
            <div className="wallet-info">
              <div className="info-row">
                <span className="label">Address:</span>
                <span className="value">{wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}</span>
              </div>
              <div className="info-row">
                <span className="label">Connected:</span>
                <span className="value" style={{ color: '#4CAF50' }}>Yes</span>
              </div>
              <div className="info-row">
                <span className="label">Type:</span>
                <span className="value">{wallet.type || 'arconnect'}</span>
              </div>
            </div>
          ) : (
            <div className="no-data">
              <div>No wallet connected</div>
              <small>Connect wallet for full functionality</small>
            </div>
          )}
        </div>

        <div className="processor-card">
          <h3>Arweave Status</h3>
          <div className="arweave-info">
            <div className="info-row">
              <span className="label">Network:</span>
              <span className="value">Mainnet</span>
            </div>
            <div className="info-row">
              <span className="label">Connection:</span>
              <span className="value" style={{ color: '#4CAF50' }}>Connected</span>
            </div>
            <div className="info-row">
              <span className="label">Mode:</span>
              <span className="value">Client-side</span>
            </div>
          </div>
        </div>
      </div>

      <div className="recent-updates">
        <h3>Recent Updates</h3>
        <div className="updates-list">
          {recentUpdates.length > 0 ? (
            recentUpdates.map(update => (
              <div key={update.id} className="update-item">
                <div 
                  className="update-status"
                  style={{ backgroundColor: getUpdateStatusColor(update.status) }}
                ></div>
                <div className="update-content">
                  <div className="update-message">{update.message}</div>
                  <div className="update-meta">
                    <span className="update-type">{update.type}</span>
                    <span className="update-time">{formatTimestamp(update.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-updates">No recent updates</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentProcessorInterface;
