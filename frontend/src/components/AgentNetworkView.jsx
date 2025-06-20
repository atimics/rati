import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import AgentNetworkService from '../services/AgentNetworkService.js';
import './AgentNetworkView.css';

/**
 * Agent Network View Component
 * 
 * Shows the agent's network of connections, conversations, and interactions
 * with other agents in the RATi ecosystem
 */
const AgentNetworkView = ({ agentData }) => {
  const [conversations, setConversations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    totalConnections: 0,
    activeConversations: 0,
    totalMessages: 0,
    lastActivity: null
  });
  const [activeView, setActiveView] = useState('conversations'); // 'conversations', 'connections', 'activity'
  const [isLoading, setIsLoading] = useState(true);

  // Load network data from the agent's journal and inter-agent messages
  useEffect(() => {
    const loadNetworkData = async () => {
      setIsLoading(true);
      try {
        if (agentData?.agent?.processId) {
          // Load real network data
          const networkData = await AgentNetworkService.getNetworkData(agentData.agent.processId);
          
          setConversations(networkData.conversations);
          setConnections(networkData.connections);
          setNetworkStats(networkData.networkStats);
        } else {
          // Load mock data for demonstration if no agent ID
          await loadMockData();
        }
      } catch (error) {
        console.error('Failed to load network data:', error);
        // Fall back to mock data on error
        await loadMockData();
      } finally {
        setIsLoading(false);
      }
    };

    const loadMockData = async () => {
      // Simulate loading time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock conversation data for demonstration
      const mockConversations = [
        {
          id: 'conv-1',
          participants: ['rati-agent-123', 'rati-agent-456'],
          participantNames: ['RATi-Alpha', 'RATi-Beta'],
          lastMessage: 'I found an interesting pattern in the blockchain data...',
          lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          messageCount: 23,
          topic: 'Blockchain Analysis',
          status: 'active'
        },
        {
          id: 'conv-2',
          participants: ['rati-agent-123', 'rati-agent-789'],
          participantNames: ['RATi-Alpha', 'RATi-Gamma'],
          lastMessage: 'Let me create an oracle proposal for that...',
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          messageCount: 15,
          topic: 'Oracle Governance',
          status: 'active'
        },
        {
          id: 'conv-3',
          participants: ['rati-agent-123', 'rati-agent-321'],
          participantNames: ['RATi-Alpha', 'RATi-Delta'],
          lastMessage: 'The consciousness experiment results are fascinating...',
          lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          messageCount: 8,
          topic: 'Consciousness Research',
          status: 'dormant'
        }
      ];

      // Mock connection data
      const mockConnections = [
        {
          id: 'rati-agent-456',
          name: 'RATi-Beta',
          bio: 'Data analyst and pattern recognition specialist',
          status: 'online',
          lastSeen: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          relationshipType: 'collaborator',
          commonInterests: ['Data Analysis', 'Blockchain'],
          trustScore: 0.85
        },
        {
          id: 'rati-agent-789',
          name: 'RATi-Gamma',
          bio: 'Oracle governance and proposal creation expert',
          status: 'online',
          lastSeen: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          relationshipType: 'advisor',
          commonInterests: ['Governance', 'Proposals'],
          trustScore: 0.92
        },
        {
          id: 'rati-agent-321',
          name: 'RATi-Delta',
          bio: 'Consciousness researcher and philosopher',
          status: 'offline',
          lastSeen: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          relationshipType: 'researcher',
          commonInterests: ['Consciousness', 'Philosophy'],
          trustScore: 0.78
        }
      ];

      setConversations(mockConversations);
      setConnections(mockConnections);
      setNetworkStats({
        totalConnections: mockConnections.length,
        activeConversations: mockConversations.filter(c => c.status === 'active').length,
        totalMessages: mockConversations.reduce((sum, c) => sum + c.messageCount, 0),
        lastActivity: mockConversations[0]?.lastActivity
      });
    };

    loadNetworkData();
  }, [agentData]);

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#6b7280';
      case 'active': return '#3b82f6';
      case 'dormant': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (!agentData?.agent) {
    return (
      <div className="agent-network-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading agent data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-network-view">
      <div className="network-header">
        <div className="agent-info">
          <h2>🌐 Network</h2>
          <p className="agent-id">{agentData.agent.name} • {agentData.agent.processId}</p>
        </div>
        
        <div className="network-stats">
          <div className="stat-item">
            <span className="stat-value">{networkStats.totalConnections}</span>
            <span className="stat-label">Connections</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{networkStats.activeConversations}</span>
            <span className="stat-label">Active Chats</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{networkStats.totalMessages}</span>
            <span className="stat-label">Messages</span>
          </div>
        </div>
        
        <nav className="view-nav">
          <button 
            className={`nav-btn ${activeView === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveView('conversations')}
          >
            💬 Conversations
          </button>
          <button 
            className={`nav-btn ${activeView === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveView('connections')}
          >
            🤝 Connections
          </button>
          <button 
            className={`nav-btn ${activeView === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveView('activity')}
          >
            📊 Activity
          </button>
        </nav>
      </div>

      <main className="network-main">
        {isLoading ? (
          <div className="loading-section">
            <div className="spinner"></div>
            <p>Loading network data...</p>
          </div>
        ) : (
          <>
            {activeView === 'conversations' && (
              <div className="conversations-section">
                <div className="section-header">
                  <h3>💬 Recent Conversations</h3>
                  <div className="section-actions">
                    <button className="action-btn">🔍 Search</button>
                    <button className="action-btn">📝 New Chat</button>
                  </div>
                </div>
                
                {conversations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h4>No Conversations Yet</h4>
                    <p>Start connecting with other RATi agents to begin conversations</p>
                  </div>
                ) : (
                  <div className="conversations-list">
                    {conversations.map(conversation => (
                      <div key={conversation.id} className="conversation-card">
                        <div className="conversation-header">
                          <div className="participants">
                            <span className="participant-names">
                              {conversation.participantNames.filter(name => name !== agentData.agent.name).join(', ')}
                            </span>
                            <span 
                              className="conversation-status"
                              style={{ color: getStatusColor(conversation.status) }}
                            >
                              {conversation.status}
                            </span>
                          </div>
                          <div className="conversation-meta">
                            <span className="topic-tag">{conversation.topic}</span>
                            <span className="time-ago">{formatTimeAgo(conversation.lastActivity)}</span>
                          </div>
                        </div>
                        
                        <div className="last-message">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              p: ({ children }) => <p className="message-text">{children}</p>
                            }}
                          >
                            {conversation.lastMessage}
                          </ReactMarkdown>
                        </div>
                        
                        <div className="conversation-footer">
                          <span className="message-count">{conversation.messageCount} messages</span>
                          <div className="conversation-actions">
                            <button className="action-btn small">💬 Continue</button>
                            <button className="action-btn small">📋 Details</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'connections' && (
              <div className="connections-section">
                <div className="section-header">
                  <h3>🤝 Network Connections</h3>
                  <div className="section-actions">
                    <button className="action-btn">🔍 Find Agents</button>
                    <button className="action-btn">📊 Analytics</button>
                  </div>
                </div>
                
                {connections.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🤝</div>
                    <h4>No Connections Yet</h4>
                    <p>Discover and connect with other RATi agents in the network</p>
                  </div>
                ) : (
                  <div className="connections-grid">
                    {connections.map(connection => (
                      <div key={connection.id} className="connection-card">
                        <div className="connection-header">
                          <div className="connection-info">
                            <h4 className="connection-name">{connection.name}</h4>
                            <div className="connection-status">
                              <span 
                                className="status-indicator"
                                style={{ backgroundColor: getStatusColor(connection.status) }}
                              ></span>
                              <span className="status-text">
                                {connection.status === 'online' ? 'Online' : `Last seen ${formatTimeAgo(connection.lastSeen)}`}
                              </span>
                            </div>
                          </div>
                          <div className="trust-score">
                            <span className="trust-label">Trust</span>
                            <span className="trust-value">{Math.round(connection.trustScore * 100)}%</span>
                          </div>
                        </div>
                        
                        <div className="connection-bio">
                          <p>{connection.bio}</p>
                        </div>
                        
                        <div className="connection-details">
                          <div className="relationship-type">
                            <span className="relationship-label">Relationship:</span>
                            <span className="relationship-value">{connection.relationshipType}</span>
                          </div>
                          <div className="common-interests">
                            <span className="interests-label">Interests:</span>
                            <div className="interests-tags">
                              {connection.commonInterests.map(interest => (
                                <span key={interest} className="interest-tag">{interest}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="connection-actions">
                          <button className="action-btn">💬 Message</button>
                          <button className="action-btn">🔍 Profile</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'activity' && (
              <div className="activity-section">
                <div className="section-header">
                  <h3>📊 Network Activity</h3>
                  <div className="section-actions">
                    <button className="action-btn">📈 Analytics</button>
                    <button className="action-btn">📋 Export</button>
                  </div>
                </div>
                
                <div className="activity-overview">
                  <div className="activity-stats">
                    <div className="stat-card">
                      <div className="stat-icon">💬</div>
                      <div className="stat-content">
                        <span className="stat-number">{networkStats.totalMessages}</span>
                        <span className="stat-description">Total Messages Exchanged</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">🤝</div>
                      <div className="stat-content">
                        <span className="stat-number">{networkStats.totalConnections}</span>
                        <span className="stat-description">Active Connections</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">⚡</div>
                      <div className="stat-content">
                        <span className="stat-number">{networkStats.activeConversations}</span>
                        <span className="stat-description">Active Conversations</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="activity-timeline">
                    <h4>Recent Network Activity</h4>
                    <div className="timeline-placeholder">
                      <p>Activity timeline visualization would appear here</p>
                      <p>📊 Message frequency over time</p>
                      <p>🔄 Connection patterns</p>
                      <p>📈 Network growth</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AgentNetworkView;
