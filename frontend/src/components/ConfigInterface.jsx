import React, { useState, useEffect } from 'react';
import './ConfigInterface.css';

const ConfigInterface = ({ onConfigUpdate }) => {
  const [config, setConfig] = useState({
    // Core agent configuration
    openai: {
      apiKey: '',
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4'
    },
    // Farcaster integration
    farcaster: {
      apiKey: '',
      signerUuid: '',
      enabled: false
    },
    // Matrix integration
    matrix: {
      homeserver: 'https://matrix.org',
      accessToken: '',
      userId: '',
      roomIds: '',
      enabled: false
    },
    // Agent behavior settings
    agent: {
      pollingInterval: 15000,
      actionHistoryLength: 20,
      enableAutoPost: true,
      enableEngagement: true
    },
    // Arweave/AO settings
    arweave: {
      network: 'mainnet', // 'mainnet', 'arlocal', 'custom'
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
      processId: ''
    }
  });

  const [activeTab, setActiveTab] = useState('openai');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showSecrets, setShowSecrets] = useState({});

  // Load saved configuration on component mount
  useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    try {
      const response = await fetch('/api/agent/config');
      if (response.ok) {
        const savedConfig = await response.json();
        setConfig(prevConfig => ({
          ...prevConfig,
          ...savedConfig
        }));
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const handleInputChange = (section, field, value) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        [field]: value
      }
    }));
  };

  const handleToggleEnabled = (section) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        enabled: !prevConfig[section].enabled
      }
    }));
  };

  const toggleSecretVisibility = (key) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setSaveStatus('');

    try {
      const response = await fetch('/api/agent/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        setSaveStatus('Configuration saved successfully!');
        if (onConfigUpdate) {
          onConfigUpdate(config);
        }
      } else {
        throw new Error(`Failed to save configuration: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setSaveStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleTestConnection = async (service) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agent/test-connection/${service}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config[service])
      });

      const result = await response.json();
      setSaveStatus(result.success ? 
        `${service} connection successful!` : 
        `${service} connection failed: ${result.error}`
      );
    } catch (error) {
      setSaveStatus(`Connection test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const renderSecretInput = (label, value, onChange, placeholder = '') => (
    <div className="config-field">
      <label>{label}</label>
      <div className="secret-input-group">
        <input
          type={showSecrets[label] ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="secret-input"
        />
        <button
          type="button"
          onClick={() => toggleSecretVisibility(label)}
          className="toggle-secret-btn"
        >
          {showSecrets[label] ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );

  const renderOpenAIConfig = () => (
    <div className="config-section">
      <h3>OpenAI Configuration</h3>
      <p className="config-description">
        Configure your OpenAI API settings for the agent's AI capabilities.
      </p>
      
      {renderSecretInput(
        'API Key',
        config.openai.apiKey,
        (value) => handleInputChange('openai', 'apiKey', value),
        'sk-...'
      )}

      <div className="config-field">
        <label>API URL</label>
        <input
          type="text"
          value={config.openai.apiUrl}
          onChange={(e) => handleInputChange('openai', 'apiUrl', e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="config-field">
        <label>Model</label>
        <select
          value={config.openai.model}
          onChange={(e) => handleInputChange('openai', 'model', e.target.value)}
        >
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        </select>
      </div>

      <button
        onClick={() => handleTestConnection('openai')}
        disabled={isLoading || !config.openai.apiKey}
        className="test-connection-btn"
      >
        Test Connection
      </button>
    </div>
  );

  const renderFarcasterConfig = () => (
    <div className="config-section">
      <div className="config-header">
        <h3>Farcaster Integration</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={config.farcaster.enabled}
            onChange={() => handleToggleEnabled('farcaster')}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      
      <p className="config-description">
        Enable Farcaster integration for posting and engaging with casts.
      </p>

      {renderSecretInput(
        'API Key',
        config.farcaster.apiKey,
        (value) => handleInputChange('farcaster', 'apiKey', value),
        'Your Neynar API key'
      )}

      {renderSecretInput(
        'Signer UUID',
        config.farcaster.signerUuid,
        (value) => handleInputChange('farcaster', 'signerUuid', value),
        'Your Farcaster signer UUID'
      )}

      <button
        onClick={() => handleTestConnection('farcaster')}
        disabled={isLoading || !config.farcaster.enabled || !config.farcaster.apiKey}
        className="test-connection-btn"
      >
        Test Connection
      </button>
    </div>
  );

  const renderMatrixConfig = () => (
    <div className="config-section">
      <div className="config-header">
        <h3>Matrix Integration</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={config.matrix.enabled}
            onChange={() => handleToggleEnabled('matrix')}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <p className="config-description">
        Configure Matrix integration for chat room participation.
      </p>

      <div className="config-field">
        <label>Homeserver</label>
        <input
          type="text"
          value={config.matrix.homeserver}
          onChange={(e) => handleInputChange('matrix', 'homeserver', e.target.value)}
          placeholder="https://matrix.org"
        />
      </div>

      {renderSecretInput(
        'Access Token',
        config.matrix.accessToken,
        (value) => handleInputChange('matrix', 'accessToken', value),
        'Your Matrix access token'
      )}

      <div className="config-field">
        <label>User ID</label>
        <input
          type="text"
          value={config.matrix.userId}
          onChange={(e) => handleInputChange('matrix', 'userId', e.target.value)}
          placeholder="@username:matrix.org"
        />
      </div>

      <div className="config-field">
        <label>Room IDs (comma-separated)</label>
        <textarea
          value={config.matrix.roomIds}
          onChange={(e) => handleInputChange('matrix', 'roomIds', e.target.value)}
          placeholder="!roomId1:matrix.org,!roomId2:matrix.org"
          rows="3"
        />
      </div>

      <button
        onClick={() => handleTestConnection('matrix')}
        disabled={isLoading || !config.matrix.enabled || !config.matrix.accessToken}
        className="test-connection-btn"
      >
        Test Connection
      </button>
    </div>
  );

  const renderAgentConfig = () => (
    <div className="config-section">
      <h3>Agent Behavior</h3>
      <p className="config-description">
        Configure how the agent behaves and interacts.
      </p>

      <div className="config-field">
        <label>Polling Interval (ms)</label>
        <input
          type="number"
          value={config.agent.pollingInterval}
          onChange={(e) => handleInputChange('agent', 'pollingInterval', parseInt(e.target.value))}
          min="5000"
          max="300000"
        />
      </div>

      <div className="config-field">
        <label>Action History Length</label>
        <input
          type="number"
          value={config.agent.actionHistoryLength}
          onChange={(e) => handleInputChange('agent', 'actionHistoryLength', parseInt(e.target.value))}
          min="5"
          max="100"
        />
      </div>

      <div className="config-field">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.agent.enableAutoPost}
            onChange={(e) => handleInputChange('agent', 'enableAutoPost', e.target.checked)}
          />
          Enable automatic posting
        </label>
      </div>

      <div className="config-field">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.agent.enableEngagement}
            onChange={(e) => handleInputChange('agent', 'enableEngagement', e.target.checked)}
          />
          Enable social engagement (likes, reactions)
        </label>
      </div>
    </div>
  );

  // Handle Arweave network preset selection
  const handleArweaveNetworkChange = (network) => {
    let networkConfig = { network };
    
    switch (network) {
      case 'mainnet':
        networkConfig = {
          ...networkConfig,
          host: 'arweave.net',
          port: 443,
          protocol: 'https'
        };
        break;
      case 'arlocal':
        networkConfig = {
          ...networkConfig,
          host: 'arlocal',
          port: 1984,
          protocol: 'http'
        };
        break;
      // For 'custom', keep existing values
      default:
        break;
    }
    
    setConfig(prev => ({
      ...prev,
      arweave: {
        ...prev.arweave,
        ...networkConfig
      }
    }));
  };

  const renderArweaveConfig = () => (
    <div className="config-section">
      <h3>Arweave/AO Configuration</h3>
      <p className="config-description">
        Configure connection to Arweave and AO processes. Choose a network preset or configure custom settings.
      </p>

      <div className="config-field">
        <label>Network</label>
        <select
          value={config.arweave.network}
          onChange={(e) => handleArweaveNetworkChange(e.target.value)}
        >
          <option value="mainnet">Arweave Mainnet (arweave.net)</option>
          <option value="arlocal">ArLocal Development (localhost)</option>
          <option value="custom">Custom Configuration</option>
        </select>
        <small className="field-hint">
          {config.arweave.network === 'mainnet' && 'Production Arweave network - requires AR tokens'}
          {config.arweave.network === 'arlocal' && 'Local development node - free testing environment'}
          {config.arweave.network === 'custom' && 'Configure your own Arweave node endpoint'}
        </small>
      </div>

      <div className="config-field">
        <label>Host</label>
        <input
          type="text"
          value={config.arweave.host}
          onChange={(e) => handleInputChange('arweave', 'host', e.target.value)}
          placeholder="arweave.net"
          disabled={config.arweave.network !== 'custom'}
        />
      </div>

      <div className="config-field">
        <label>Port</label>
        <input
          type="number"
          value={config.arweave.port}
          onChange={(e) => handleInputChange('arweave', 'port', parseInt(e.target.value))}
          placeholder="443"
          disabled={config.arweave.network !== 'custom'}
        />
      </div>

      <div className="config-field">
        <label>Protocol</label>
        <select
          value={config.arweave.protocol}
          onChange={(e) => handleInputChange('arweave', 'protocol', e.target.value)}
          disabled={config.arweave.network !== 'custom'}
        >
          <option value="https">HTTPS</option>
          <option value="http">HTTP</option>
        </select>
      </div>

      <div className="config-field">
        <label>Process ID</label>
        <input
          type="text"
          value={config.arweave.processId}
          onChange={(e) => handleInputChange('arweave', 'processId', e.target.value)}
          placeholder="Your AO process ID"
        />
        <small className="field-hint">
          The AO process ID for your agent. Required for AO-based functionality.
        </small>
      </div>
    </div>
  );

  return (
    <div className="config-interface">
      <div className="config-header-main">
        <h2>Agent Configuration</h2>
        <p>Configure your RATi agent's integrations and behavior</p>
      </div>

      <div className="config-tabs">
        <button
          className={activeTab === 'openai' ? 'active' : ''}
          onClick={() => setActiveTab('openai')}
        >
          OpenAI
        </button>
        <button
          className={activeTab === 'farcaster' ? 'active' : ''}
          onClick={() => setActiveTab('farcaster')}
        >
          Farcaster {config.farcaster.enabled && '✓'}
        </button>
        <button
          className={activeTab === 'matrix' ? 'active' : ''}
          onClick={() => setActiveTab('matrix')}
        >
          Matrix {config.matrix.enabled && '✓'}
        </button>
        <button
          className={activeTab === 'agent' ? 'active' : ''}
          onClick={() => setActiveTab('agent')}
        >
          Behavior
        </button>
        <button
          className={activeTab === 'arweave' ? 'active' : ''}
          onClick={() => setActiveTab('arweave')}
        >
          Arweave/AO
        </button>
      </div>

      <div className="config-content">
        {activeTab === 'openai' && renderOpenAIConfig()}
        {activeTab === 'farcaster' && renderFarcasterConfig()}
        {activeTab === 'matrix' && renderMatrixConfig()}
        {activeTab === 'agent' && renderAgentConfig()}
        {activeTab === 'arweave' && renderArweaveConfig()}
      </div>

      <div className="config-actions">
        <button
          onClick={handleSaveConfig}
          disabled={isLoading}
          className="save-config-btn"
        >
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
        
        {saveStatus && (
          <div className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
            {saveStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigInterface;
