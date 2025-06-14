import React, { useState, useEffect } from 'react';
import { createDataItemSigner, message, dryrun } from '@permaweb/aoconnect';
import config from './config.js';
import './App.css';
import ChatInterface from './components/ChatInterface.jsx';

// ────────────────────────────────────────────────────────────────────────────────
// Optional helper for local development (mock signer)
// ────────────────────────────────────────────────────────────────────────────────
const _createMockWallet = () => ({
  signer: createDataItemSigner(window.arweaveWallet),
  address: window.arweaveWallet
    ? window.arweaveWallet.getActiveAddress()
    : null,
});

function App() {
  // ─────────────── state ───────────────
  const [activeTab, setActiveTab] = useState('chat');
  const [showMenu, setShowMenu] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [response, setResponse] = useState('');
  const [oracleStatus, setOracleStatus] = useState(null);

  const [deployments, setDeployments] = useState([]);
  const [deploymentLogs, setDeploymentLogs] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [availableScrolls, setAvailableScrolls] = useState([]);
  // const [availableWallets, setAvailableWallets] = useState([]);

  // derived
  const apiHost =
    import.meta.env.VITE_DEPLOYMENT_SERVICE_HOST || window.location.hostname;
  const apiPort = import.meta.env.VITE_DEPLOYMENT_SERVICE_PORT || '3033';
  const apiUrl = `http://${apiHost}:${apiPort}/api`;

  // ─────────────── effects ───────────────
  // Live WebSocket feed
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${apiHost}:${apiPort}`);

    ws.onopen = () => {
      setWsConnected(true);
      console.info('[WS] connected');
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      switch (msg.type) {
        case 'status':
          setDeployments(msg.deployments || []);
          break;
        case 'deployment_started':
          setDeployments((prev) => [...prev, msg.deployment]);
          break;
        case 'deployment_updated':
          setDeployments((prev) =>
            prev.map((d) => (d.id === msg.deployment.id ? msg.deployment : d)),
          );
          break;
        case 'deployment_log':
          setDeploymentLogs((prev) => ({
            ...prev,
            [msg.deploymentId]: [
              ...(prev[msg.deploymentId] || []),
              msg.log,
            ].slice(-100),
          }));
          break;
        case 'deployments_reset':
          setDeployments([]);
          setDeploymentLogs({});
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.warn('[WS] disconnected');
    };

    ws.onerror = (err) => {
      console.error('[WS] error', err);
      setWsConnected(false);
    };

    return () => ws.close();
  }, [apiHost, apiPort]);

  // initial fetches
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setDeployments(await fetchJson(`${apiUrl}/deployments`));
      } catch (err) {
        console.error('Failed to load deployments', err);
      }
      
      try {
        setAvailableScrolls(await fetchJson(`${apiUrl}/scrolls`));
      } catch (err) {
        console.error('Failed to load scrolls', err);
      }
      
      // Wallet loading disabled for now
      // try {
      //   setAvailableWallets(await fetchJson(`${apiUrl}/wallets`));
      // } catch (err) {
      //   console.error('Failed to load wallets', err);
      // }
    };
    
    loadInitialData();
  }, [apiUrl]);

  // ─────────────── helpers ───────────────
  const fetchJson = async (url, opts = {}) => {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

  const handleDeployment = async (type) => {
    try {
      const { deploymentId } = await fetchJson(`${apiUrl}/deploy/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setResponse(`${type} deployment started (ID: ${deploymentId})`);
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    }
  };

  const resetDeployments = async () => {
    try {
      await fetchJson(`${apiUrl}/reset`, { method: 'POST' });
      setResponse('Deployment state reset');
      setDeploymentLogs({});
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    }
  };

  const handlePingOracle = async () => {
    if (!proposalText.trim()) {
      alert('Please enter a proposal.');
      return;
    }

    try {
      const res = await message({
        process: config.processes.oracle,
        signer: createDataItemSigner(window.arweaveWallet),
        tags: [{ name: 'Action', value: 'Ping' }],
        data: proposalText,
      });
      setResponse(`Proposal sent! Message ID: ${res}`);
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    }
  };

  const checkOracleStatus = async () => {
    try {
      const { Messages } = await dryrun({
        process: config.processes.oracle,
        tags: [{ name: 'Action', value: 'Info' }],
        data: 'GetProposals',
      });
      setOracleStatus(JSON.stringify(Messages[0].Data, null, 2));
    } catch (err) {
      console.error('Error checking status', err);
    }
  };

  // utilities
  const formatTs = (ts) =>
    new Date(ts).toLocaleString(undefined, { hour12: false });
  const badge = (s) => `status-badge ${s}`;

  // ─────────────── render ───────────────
  return (
    <div className="App">
      {/* Header */}
      <header className="App-header">
        <h1>{config.app.name} — Deployment Dashboard</h1>
        <p>Manage your decentralized digital avatars and AI agents</p>
        <small>
          Env: {config.app.environment} | Arweave: {config.arweave.protocol}://
          {config.arweave.host}:{config.arweave.port} | WebSocket:{' '}
          {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </small>
      </header>

      {/* Navigation */}
      <nav className="main-nav">
        <div className="nav-brand">
          <img 
            src="/rati-logo-dark.png" 
            alt="RATi" 
            className="nav-logo"
          />
          <span className="nav-title">RATi Platform</span>
        </div>
        
        {activeTab !== 'chat' && (
          <button 
            className="back-to-chat"
            onClick={() => setActiveTab('chat')}
          >
            ← Back to Chat
          </button>
        )}
        
        <div className="nav-menu">
          <button 
            className="menu-toggle"
            onClick={() => setShowMenu(!showMenu)}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          
          {showMenu && (
            <div className="menu-dropdown">
              {[
                ['dashboard', '📊 Dashboard'],
                ['deploy', '🚀 Deploy'],
                ['oracle', '🔮 Oracle'],
                ['logs', '📋 Logs'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={`menu-item ${activeTab === k ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(k);
                    setShowMenu(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Tabs */}
      <main className="tab-content">
        {/* 1. Chat */}
        {activeTab === 'chat' && <ChatInterface />}

        {/* 2. Dashboard */}
        {activeTab === 'dashboard' && (
          <section>
            <div className="status-grid">
              <div className="status-item">
                <h3>Active</h3>
                <p>{deployments.filter((d) => d.status === 'deploying').length}</p>
              </div>
              <div className="status-item">
                <h3>Completed</h3>
                <p>{deployments.filter((d) => d.status === 'completed').length}</p>
              </div>
              <div className="status-item">
                <h3>Failed</h3>
                <p>{deployments.filter((d) => d.status === 'failed').length}</p>
              </div>
              <div className="status-item">
                <h3>Available Scrolls</h3>
                <p>{availableScrolls.length}</p>
              </div>
            </div>

            <div className="card">
              <h2>Recent Deployments</h2>
              {deployments.length === 0 ? (
                <p>No deployments yet. Use the Deploy tab.</p>
              ) : (
                <div className="deployments-list">
                  {deployments
                    .slice(-5)
                    .reverse()
                    .map((d) => (
                      <div key={d.id} className="deployment-item">
                        <div className="deployment-header">
                          <span className="deployment-type">{d.type}</span>
                          <span className={badge(d.status)}>{d.status}</span>
                          <span className="deployment-time">
                            {formatTs(d.startTime)}
                          </span>
                        </div>
                        {d.result && (
                          <div className="deployment-result">
                            {d.result.txid && (
                              <p>
                                Transaction: <code>{d.result.txid}</code>
                              </p>
                            )}
                            {d.result.processId && (
                              <p>
                                Process: <code>{d.result.processId}</code>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Deploy */}
        {activeTab === 'deploy' && (
          <section>
            <div className="deployment-grid">
              <div className="deploy-section">
                <h3>🏛️ Genesis Scroll</h3>
                <p>Deploy founding documents to Arweave.</p>
                <button onClick={() => handleDeployment('genesis')}>
                  Deploy Genesis
                </button>
              </div>

              <div className="deploy-section">
                <h3>🔮 Oracle Council</h3>
                <p>Spawn the oracle process.</p>
                <button onClick={() => handleDeployment('oracle')}>
                  Deploy Oracle
                </button>
              </div>

              <div className="deploy-section">
                <h3>🤖 AI Agent</h3>
                <p>Birth the AI agent (avatar member).</p>
                <button onClick={() => handleDeployment('agent')}>
                  Deploy Agent
                </button>
              </div>

              <div className="deploy-section">
                <h3>🌟 Full Pipeline</h3>
                <p>Genesis → Oracle → Agent.</p>
                <button className="full" onClick={() => handleDeployment('full')}>
                  Deploy All
                </button>
              </div>
            </div>

            <div className="button-grid">
              <button className="reset" onClick={resetDeployments}>
                🔄 Reset State
              </button>
            </div>

            {response && (
              <div className="response-section">
                <h3>Response</h3>
                <pre>{response}</pre>
              </div>
            )}
          </section>
        )}

        {/* 4. Oracle */}
        {activeTab === 'oracle' && (
          <section>
            <div className="card">
              <h2>Oracle Council</h2>
              <textarea
                value={proposalText}
                onChange={(e) => setProposalText(e.target.value)}
                placeholder="Describe your proposal..."
                className="proposal-textarea"
              />
              <div className="button-grid">
                <button onClick={handlePingOracle}>Submit Proposal</button>
                <button onClick={checkOracleStatus}>Check Status</button>
              </div>
              {response && <pre className="response">{response}</pre>}
            </div>

            <div className="card">
              <h2>Oracle Status</h2>
              <button onClick={checkOracleStatus}>Refresh</button>
              {oracleStatus && <pre className="status-log">{oracleStatus}</pre>}
            </div>

            <div className="card">
              <h2>Founding Scrolls (Lore)</h2>
              <p>
                Genesis Scroll TXID:{' '}
                <a
                  href={`${config.arweave.protocol}://${config.arweave.host === 'localhost'
                    ? 'arweave.net'
                    : config.arweave.host}/${config.genesis.txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {config.genesis.txid}
                </a>
              </p>
            </div>
          </section>
        )}

        {/* 5. Logs */}
        {activeTab === 'logs' && (
          <section>
            <div className="card">
              <h2>Deployment Logs</h2>
              {Object.keys(deploymentLogs).length === 0 ? (
                <p>No logs yet. Deploy something!</p>
              ) : (
                <div className="logs-container">
                  {Object.entries(deploymentLogs).map(([id, logs]) => {
                    const d = deployments.find((dep) => dep.id === id);
                    return (
                      <div key={id} className="deployment-logs">
                        <h3>
                          {d ? `${d.type} Deployment` : 'Unknown Deployment'}
                          <span className={badge(d?.status || 'unknown')}>
                            {d?.status || 'unknown'}
                          </span>
                        </h3>
                        {logs.map((log, i) => (
                          <div key={i} className={`log-entry ${log.level}`}>
                            <span className="log-timestamp">
                              {formatTs(log.timestamp)}
                            </span>
                            <span className="log-level">{log.level}</span>
                            <span className="log-message">{log.message}</span>
                            {log.data && (
                              <div className="log-data">
                                {JSON.stringify(log.data, null, 2)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
