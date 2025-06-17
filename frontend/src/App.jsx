import React, { useState, useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface.jsx';
import WalletInterface from './components/WalletInterface.jsx';
import DeploymentInterface from './components/DeploymentInterface.jsx';
import JournalInterface from './components/JournalInterface.jsx';
import AgentProcessorInterface from './components/AgentProcessorInterface.jsx';

function App() {
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [appBundle, setAppBundle] = useState(null);
  const [oracleData, setOracleData] = useState(null);

  // API configuration
  const apiHost = import.meta.env.VITE_DEPLOYMENT_SERVICE_HOST || window.location.hostname;
  const apiPort = import.meta.env.VITE_DEPLOYMENT_SERVICE_PORT || '3032';
  const apiUrl = `http://${apiHost}:${apiPort}`;

  // Load agent data and oracle status on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Load seed data
        const seedResponse = await fetch(`${apiUrl}/api/seed`);
        if (!seedResponse.ok) {
          throw new Error(`HTTP ${seedResponse.status}: ${seedResponse.statusText}`);
        }
        const seedData = await seedResponse.json();
        setAgentData(seedData);

        // Load oracle data if available
        if (seedData.oracle?.processId) {
          try {
            const oracleResponse = await fetch(`${apiUrl}/api/oracle/status?oracleId=${seedData.oracle.processId}`);
            if (oracleResponse.ok) {
              const oracleStatus = await oracleResponse.json();
              setOracleData(oracleStatus);
            }
          } catch (oracleError) {
            console.warn('Could not load oracle data:', oracleError);
          }
        }

        setError(null);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [apiUrl]);

  // Create app bundle for deployment
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const createBundle = () => {
        const html = document.documentElement.outerHTML;
        setAppBundle(html);
      };
      // Delay to ensure the page is fully rendered
      setTimeout(createBundle, 2000);
    }
  }, [agentData]);

  const handleWalletConnect = (walletConnection) => {
    setWallet(walletConnection);
  };

  const handleWalletDisconnect = () => {
    setWallet(null);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your RATi agent...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h2>⚠️ Connection Error</h2>
          <p>Unable to connect to your RATi agent:</p>
          <code>{error}</code>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 RATi Agent</h1>
          {agentData?.agent && (
            <div className="agent-info">
              <span className="agent-status">●</span>
              <span>Process: {agentData.agent.processId.slice(0, 8)}...</span>
              {oracleData && (
                <span className="oracle-status">
                  🔮 Oracle: {oracleData.recentActivity || 'unknown'}
                </span>
              )}
            </div>
          )}
        </div>
        <nav className="app-nav">
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
            📖 Journal
          </button>
          <button 
            className={`nav-button ${activeTab === 'processor' ? 'active' : ''}`}
            onClick={() => setActiveTab('processor')}
          >
            ⚙️ Processor
          </button>
          <button 
            className={`nav-button ${activeTab === 'deploy' ? 'active' : ''}`}
            onClick={() => setActiveTab('deploy')}
          >
            🚀 Deploy
          </button>
        </nav>
      </header>
      
      <main className="app-main">
        {activeTab === 'chat' && (
          <ChatInterface agentData={agentData} apiUrl={apiUrl} />
        )}
        
        {activeTab === 'journal' && (
          <JournalInterface 
            agentData={agentData} 
            apiUrl={apiUrl}
            oracleData={oracleData}
          />
        )}
        
        {activeTab === 'processor' && (
          <AgentProcessorInterface 
            apiUrl={apiUrl}
            oracleData={oracleData}
            agentData={agentData}
          />
        )}
        
        {activeTab === 'deploy' && (
          <div className="deployment-tab">
            <WalletInterface 
              onWalletConnect={handleWalletConnect}
              onWalletDisconnect={handleWalletDisconnect}
            />
            <DeploymentInterface 
              wallet={wallet}
              appData={appBundle}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
