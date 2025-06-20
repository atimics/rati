import React, { useState, useEffect, useCallback } from 'react';
import CollectiveService from '../services/CollectiveService';
import './AgentMemoryView.css';

/**
 * Modern Agent Memory View Component
 * 
 * A clean, modern interface for viewing the agent's memory and journal entries
 * Focused on the single-agent experience with better UX
 */

// Helper functions
const extractKeywords = (messages) => {
  const text = messages.map(m => m.content).join(' ').toLowerCase();
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'i', 'you', 'me', 'my', 'your', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'that', 'this', 'it', 'its'];
  const words = text.match(/\b\w{3,}\b/g) || [];
  const keywords = words
    .filter(word => !commonWords.includes(word))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
  
  return Object.entries(keywords)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
};

const extractMainTopic = (text) => {
  const topics = ['programming', 'AI', 'technology', 'science', 'art', 'music', 'life', 'philosophy', 'gaming', 'food'];
  const lowerText = text.toLowerCase();
  return topics.find(topic => lowerText.includes(topic)) || 'general topics';
};

const analyzeMood = (messages) => {
  const text = messages.map(m => m.content).join(' ').toLowerCase();
  if (text.includes('happy') || text.includes('excited') || text.includes('great')) return 'positive';
  if (text.includes('sad') || text.includes('worried') || text.includes('problem')) return 'concerned';
  if (text.includes('think') || text.includes('analyze') || text.includes('consider')) return 'analytical';
  return 'neutral';
};

