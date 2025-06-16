import React, { useState, useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface.jsx';

function App() {
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API configuration
  const apiHost = import.meta.env.VITE_DEPLOYMENT_SERVICE_HOST || window.location.hostname;
  const apiPort = import.meta.env.VITE_DEPLOYMENT_SERVICE_PORT || '3032';
  const apiUrl = `http://${apiHost}:${apiPort}/api`;

  // Load agent data on mount
  useEffect(() => {
    const loadAgentData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiUrl}/seed`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setAgentData(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load agent data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAgentData();
  }, [apiUrl]);

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
            </div>
          )}
        </div>
      </header>
      
      <main className="app-main">
        <ChatInterface agentData={agentData} apiUrl={apiUrl} />
      </main>
    </div>
  );
}

export default App;
