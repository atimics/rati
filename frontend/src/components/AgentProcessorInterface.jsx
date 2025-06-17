import React, { useState, useEffect } from 'react';
import './AgentProcessorInterface.css';

const AgentProcessorInterface = ({ agentData, apiUrl, oracleData }) => {
  const [processorStatus, setProcessorStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agentList, setAgentList] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [config, setConfig] = useState({
    sortingCriteria: 'intelligent', // Default to intelligent sorting
    updateInterval: 300000, // 5 minutes
    maxBatchSize: 10
  });

  // Fetch processor status and related data on component mount
  useEffect(() => {
    fetchProcessorStatus();
    fetchAgentList();
    fetchRecentUpdates();
    
    // Poll status every 30 seconds for live updates
    const interval = setInterval(() => {
      fetchProcessorStatus();
      if (processorStatus?.isRunning) {
        fetchRecentUpdates();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchProcessorStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/status`);
      if (response.ok) {
        const data = await response.json();
        setProcessorStatus(data);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch processor status:', err);
    }
  };

  const fetchAgentList = async () => {
    if (!agentData?.oracle?.processId) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/oracle/agent-list?oracleId=${agentData.oracle.processId}`);
      if (response.ok) {
        const data = await response.json();
        setAgentList(data.agentList || []);
      }
    } catch (err) {
      console.error('Failed to fetch agent list:', err);
    }
  };

  const fetchRecentUpdates = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/recent-updates`);
      if (response.ok) {
        const data = await response.json();
        setRecentUpdates(data.updates || []);
      }
    } catch (_err) {
      // Recent updates are optional, don't log errors
    }
  };

  const initializeProcessor = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oracleProcessId: agentData?.oracle?.processId,
          sortingCriteria: config.sortingCriteria,
          updateInterval: config.updateInterval
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Processor initialized:', result);
      
      // Fetch updated status
      await fetchProcessorStatus();
      
    } catch (err) {
      setError(err.message);
      console.error('Initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startProcessor = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/start`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to start: ${response.statusText}`);
      }

      await fetchProcessorStatus();
      
    } catch (err) {
      setError(err.message);
      console.error('Start error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopProcessor = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/stop`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to stop: ${response.statusText}`);
      }

      await fetchProcessorStatus();
      
    } catch (err) {
      setError(err.message);
      console.error('Stop error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerManualUpdate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/update`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger update: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Manual update triggered:', result);
      
    } catch (err) {
      setError(err.message);
      console.error('Manual update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/agent-processor/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(`Failed to update config: ${response.statusText}`);
      }

      await fetchProcessorStatus();
      
    } catch (err) {
      setError(err.message);
      console.error('Config update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatInterval = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="agent-processor-interface">
      <div className="processor-header">
        <h2>🤖 Agent Processor Control</h2>
        <div className="status-indicator">
          <span className={`status-dot ${processorStatus?.initialized ? 
            (processorStatus.status?.isRunning ? 'running' : 'stopped') : 'uninitialized'}`}>
          </span>
          <span className="status-text">
            {!processorStatus?.initialized ? 'Not Initialized' :
             processorStatus.status?.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!processorStatus?.initialized ? (
        <div className="initialization-section">
          <h3>Initialize Agent Processor</h3>
          <p>Configure and initialize the agent processor to manage oracle-driven agent updates.</p>
          
          <div className="config-section">
            <div className="config-row">
              <label>Sorting Criteria:</label>
              <select 
                value={config.sortingCriteria} 
                onChange={(e) => setConfig({...config, sortingCriteria: e.target.value})}
              >
                <option value="activity">Activity Level</option>
                <option value="sequence">Memory Sequence</option>
                <option value="priority">Least Recently Processed</option>
                <option value="random">Random</option>
              </select>
            </div>
            
            <div className="config-row">
              <label>Update Interval:</label>
              <select 
                value={config.updateInterval} 
                onChange={(e) => setConfig({...config, updateInterval: parseInt(e.target.value)})}
              >
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
                <option value={600000}>10 minutes</option>
                <option value={1800000}>30 minutes</option>
                <option value={3600000}>1 hour</option>
              </select>
            </div>
          </div>

          <button 
            onClick={initializeProcessor} 
            disabled={isLoading || !agentData?.oracle?.processId}
            className="primary-button"
          >
            {isLoading ? 'Initializing...' : 'Initialize Processor'}
          </button>

          {!agentData?.oracle?.processId && (
            <p className="warning">⚠️ Oracle process ID required. Deploy oracle first.</p>
          )}
        </div>
      ) : (
        <div className="processor-controls">
          <div className="status-display">
            <h3>Processor Status</h3>
            <div className="status-grid">
              <div className="status-item">
                <label>Oracle Process:</label>
                <span>{processorStatus.status?.oracleProcessId?.substring(0, 16)}...</span>
              </div>
              <div className="status-item">
                <label>Sorting Criteria:</label>
                <span>{processorStatus.status?.sortingCriteria}</span>
              </div>
              <div className="status-item">
                <label>Update Interval:</label>
                <span>{formatInterval(processorStatus.status?.updateInterval || 0)}</span>
              </div>
              <div className="status-item">
                <label>Processed Agents:</label>
                <span>{processorStatus.status?.processedAgentsCount || 0}</span>
              </div>
              <div className="status-item">
                <label>Last Update:</label>
                <span>
                  {processorStatus.status?.lastUpdate ? 
                    new Date(processorStatus.status.lastUpdate).toLocaleTimeString() : 
                    'Never'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="control-buttons">
            {!processorStatus.status?.isRunning ? (
              <button 
                onClick={startProcessor} 
                disabled={isLoading}
                className="start-button"
              >
                {isLoading ? 'Starting...' : 'Start Processor'}
              </button>
            ) : (
              <button 
                onClick={stopProcessor} 
                disabled={isLoading}
                className="stop-button"
              >
                {isLoading ? 'Stopping...' : 'Stop Processor'}
              </button>
            )}

            <button 
              onClick={triggerManualUpdate} 
              disabled={isLoading || !processorStatus.status?.isRunning}
              className="update-button"
            >
              {isLoading ? 'Updating...' : 'Manual Update'}
            </button>
          </div>

          <div className="config-update-section">
            <h3>Update Configuration</h3>
            <div className="config-section">
              <div className="config-row">
                <label>Sorting Criteria:</label>
                <select 
                  value={config.sortingCriteria} 
                  onChange={(e) => setConfig({...config, sortingCriteria: e.target.value})}
                >
                  <option value="activity">Activity Level</option>
                  <option value="sequence">Memory Sequence</option>
                  <option value="priority">Least Recently Processed</option>
                  <option value="random">Random</option>
                </select>
              </div>
              
              <div className="config-row">
                <label>Update Interval:</label>
                <select 
                  value={config.updateInterval} 
                  onChange={(e) => setConfig({...config, updateInterval: parseInt(e.target.value)})}
                >
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                  <option value={600000}>10 minutes</option>
                  <option value={1800000}>30 minutes</option>
                  <option value={3600000}>1 hour</option>
                </select>
              </div>
            </div>

            <button 
              onClick={updateConfig} 
              disabled={isLoading}
              className="secondary-button"
            >
              {isLoading ? 'Updating...' : 'Update Configuration'}
            </button>
          </div>

          <div className="recent-updates-section">
            <h3>Recent Updates</h3>
            <div className="updates-list">
              {recentUpdates.length === 0 ? (
                <p>No recent updates.</p>
              ) : (
                recentUpdates.map((update, index) => (
                  <div key={index} className="update-item">
                    <div className="update-header">
                      <span className="update-agent">
                        Agent {update.agentId}
                      </span>
                      <span className="update-time">
                        {new Date(update.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="update-details">
                      <div className="detail-item">
                        <strong>Status:</strong> {update.status}
                      </div>
                      <div className="detail-item">
                        <strong>Processed Agents:</strong> {update.processedAgents}
                      </div>
                      <div className="detail-item">
                        <strong>Errors:</strong> {update.errors || 'None'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="processor-info">
        <h3>How Agent Processor Works</h3>
        <ul>
          <li><strong>Oracle Integration:</strong> Fetches agent process lists from the oracle</li>
          <li><strong>Smart Sorting:</strong> Processes agents based on activity, sequence, or priority</li>
          <li><strong>Batch Updates:</strong> Sends context updates to agents in manageable batches</li>
          <li><strong>Context Synchronization:</strong> Keeps agents informed of oracle status and community changes</li>
        </ul>
      </div>
    </div>
  );
};

export default AgentProcessorInterface;
