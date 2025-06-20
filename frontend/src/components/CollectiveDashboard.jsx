import React, { useState, useEffect, useCallback } from 'react';
import collectiveService from '../services/CollectiveService';
import { useWallet } from '../contexts/WalletContext';
import toast from 'react-hot-toast';
import './CollectiveDashboard.css';

/**
 * Collective Dashboard Component
 * 
 * Shows the RATi collective state:
 * - Character leaderboard (sorted by burn address balances)
 * - Active tabs coordination
 * - Community activity feed
 * - Inter-tab communication
 */

const CollectiveDashboard = () => {
  const { isConnected } = useWallet();
  const [leaderboard, setLeaderboard] = useState([]);
  const [_collectiveState, setCollectiveState] = useState({});
  const [activeTabs, setActiveTabs] = useState({});
  const [communityActivity, setCommunityActivity] = useState([]);
  const [selectedTab, setSelectedTab] = useState('leaderboard');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [userSettings, setUserSettings] = useState({});

  // Define all callback functions first
  const loadActiveTabs = useCallback(async () => {
    try {
      const result = await collectiveService.executeTool('collective-coordination', 'get-active-tabs');
      if (result.success) {
        setActiveTabs(result.tabs);
      }
    } catch (error) {
      console.error('Error loading active tabs:', error);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      // Load leaderboard
      const leaderboardData = collectiveService.getLeaderboard();
      setLeaderboard(leaderboardData);

      // Load collective state
      const state = collectiveService.getCollectiveState();
      setCollectiveState(state);

      // Load active tabs
      loadActiveTabs();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  }, [loadActiveTabs]);

  const loadUserSettings = useCallback(() => {
    const settings = collectiveService.getUserSettings();
    setUserSettings(settings);
  }, []);

  const handleIncomingBroadcast = useCallback((broadcast) => {
    // Add to community activity feed
    const activity = {
      id: Date.now(),
      type: 'broadcast',
      from: broadcast.from,
      timestamp: broadcast.timestamp,
      message: broadcast.data,
      received: Date.now()
    };

    setCommunityActivity(prev => [activity, ...prev.slice(0, 49)]); // Keep last 50
    toast.success(`Message from tab ${broadcast.from.substring(0, 8)}`);
  }, []);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
    loadUserSettings();
  }, [loadDashboardData, loadUserSettings]);

  // Listen for collective state changes
  useEffect(() => {
    const handleCollectiveChange = (event) => {
      setCollectiveState(event.detail);
      loadActiveTabs();
    };

    window.addEventListener('collectiveStateChange', handleCollectiveChange);
    return () => {
      window.removeEventListener('collectiveStateChange', handleCollectiveChange);
    };
  }, [loadActiveTabs]);

  // Listen for broadcasts from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'rati_broadcast') {
        const broadcast = JSON.parse(e.newValue);
        handleIncomingBroadcast(broadcast);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleIncomingBroadcast]);

  const handleBroadcastMessage = async () => {
    if (!broadcastMessage.trim()) {
      toast.error('Please enter a message to broadcast');
      return;
    }

    try {
      const result = await collectiveService.executeTool('collective-coordination', 'broadcast-message', {
        message: broadcastMessage
      });

      if (result.success) {
        toast.success('Message broadcast to collective');
        setBroadcastMessage('');
      } else {
        toast.error('Failed to broadcast message');
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      toast.error('Failed to broadcast message');
    }
  };

  const handleUpdateBalances = async () => {
    try {
      const result = await collectiveService.updateCharacterBalances(userSettings.solanaRpcUrl);
      if (result.success) {
        toast.success(result.message);
        loadDashboardData(); // Reload to show updated data
      } else {
        toast.error('Failed to update balances');
      }
    } catch (error) {
      console.error('Balance update error:', error);
      toast.error('Failed to update balances');
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatTimeSince = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const renderLeaderboard = () => (
    <div className="leaderboard-section">
      <div className="section-header">
        <h3>Character Leaderboard</h3>
        <button className="btn-refresh" onClick={handleUpdateBalances}>
          🔄 Update Balances
        </button>
      </div>
      
      {leaderboard.length === 0 ? (
        <div className="empty-state">
          <p>No characters registered yet</p>
          <p>Create your first character to join the leaderboard!</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          {leaderboard.map((character, index) => (
            <div key={character.id} className="leaderboard-item">
              <div className="rank">#{index + 1}</div>
              <div className="character-info">
                <div className="character-name">{character.definition.name}</div>
                <div className="character-address">{formatAddress(character.burnAddress)}</div>
              </div>
              <div className="character-stats">
                <div className="balance">{character.balance} SOL</div>
                <div className="status">{character.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderActiveTabs = () => (
    <div className="tabs-section">
      <div className="section-header">
        <h3>Active Collective Members</h3>
        <span className="tab-count">{Object.keys(activeTabs).length} active</span>
      </div>
      
      {Object.keys(activeTabs).length === 0 ? (
        <div className="empty-state">
          <p>No other tabs active</p>
        </div>
      ) : (
        <div className="tabs-list">
          {Object.entries(activeTabs).map(([tabId, tab]) => (
            <div key={tabId} className="tab-item">
              <div className="tab-id">{tabId.substring(0, 8)}</div>
              <div className="tab-info">
                <div className="tab-character">
                  {tab.character ? tab.character.name : 'No character loaded'}
                </div>
                <div className="tab-status">{tab.status}</div>
              </div>
              <div className="tab-timing">
                <div className="last-seen">{formatTimeSince(tab.lastHeartbeat)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCommunityActivity = () => (
    <div className="activity-section">
      <div className="section-header">
        <h3>Community Activity</h3>
      </div>
      
      <div className="broadcast-input">
        <input
          type="text"
          value={broadcastMessage}
          onChange={(e) => setBroadcastMessage(e.target.value)}
          placeholder="Broadcast message to collective..."
          onKeyPress={(e) => e.key === 'Enter' && handleBroadcastMessage()}
        />
        <button onClick={handleBroadcastMessage}>Send</button>
      </div>

      {communityActivity.length === 0 ? (
        <div className="empty-state">
          <p>No recent activity</p>
        </div>
      ) : (
        <div className="activity-feed">
          {communityActivity.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-header">
                <span className="activity-from">Tab {activity.from.substring(0, 8)}</span>
                <span className="activity-time">{formatTime(activity.timestamp)}</span>
              </div>
              <div className="activity-content">{activity.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Collective Settings</h3>
      </div>
      
      <div className="settings-form">
        <div className="form-group">
          <label>Solana RPC URL</label>
          <input
            type="url"
            value={userSettings.solanaRpcUrl || ''}
            onChange={(e) => {
              const newSettings = { ...userSettings, solanaRpcUrl: e.target.value };
              setUserSettings(newSettings);
              collectiveService.updateUserSettings(newSettings);
            }}
            placeholder="https://api.mainnet-beta.solana.com"
          />
        </div>
        
        <div className="form-group">
          <label>Inference Endpoint</label>
          <input
            type="url"
            value={userSettings.inferenceEndpoint || ''}
            onChange={(e) => {
              const newSettings = { ...userSettings, inferenceEndpoint: e.target.value };
              setUserSettings(newSettings);
              collectiveService.updateUserSettings(newSettings);
            }}
            placeholder="https://api.openai.com/v1/chat/completions"
          />
        </div>
        
        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            value={userSettings.apiKey || ''}
            onChange={(e) => {
              const newSettings = { ...userSettings, apiKey: e.target.value };
              setUserSettings(newSettings);
              collectiveService.updateUserSettings(newSettings);
            }}
            placeholder="Your API key"
          />
        </div>
        
        <div className="form-group">
          <label>Preferred Model</label>
          <select
            value={userSettings.preferredModel || 'gpt-4'}
            onChange={(e) => {
              const newSettings = { ...userSettings, preferredModel: e.target.value };
              setUserSettings(newSettings);
              collectiveService.updateUserSettings(newSettings);
            }}
          >
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            <option value="gemma3">Gemma 2</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="collective-dashboard">
      <div className="dashboard-header">
        <h2>RATi Collective Dashboard</h2>
        <div className="collective-stats">
          <div className="stat">
            <span className="stat-value">{leaderboard.length}</span>
            <span className="stat-label">Characters</span>
          </div>
          <div className="stat">
            <span className="stat-value">{Object.keys(activeTabs).length}</span>
            <span className="stat-label">Active Tabs</span>
          </div>
          <div className="stat">
            <span className="stat-value">{isConnected ? 'Connected' : 'Disconnected'}</span>
            <span className="stat-label">Wallet</span>
          </div>
        </div>
      </div>

      <div className="dashboard-nav">
        <button
          className={`nav-tab ${selectedTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setSelectedTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`nav-tab ${selectedTab === 'tabs' ? 'active' : ''}`}
          onClick={() => setSelectedTab('tabs')}
        >
          🌐 Active Tabs
        </button>
        <button
          className={`nav-tab ${selectedTab === 'activity' ? 'active' : ''}`}
          onClick={() => setSelectedTab('activity')}
        >
          💬 Activity
        </button>
        <button
          className={`nav-tab ${selectedTab === 'settings' ? 'active' : ''}`}
          onClick={() => setSelectedTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>

      <div className="dashboard-content">
        {selectedTab === 'leaderboard' && renderLeaderboard()}
        {selectedTab === 'tabs' && renderActiveTabs()}
        {selectedTab === 'activity' && renderCommunityActivity()}
        {selectedTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
};

export default CollectiveDashboard;
