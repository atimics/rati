import React, { useState, useEffect } from 'react';
import enhancedAIService from '../services/EnhancedAIService';
import { useWallet } from '../contexts/WalletContext';
import toast from 'react-hot-toast';
import './SettingsInterface.css';

/**
 * Settings Interface
 * 
 * Simple settings for AI inference configuration and wallet management
 */

const SettingsInterface = () => {
  const { wallet, isConnected } = useWallet();
  const [aiStatus, setAiStatus] = useState(null);
  const [aiEngines, setAiEngines] = useState(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);
  const [settings, setSettings] = useState({
    autoGenerate: true,
    temperature: 0.7,
    maxTokens: 500
  });

  // AI Engine configuration
  const [engineConfig, setEngineConfig] = useState({
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'gemma2:2b'
    },
    openai: {
      baseUrl: '',
      apiKey: '',
      model: 'gpt-3.5-turbo'
    }
  });

  // Tools configuration
  const [toolsConfig, setToolsConfig] = useState({
    matrix: {
      enabled: false,
      homeserver: '',
      accessToken: '',
      room: ''
    },
    farcaster: {
      enabled: false,
      signerUuid: '',
      apiKey: ''
    }
  });

  // Load AI status and settings on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem('rati_settings');
        if (stored) {
          setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        }

        const aiStored = localStorage.getItem('rati_ai_settings');
        if (aiStored) {
          const aiSettings = JSON.parse(aiStored);
          if (aiSettings.engines) {
            setEngineConfig(prev => ({ ...prev, ...aiSettings.engines }));
          }
        }

        const toolsStored = localStorage.getItem('rati_tools_settings');
        if (toolsStored) {
          setToolsConfig(prev => ({ ...prev, ...JSON.parse(toolsStored) }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    checkAIStatus();
    loadEngines();
    loadSettings();
  }, []);

  const loadEngines = async () => {
    try {
      const engines = enhancedAIService.getEngines();
      setAiEngines(engines);
    } catch (error) {
      console.error('Failed to load engines:', error);
    }
  };

  const checkAIStatus = async (showToast = false) => {
    setIsCheckingAI(true);
    try {
      const status = await enhancedAIService.getInferenceEndpoint();
      setAiStatus(status);
      
      if (showToast) {
        if (status.available) {
          toast.success(`AI Connected: ${status.model}`);
        } else {
          toast.error('AI not available. Please install and start Ollama.');
        }
      }
    } catch (error) {
      console.error('Failed to check AI status:', error);
      if (showToast) {
        toast.error('Failed to check AI status');
      }
    } finally {
      setIsCheckingAI(false);
    }
  };

  const saveSettings = (newSettings) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      localStorage.setItem('rati_settings', JSON.stringify(updatedSettings));
      toast.success('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { [key]: value };
    saveSettings(newSettings);
  };

  const installOllama = () => {
    window.open('https://ollama.ai', '_blank');
  };

  const handleEngineSwitch = async (engineType) => {
    try {
      await enhancedAIService.switchEngine(engineType);
      setAiStatus(null);
      checkAIStatus();
      loadEngines();
      toast.success(`Switched to ${engineType}`);
    } catch (error) {
      toast.error(`Failed to switch engine: ${error.message}`);
    }
  };

  const handleEngineConfig = async (engineType, config) => {
    try {
      enhancedAIService.configureEngine(engineType, config);
      setEngineConfig(prev => ({
        ...prev,
        [engineType]: { ...prev[engineType], ...config }
      }));
      
      // Save to localStorage
      localStorage.setItem('rati_ai_settings', JSON.stringify({
        engines: { ...engineConfig, [engineType]: { ...engineConfig[engineType], ...config } }
      }));
      
      checkAIStatus();
      toast.success(`${engineType} configured`);
    } catch (error) {
      toast.error(`Failed to configure ${engineType}: ${error.message}`);
    }
  };

  const handleToolsConfig = (toolType, config) => {
    const newConfig = {
      ...toolsConfig,
      [toolType]: { ...toolsConfig[toolType], ...config }
    };
    
    setToolsConfig(newConfig);
    localStorage.setItem('rati_tools_settings', JSON.stringify(newConfig));
    toast.success(`${toolType} settings updated`);
  };

  const testAI = async () => {
    if (!aiStatus?.available) {
      toast.error('AI not available');
      return;
    }

    try {
      const result = await enhancedAIService.generate('Hello! This is a test message.', {
        temperature: settings.temperature,
        maxTokens: 100
      });

      if (result.success) {
        toast.success('AI test successful!');
      } else {
        toast.error(`AI test failed: ${result.error}`);
      }
    } catch {
      toast.error('AI test failed');
    }
  };

  const getActiveEngine = () => {
    if (!aiEngines) return null;
    return Object.entries(aiEngines).find(([, engine]) => engine.active)?.[0] || 'ollama';
  };

  return (
    <div className="settings-interface">
      <div className="settings-header">
        <h2>Settings</h2>
        <p className="settings-subtitle">Configure your RATi experience</p>
      </div>

      <div className="settings-content">
        {/* AI Configuration Section */}
        <div className="settings-section">
          <h3>AI Configuration</h3>
          
          <div className="ai-status-card">
            <div className="status-header">
              <h4>Inference Status</h4>
              <button 
                onClick={() => checkAIStatus(true)}
                disabled={isCheckingAI}
                className="refresh-btn"
              >
                {isCheckingAI ? '⏳' : '🔄'}
              </button>
            </div>
            
            {aiStatus ? (
              <div className={`status-content ${aiStatus.available ? 'connected' : 'disconnected'}`}>
                <div className="status-indicator">
                  <span className={`status-dot ${aiStatus.available ? 'green' : 'red'}`}>●</span>
                  <span className="status-text">
                    {aiStatus.available ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                {aiStatus.available ? (
                  <div className="ai-details">
                    <p><strong>Model:</strong> {aiStatus.model}</p>
                    <p><strong>Endpoint:</strong> {aiStatus.url}</p>
                    <button onClick={testAI} className="test-btn">
                      Test AI
                    </button>
                  </div>
                ) : (
                  <div className="ai-setup">
                    <p>Ollama not detected. Install Ollama for local AI inference.</p>
                    <button onClick={installOllama} className="install-btn">
                      Install Ollama
                    </button>
                    <div className="setup-instructions">
                      <p><strong>Setup Instructions:</strong></p>
                      <ol>
                        <li>Install Ollama from ollama.ai</li>
                        <li>Run: <code>ollama serve</code></li>
                        <li>Pull a model: <code>ollama pull gemma3</code></li>
                        <li>Refresh this page</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="status-loading">
                Checking AI status...
              </div>
            )}
          </div>

          {/* AI Engine Selection */}
          {aiEngines && (
            <div className="engine-selection">
              <h4>AI Engine</h4>
              <div className="engine-options">
                {Object.entries(aiEngines).map(([engineType, engine]) => (
                  <div key={engineType} className="engine-option">
                    <div className="engine-header">
                      <label className="engine-label">
                        <input
                          type="radio"
                          name="aiEngine"
                          value={engineType}
                          checked={engine.active}
                          onChange={() => handleEngineSwitch(engineType)}
                        />
                        <span className="engine-name">
                          {engineType === 'ollama' ? 'Ollama (Local)' : 'OpenAI-Compatible API'}
                        </span>
                        <span className={`engine-status ${engine.available ? 'available' : 'unavailable'}`}>
                          {engine.available ? '✅' : '❌'}
                        </span>
                      </label>
                    </div>
                    
                    {engine.active && (
                      <div className="engine-config">
                        {engineType === 'ollama' ? (
                          <div className="ollama-config">
                            <div className="config-group">
                              <label>Base URL:</label>
                              <input
                                type="text"
                                value={engineConfig.ollama.baseUrl}
                                onChange={(e) => handleEngineConfig('ollama', { baseUrl: e.target.value })}
                                placeholder="http://localhost:11434"
                              />
                            </div>
                            <div className="config-group">
                              <label>Default Model:</label>
                              <input
                                type="text"
                                value={engineConfig.ollama.model}
                                onChange={(e) => handleEngineConfig('ollama', { model: e.target.value })}
                                placeholder="gemma3"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="openai-config">
                            <div className="config-group">
                              <label>API Base URL:</label>
                              <input
                                type="text"
                                value={engineConfig.openai.baseUrl}
                                onChange={(e) => handleEngineConfig('openai', { baseUrl: e.target.value })}
                                placeholder="https://api.openai.com/v1"
                              />
                            </div>
                            <div className="config-group">
                              <label>API Key:</label>
                              <input
                                type="password"
                                value={engineConfig.openai.apiKey}
                                onChange={(e) => handleEngineConfig('openai', { apiKey: e.target.value })}
                                placeholder="sk-..."
                              />
                            </div>
                            <div className="config-group">
                              <label>Model:</label>
                              <input
                                type="text"
                                value={engineConfig.openai.model}
                                onChange={(e) => handleEngineConfig('openai', { model: e.target.value })}
                                placeholder="gpt-3.5-turbo"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Parameters */}
          {aiStatus?.available && (
            <div className="ai-parameters">
              <h4>AI Parameters</h4>
              
              <div className="parameter-group">
                <label>
                  Temperature ({settings.temperature})
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                  />
                </label>
                <span className="parameter-hint">Higher = more creative, Lower = more focused</span>
              </div>

              <div className="parameter-group">
                <label>
                  Max Tokens ({settings.maxTokens})
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={settings.maxTokens}
                    onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value))}
                  />
                </label>
                <span className="parameter-hint">Maximum response length</span>
              </div>

              <div className="parameter-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.autoGenerate}
                    onChange={(e) => handleSettingChange('autoGenerate', e.target.checked)}
                  />
                  Auto-generate character details
                </label>
                <span className="parameter-hint">Automatically generate character profiles using AI</span>
              </div>
            </div>
          )}
        </div>

        {/* Tools Configuration */}
        <div className="settings-section">
          <h3>Tools Integration</h3>
          
          <div className="tools-config">
            {/* Matrix Configuration */}
            <div className="tool-config">
              <div className="tool-header">
                <h4>Matrix</h4>
                <label className="tool-toggle">
                  <input
                    type="checkbox"
                    checked={toolsConfig.matrix.enabled}
                    onChange={(e) => handleToolsConfig('matrix', { enabled: e.target.checked })}
                  />
                  <span>Enable Matrix Integration</span>
                </label>
              </div>
              
              {toolsConfig.matrix.enabled && (
                <div className="tool-settings">
                  <div className="config-group">
                    <label>Homeserver:</label>
                    <input
                      type="text"
                      value={toolsConfig.matrix.homeserver}
                      onChange={(e) => handleToolsConfig('matrix', { homeserver: e.target.value })}
                      placeholder="https://matrix.org"
                    />
                  </div>
                  <div className="config-group">
                    <label>Access Token:</label>
                    <input
                      type="password"
                      value={toolsConfig.matrix.accessToken}
                      onChange={(e) => handleToolsConfig('matrix', { accessToken: e.target.value })}
                      placeholder="syt_..."
                    />
                  </div>
                  <div className="config-group">
                    <label>Room ID:</label>
                    <input
                      type="text"
                      value={toolsConfig.matrix.room}
                      onChange={(e) => handleToolsConfig('matrix', { room: e.target.value })}
                      placeholder="!room:matrix.org"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Farcaster Configuration */}
            <div className="tool-config">
              <div className="tool-header">
                <h4>Farcaster</h4>
                <label className="tool-toggle">
                  <input
                    type="checkbox"
                    checked={toolsConfig.farcaster.enabled}
                    onChange={(e) => handleToolsConfig('farcaster', { enabled: e.target.checked })}
                  />
                  <span>Enable Farcaster Integration</span>
                </label>
              </div>
              
              {toolsConfig.farcaster.enabled && (
                <div className="tool-settings">
                  <div className="config-group">
                    <label>Signer UUID:</label>
                    <input
                      type="text"
                      value={toolsConfig.farcaster.signerUuid}
                      onChange={(e) => handleToolsConfig('farcaster', { signerUuid: e.target.value })}
                      placeholder="your-signer-uuid"
                    />
                  </div>
                  <div className="config-group">
                    <label>API Key:</label>
                    <input
                      type="password"
                      value={toolsConfig.farcaster.apiKey}
                      onChange={(e) => handleToolsConfig('farcaster', { apiKey: e.target.value })}
                      placeholder="your-api-key"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="tools-note">
            <p><strong>Note:</strong> Tools integration allows your AI characters to interact with external platforms. Configure authentication credentials to enable cross-platform communication.</p>
          </div>
        </div>

        {/* Wallet Section */}
        <div className="settings-section">
          <h3>Arweave Wallet</h3>
          
          <div className="wallet-status-card">
            {isConnected ? (
              <div className="wallet-connected">
                <div className="wallet-info">
                  <span className="wallet-indicator">🟢</span>
                  <div className="wallet-details">
                    <p><strong>Address:</strong> {wallet?.address?.slice(0, 8)}...{wallet?.address?.slice(-8)}</p>
                    <p><strong>Balance:</strong> {wallet?.balance || '0'} AR</p>
                  </div>
                </div>
                <p className="wallet-note">
                  Your wallet is connected and ready to create characters on Arweave.
                </p>
              </div>
            ) : (
              <div className="wallet-disconnected">
                <span className="wallet-indicator">🔴</span>
                <div className="wallet-setup">
                  <p>No Arweave wallet connected</p>
                  <div className="setup-instructions">
                    <p><strong>To connect your wallet:</strong></p>
                    <ol>
                      <li>Install <a href="https://www.arconnect.io/" target="_blank" rel="noopener noreferrer">ArConnect</a></li>
                      <li>Create or import your Arweave wallet</li>
                      <li>Click "Connect Wallet" in the header</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* App Information */}
        <div className="settings-section">
          <h3>About RATi</h3>
          
          <div className="app-info">
            <p><strong>Version:</strong> 0.2.0</p>
            <p><strong>Platform:</strong> Arweave + Ollama</p>
            <p><strong>Description:</strong> Decentralized AI character collective</p>
            
            <div className="app-links">
              <a href="https://github.com/ratiplatform/rati" target="_blank" rel="noopener noreferrer">
                📚 Documentation
              </a>
              <a href="https://discord.gg/rati" target="_blank" rel="noopener noreferrer">
                💬 Community
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsInterface;
