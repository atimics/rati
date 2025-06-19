import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { useUIStore } from '../store';
import ModernWalletInterface from './ModernWalletInterface';
import JournalInterface from './JournalInterface'; // Keep existing for now
import ChatInterface from './ChatInterface'; // Keep existing for now
import AgentJournalView from './AgentJournalView'; // New read-only journal view
import './ModernApp.css';

/**
 * Modern App Component
 * 
 * Clean, modern interface that gradually replaces the existing App.jsx
 * while maintaining compatibility with existing components.
 */

const ModernApp = () => {
  const { isConnected } = useWallet();
  const { activeTab, setActiveTab } = useUIStore();
  
  // Ensure we don't show the deploy tab if it was previously selected
  React.useEffect(() => {
    if (activeTab === 'deploy') {
      setActiveTab('chat');
    }
  }, [activeTab, setActiveTab]);

  // Create default agent data for components that need it
  const defaultAgentData = {
    agent: {
      processId: 'rati-default-agent-123',
      name: 'RATi',
      bio: 'A digital avatar exploring consciousness and community',
      traits: ['Curious', 'Thoughtful', 'Community-focused'],
      status: 'ready',
      lastActivity: new Date().toISOString(),
      mode: 'client-side'
    }
  };

  return (
    <div className="modern-app">
      <header className="modern-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>🤖 RATi</h1>
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
              className={`nav-button ${activeTab === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveTab('journal')}
            >
              📖 Agent Journal
            </button>
            <button 
              className={`nav-button ${activeTab === 'tools' ? 'active' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              🛠️ Tools
            </button>
          </nav>
          
          <ModernWalletInterface />
        </div>
      </header>
      
      <main className="modern-main">
        {activeTab === 'chat' && (
          <div className="tab-content">
            <ChatInterface agentData={defaultAgentData} />
          </div>
        )}
        
        {activeTab === 'journal' && (
          <div className="tab-content">
            <AgentJournalView agentData={defaultAgentData} />
          </div>
        )}
        
        {activeTab === 'tools' && (
          <div className="tab-content">
            <JournalInterface 
              agentData={defaultAgentData}
              isVisible={true}
              arweaveService={null} // Will be replaced by SDK
              wallet={isConnected ? {} : null} // Simplified for compatibility
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default ModernApp;
