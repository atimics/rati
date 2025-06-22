import React, { useState, useEffect, useCallback } from 'react';
import CollectiveService from '../services/CollectiveService';
import MemoryService from '../services/MemoryService';
import ArweaveService from '../services/ArweaveService';
import AutoMemoryProcessor from './AutoMemoryProcessor';
import MemoryInsightPanel from './MemoryInsightPanel';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessTime, setLastProcessTime] = useState(null);
  const [arweaveStatus, setArweaveStatus] = useState('disconnected');
  const [insightPanelVisible, setInsightPanelVisible] = useState(false);

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

      // Load chat history from CollectiveService
      const history = CollectiveService.getAgentJournal(agent.id);
      setChatHistory(Array.isArray(history) ? history : []);

      // Load actual memory entries from MemoryService
      const actualMemories = MemoryService.getMemoryEntries(agent.id);
      
      // If we have chat history but no processed memories, suggest processing
      if (history && history.length > 0 && actualMemories.length === 0) {
        // Create a suggestion entry
        const suggestionEntry = {
          id: 'suggestion',
          type: 'suggestion',
          title: '💡 Process Chat History into Memories',
          summary: `You have ${history.length} chat messages that could be processed into meaningful memories.`,
          timestamp: new Date().toISOString(),
          content: history,
          keywords: ['processing', 'memories', 'chat'],
          mood: 'hopeful'
        };
        setMemoryEntries([suggestionEntry]);
      } else {
        // Generate memory entries from both stored memories and legacy chat history
        const combinedEntries = [];
        
        // Add actual processed memories
        actualMemories.forEach(memory => {
          combinedEntries.push({
            id: memory.id,
            type: memory.type,
            title: memory.title,
            summary: memory.summary,
            timestamp: memory.timestamp,
            content: memory,
            keywords: memory.keywords || [],
            mood: memory.mood || 'neutral'
          });
        });
        
        // Add legacy entries from chat history if no processed memories exist
        if (actualMemories.length === 0) {
          const legacyEntries = generateMemoryEntries(history);
          combinedEntries.push(...legacyEntries);
        }
        
        setMemoryEntries(combinedEntries);
      }

      // Check Arweave connection status
      try {
        await ArweaveService.connectWallet();
        setArweaveStatus('connected');
      } catch {
        setArweaveStatus('disconnected');
      }

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

  // Callback for auto memory processor
  const handleMemoryProcessed = useCallback((count) => {
    console.log(`Auto-processed ${count} memory chunks`);
    // Reload memory data to show new memories
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
        // Clear memories from MemoryService
        MemoryService.clearMemories(agent.id);
        
        // Clear chat history from CollectiveService
        CollectiveService.saveAgentJournal(agent.id, []);
        
        setMemoryEntries([]);
        setChatHistory([]);
        setLastProcessTime(null);
        
        alert('All memory data cleared successfully.');
        
      } catch (err) {
        console.error('Error clearing memory:', err);
        setError('Failed to clear memory data');
      }
    }
  };

  // Process chat history into memories
  const processIntoMemories = async () => {
    if (!chatHistory || chatHistory.length === 0) {
      setError('No chat history to process');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Group messages into conversation chunks
      const conversationChunks = groupMessagesIntoConversations(chatHistory);
      
      let processedCount = 0;
      for (const chunk of conversationChunks) {
        try {
          await MemoryService.processConversationIntoMemory(agent.id, chunk);
          processedCount++;
        } catch (err) {
          console.error('Failed to process conversation chunk:', err);
        }
      }

      setLastProcessTime(new Date().toISOString());
      
      // Reload memory data to show new memories
      await loadMemoryData();
      
      alert(`Successfully processed ${processedCount} conversations into memories!`);
      
    } catch (err) {
      console.error('Error processing memories:', err);
      setError('Failed to process chat history into memories');
    } finally {
      setIsProcessing(false);
    }
  };

  // Group messages into conversation chunks
  const groupMessagesIntoConversations = (messages) => {
    const chunks = [];
    let currentChunk = [];
    let lastMessageTime = null;

    messages.forEach((message) => {
      const messageTime = new Date(message.timestamp || Date.now());
      
      // If more than 30 minutes between messages, start new conversation
      if (lastMessageTime && (messageTime - lastMessageTime) > 30 * 60 * 1000) {
        if (currentChunk.length > 0) {
          chunks.push([...currentChunk]);
          currentChunk = [];
        }
      }
      
      currentChunk.push(message);
      lastMessageTime = messageTime;
      
      // If chunk gets too large (20+ messages), close it
      if (currentChunk.length >= 20) {
        chunks.push([...currentChunk]);
        currentChunk = [];
      }
    });
    
    // Add final chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks.filter(chunk => chunk.length >= 2); // Only keep conversations with at least 2 messages
  };

  // Store memories to Arweave
  const storeToArweave = async () => {
    try {
      setIsProcessing(true);
      
      const result = await MemoryService.storeMemoriesToArweave(agent.id);
      
      if (result.success) {
        alert(`Memories stored to Arweave! Transaction ID: ${result.transactionId}`);
        setArweaveStatus('stored');
      } else {
        throw new Error('Failed to store to Arweave');
      }
      
    } catch (err) {
      console.error('Error storing to Arweave:', err);
      setError('Failed to store memories to Arweave. Make sure ArConnect is installed and connected.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create journal from memories
  const createJournal = async () => {
    try {
      setIsProcessing(true);
      
      const journalEntry = await MemoryService.createJournalFromMemories(agent.id);
      
      if (journalEntry) {
        alert('Journal entry created successfully!');
      }
      
    } catch (err) {
      console.error('Error creating journal:', err);
      setError('Failed to create journal entry');
    } finally {
      setIsProcessing(false);
    }
  };

  // Optimize and consolidate memories
  const optimizeMemories = async () => {
    if (!memoryEntries || memoryEntries.length < 10) {
      setError('Need at least 10 memories to optimize');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const result = await MemoryService.optimizeMemoryStorage(agent.id, {
        enableConsolidation: true,
        maxMemories: 50,
        minImportanceThreshold: 0.3
      });

      if (result.success) {
        alert(`Memory optimization complete! Reduced ${result.originalCount} memories to ${result.optimizedCount} (${Math.round(result.reductionPercent)}% reduction). Preserved ${result.preservedImportant} important memories.`);
        
        // Reload memory data to show optimized structure
        await loadMemoryData();
      } else {
        throw new Error(result.error || 'Optimization failed');
      }

    } catch (err) {
      console.error('Error optimizing memories:', err);
      setError('Failed to optimize memories: ' + err.message);
    } finally {
      setIsProcessing(false);
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
          <button 
            className="memory-action-btn process-btn" 
            onClick={processIntoMemories}
            disabled={isProcessing || chatHistory.length === 0}
            title="Process chat history into memories"
          >
            {isProcessing ? '⏳' : '🧠'}
          </button>
          <button 
            className="memory-action-btn journal-btn" 
            onClick={createJournal}
            disabled={isProcessing || memoryEntries.length === 0}
            title="Create journal from memories"
          >
            📖
          </button>
          <button 
            className="memory-action-btn arweave-btn" 
            onClick={storeToArweave}
            disabled={isProcessing || arweaveStatus === 'disconnected'}
            title="Store memories to Arweave"
          >
            {arweaveStatus === 'connected' ? '💾' : '🔌'}
          </button>
          <button 
            className="memory-action-btn optimize-btn" 
            onClick={optimizeMemories}
            disabled={isProcessing || memoryEntries.length < 10}
            title="Optimize and consolidate memories"
          >
            🎯
          </button>
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
          <span className="stat-number">{memoryEntries.filter(e => e.type !== 'suggestion').length}</span>
          <span className="stat-label">Processed Memories</span>
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
        <div className="stat-card">
          <span className="stat-number">{arweaveStatus === 'connected' ? '✅' : '❌'}</span>
          <span className="stat-label">Arweave Status</span>
        </div>
        {lastProcessTime && (
          <div className="stat-card">
            <span className="stat-number">📅</span>
            <span className="stat-label">Last Processed: {new Date(lastProcessTime).toLocaleDateString()}</span>
          </div>
        )}
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

      {/* Memory Insight Panel */}
      <MemoryInsightPanel 
        memoryEntries={memoryEntries}
        isVisible={insightPanelVisible}
        onToggle={() => setInsightPanelVisible(!insightPanelVisible)}
      />

      {/* Auto Memory Processor */}
      <AutoMemoryProcessor 
        agentId={agent.id}
        chatHistory={chatHistory}
        onMemoryProcessed={handleMemoryProcessed}
      />

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
                className={`memory-entry ${selectedEntry === entry.id ? 'selected' : ''} ${entry.type === 'suggestion' ? 'suggestion-entry' : ''}`}
                onClick={() => {
                  if (entry.type === 'suggestion') {
                    processIntoMemories();
                  } else {
                    setSelectedEntry(selectedEntry === entry.id ? null : entry.id);
                  }
                }}
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
                {selectedEntry === entry.id && entry.type !== 'suggestion' && (
                  <div className="entry-details">
                    {entry.type === 'conversation' && entry.content && typeof entry.content === 'object' && entry.content.insights ? (
                      <div className="processed-memory-details">
                        <div className="memory-insights">
                          <h5>Key Insights:</h5>
                          <div className="insights-grid">
                            {entry.content.insights.topics && (
                              <div className="insight-section">
                                <strong>Topics:</strong>
                                <div className="topic-tags">
                                  {entry.content.insights.topics.map(topic => (
                                    <span key={topic} className="topic-tag">{topic}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {entry.content.insights.emotions && (
                              <div className="insight-section">
                                <strong>Emotions:</strong>
                                <span className="emotion-list">{entry.content.insights.emotions.join(', ')}</span>
                              </div>
                            )}
                            {entry.content.insights.learnings && (
                              <div className="insight-section">
                                <strong>Key Learnings:</strong>
                                <ul className="learnings-list">
                                  {entry.content.insights.learnings.map((learning, idx) => (
                                    <li key={idx}>{learning}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="memory-metadata">
                          <p><strong>Participants:</strong> {entry.content.participants?.join(', ')}</p>
                          <p><strong>Importance:</strong> {Math.round((entry.content.importance || 0) * 100)}%</p>
                          <p><strong>Message Count:</strong> {entry.content.messageCount}</p>
                        </div>
                      </div>
                    ) : entry.type === 'conversation' && Array.isArray(entry.content) ? (
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
                        <p>{typeof entry.content === 'string' ? entry.content : entry.summary}</p>
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