const generateMemoryEntries = (history) => {
  if (!Array.isArray(history)) return [];

  const entries = [];
  
  // Group conversations by date
  const conversations = {};
  history.forEach(message => {
    const date = new Date(message.timestamp).toDateString();
    if (!conversations[date]) {
      conversations[date] = [];
    }
    conversations[date].push(message);
  });

  // Create memory entries for each conversation
  Object.entries(conversations).forEach(([date, messages]) => {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    if (userMessages.length > 0) {
      entries.push({
        id: `conversation-${date}`,
        type: 'conversation',
        title: `Conversation on ${date}`,
        summary: `${userMessages.length} user messages, ${assistantMessages.length} responses`,
        timestamp: messages[0]?.timestamp || new Date().toISOString(),
        content: messages,
        keywords: extractKeywords(messages),
        mood: analyzeMood(messages)
      });
    }
  });

  // Add thought entries based on assistant responses
  history.filter(m => m.role === 'assistant').forEach((message, index) => {
    if (message.content && message.content.length > 100) {
      entries.push({
        id: `thought-${index}`,
        type: 'thought',
        title: `Thought: ${message.content.substring(0, 50)}...`,
        summary: `Generated response about ${extractMainTopic(message.content)}`,
        timestamp: message.timestamp,
        content: message.content,
        keywords: extractKeywords([message]),
        mood: 'thoughtful'
      });
    }
  });

  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const AgentMemoryView = () => {
  const [memoryEntries, setMemoryEntries] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, conversations, thoughts, actions

  // Get agent data
  const agent = {
    id: 'rati-agent',
    name: 'RATi Agent',
    bio: 'Ready, Alert, Thinking, and Investigating!'
  };

  const loadMemoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load chat history
      const history = CollectiveService.getAgentJournal(agent.id);
      setChatHistory(Array.isArray(history) ? history : []);

      // Generate memory entries from chat history
      const entries = generateMemoryEntries(history);
      setMemoryEntries(entries);

    } catch (err) {
      console.error('Error loading memory data:', err);
      setError('Failed to load memory data');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    loadMemoryData();
  }, [loadMemoryData]);

  const filteredEntries = memoryEntries.filter(entry => {
    const matchesSearch = searchTerm === '' || 
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterType === 'all' || entry.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'conversation': return '💬';
      case 'thought': return '💭';
      case 'action': return '⚡';
      default: return '📝';
    }
  };

  const getMoodColor = (mood) => {
    switch (mood) {
      case 'positive': return 'var(--rati-success)';
      case 'concerned': return 'var(--rati-warning)';
      case 'analytical': return 'var(--rati-purple)';
      default: return 'var(--rati-text-secondary)';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const clearMemory = async () => {
    if (window.confirm('Are you sure you want to clear all memory data? This action cannot be undone.')) {
      try {
        CollectiveService.saveAgentJournal(agent.id, []);
        setMemoryEntries([]);
        setChatHistory([]);
      } catch (err) {
        console.error('Error clearing memory:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="memory-view">
        <div className="loading-state">
          <div className="loading-spinner">🧠</div>
          <h3>Loading Memory...</h3>
          <p>Accessing agent memories and experiences</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="memory-view">
        <div className="error-state">
          <h3>Memory Access Error</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={loadMemoryData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="memory-view">
      {/* Header */}
      <div className="memory-header">
        <div className="header-info">
          <h2>🧠 Agent Memory</h2>
          <p>Explore {agent.name}'s thoughts, conversations, and experiences</p>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={loadMemoryData} title="Refresh memory">
            🔄
          </button>
          <button className="clear-btn" onClick={clearMemory} title="Clear all memory">
            🗑️
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="memory-stats">
        <div className="stat-card">
          <span className="stat-number">{memoryEntries.length}</span>
          <span className="stat-label">Memory Entries</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{chatHistory.length}</span>
          <span className="stat-label">Chat Messages</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{memoryEntries.filter(e => e.type === 'conversation').length}</span>
          <span className="stat-label">Conversations</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{memoryEntries.filter(e => e.type === 'thought').length}</span>
          <span className="stat-label">Thoughts</span>
        </div>
      </div>

      {/* Controls */}
      <div className="memory-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search memories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filterType === 'conversation' ? 'active' : ''}`}
            onClick={() => setFilterType('conversation')}
          >
            💬 Conversations
          </button>
          <button 
            className={`filter-tab ${filterType === 'thought' ? 'active' : ''}`}
            onClick={() => setFilterType('thought')}
          >
            💭 Thoughts
          </button>
        </div>
      </div>

      {/* Memory Entries */}
      <div className="memory-content">
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧠</div>
            <h3>No Memories Found</h3>
            <p>
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter settings.'
                : 'Start chatting with the agent to create memories!'}
            </p>
          </div>
        ) : (
          <div className="memory-list">
            {filteredEntries.map((entry) => (
              <div 
                key={entry.id} 
                className={`memory-entry ${selectedEntry === entry.id ? 'selected' : ''}`}
                onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
              >
                <div className="entry-header">
                  <div className="entry-type">
                    <span className="type-icon">{getTypeIcon(entry.type)}</span>
                    <span className="type-text">{entry.type}</span>
                  </div>
                  <div className="entry-mood" style={{ color: getMoodColor(entry.mood) }}>
                    {entry.mood}
                  </div>
                </div>
                <div className="entry-content">
                  <h4 className="entry-title">{entry.title}</h4>
                  <p className="entry-summary">{entry.summary}</p>
                  <div className="entry-meta">
                    <span className="entry-time">{formatTimestamp(entry.timestamp)}</span>
                    <div className="entry-keywords">
                      {entry.keywords.slice(0, 3).map(keyword => (
                        <span key={keyword} className="keyword-tag">{keyword}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedEntry === entry.id && (
                  <div className="entry-details">
                    {entry.type === 'conversation' && Array.isArray(entry.content) ? (
                      <div className="conversation-details">
                        {entry.content.map((message, index) => (
                          <div key={index} className={`message-preview ${message.role}`}>
                            <span className="role">{message.role === 'user' ? 'User' : 'Agent'}:</span>
                            <span className="content">{message.content}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="thought-details">
                        <p>{entry.content}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentMemoryView;
