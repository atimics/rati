import React, { useCallback } from 'react';
import { useRatiStore } from '../store';
import { useWallet } from '../contexts/WalletContext';
import SingleAgentChat from './SingleAgentChat'; // Single agent chat interface
import AgentMemoryView from './AgentMemoryView'; // Modern memory view
import SettingsInterface from './SettingsInterface'; // Settings interface
import ErrorBoundary from './ErrorBoundary'; // Error boundary for crash protection
import './ModernApp.css';

/**
 * Modern App Component
 * 
 * Clean, modern interface that gradually replaces the existing App.jsx
 * while maintaining compatibility with existing components.
 */

const ModernApp = () => {
  const activeTab = useRatiStore((state) => state.activeTab);
  const _setActiveTab = useRatiStore((state) => state.setActiveTab);
  const {
    isConnected,
    isConnecting,
    needsExtension,
    error,
    connect,
    disconnect,
    getFormattedAddress,
    getFormattedBalance
  } = useWallet();

  // Stabilize the setActiveTab function from the store
  const setActiveTab = useCallback((tab) => {
    _setActiveTab(tab);
  }, [_setActiveTab]);
  
  // Ensure we start with a sensible default tab
  React.useEffect(() => {
    if (!['chat', 'memory', 'settings'].includes(activeTab)) {
      setActiveTab('chat');
    }
  }, [activeTab, setActiveTab]);

  return (
    <div className="modern-app">
      <header className="modern-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>
              <div className="rati-logo">
                <img src="/rati-logo-dark.png" alt="RATi Logo" />
              </div>
              RATi
            </h1>
            <p className="tagline">Chat with your Digital Avatar</p>
          </div>
          
          <nav className="modern-nav">
            <button 
              className={`nav-button ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button 
              className={`nav-button ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => setActiveTab('memory')}
            >
              🧠 Memory
            </button>
            <button 
              className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              ⚙️ Settings
            </button>
            
            <div className="arweave-wallet-status">
              {needsExtension ? (
                <a 
                  href="https://www.arconnect.io/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="status-button install-extension"
                  title="Install ArConnect to connect your wallet"
                >
                  <span className="status-indicator warning">⚠️</span>
                  <span className="status-text">Install ArConnect</span>
                </a>
              ) : !isConnected ? (
                <button 
                  className="status-button wallet-connect"
                  onClick={connect}
                  disabled={isConnecting}
                  title="Connect your Arweave wallet"
                >
                  <span className="status-indicator disconnected">●</span>
                  <span className="status-text">
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </span>
                </button>
              ) : (
                <div className="status-button wallet-connected" title={`Connected: ${getFormattedAddress()}\nBalance: ${getFormattedBalance()} AR`}>
                  <span className="status-indicator connected"></span>
                  <div className="wallet-info">
                    <span className="status-text">Arweave</span>
                    <span className="wallet-address">{getFormattedAddress()}</span>
                  </div>
                  <button 
                    className="disconnect-btn"
                    onClick={disconnect}
                    title="Disconnect wallet"
                  >
                    ✕
                  </button>
                </div>
              )}
              {error && (
                <div className="wallet-error-tooltip">
                  {error}
                </div>
              )}
            </div>
          </nav>
          
        </div>
      </header>
      
      <main className="modern-main">
        {activeTab === 'chat' && (
          <div className="tab-content">
            <ErrorBoundary>
              <SingleAgentChat />
            </ErrorBoundary>
          </div>
        )}
        
        {activeTab === 'memory' && (
          <div className="tab-content">
            <ErrorBoundary>
              <AgentMemoryView />
            </ErrorBoundary>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="tab-content">
            <SettingsInterface />
          </div>
        )}
      </main>
    </div>
  );
};

export default ModernApp;
