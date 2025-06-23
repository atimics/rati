import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAO } from '../contexts/AOContext';
import { useWallet } from '../contexts/WalletContext';
import toast from 'react-hot-toast';
import './AgentMemoryView.css';

/**
 * Agent Memory View Component - AO Integrated
 * 
 * Displays and manages agent memories stored on-chain via the Avatar process.
 * Provides a clean interface for viewing, searching, and organizing memories.
 */

const AgentMemoryView = () => {
  const [memories, setMemories] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, conversations, thoughts, insights
  const [isProcessing, setIsProcessing] = useState(false);

  // AO and wallet integration
  const { 
    aoStatus, 
    processIds, 
    isInitializing, 
    isReady,
    getMemories,
    storeMemory,
    readInbox
  } = useAO();
  const { isConnected } = useWallet();

  // Load memory data from AO
  useEffect(() => {
    if (isReady) {
      loadMemoryData();
    }
  }, [isReady, loadMemoryData]);

  const loadMemoryData = useCallback(async () => {
    try {
      setLoading(true);

      // Load memories from Avatar process
      const aoMemories = await getMemories();
      
      // Load chat history for processing if needed
      const inbox = await readInbox();
      setChatHistory(inbox);
      
      // If no memories exist but we have chat history, suggest processing
      if (aoMemories.length === 0 && inbox.length > 0) {
        const suggestionMemory = {
          id: 'suggestion',
          type: 'suggestion',
          title: '💡 Process Chat History into Memories',
          summary: `You have ${inbox.length} messages that could be processed into meaningful memories.`,
          timestamp: new Date().toISOString(),
          content: `Your Avatar has ${inbox.length} messages in its inbox. These conversations could be processed into structured memories for better recall and insights.`,
          tags: ['processing', 'chat-history', 'suggestion'],
          canProcess: true
        };
        setMemories([suggestionMemory]);
      } else {
        setMemories(aoMemories);
      }

    } catch (err) {
      console.error('Error loading memory data:', err);
      toast.error('Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [getMemories, readInbox]);

  const processInboxIntoMemories = async () => {
    if (!chatHistory.length) return;

    setIsProcessing(true);
    try {
      const processedMemories = await generateMemoriesFromInbox(chatHistory);
      
      // Store each memory in the Avatar process
      for (const memory of processedMemories) {
        await storeMemory(memory);
      }
      
      toast.success(`Processed ${processedMemories.length} memories`);
      
      // Reload memories
      await loadMemoryData();
      
    } catch (error) {
      console.error('Failed to process memories:', error);
      toast.error('Failed to process memories');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateMemoriesFromInbox = async (inbox) => {
    const memories = [];
    
    // Group messages by conversation threads
    const conversations = groupMessagesByConversation(inbox);
    
    // Create conversation memories
    conversations.forEach((messages, index) => {
      if (messages.length > 1) {
        const memory = {
          id: `conversation-${Date.now()}-${index}`,
          type: 'conversation',
          title: generateConversationTitle(messages),
          summary: generateConversationSummary(messages),
          timestamp: messages[0]?.timestamp || new Date().toISOString(),
          content: messages,
          tags: extractTags(messages),
          participants: extractParticipants(messages),
          messageCount: messages.length
        };
        memories.push(memory);
      }
    });

    // Create insight memories from patterns
    const insights = extractInsights(inbox);
    memories.push(...insights);

    return memories;
  };

  const groupMessagesByConversation = (messages) => {
    // Simple grouping by time proximity (within 1 hour)
    const conversations = [];
    let currentConversation = [];
    
    messages.forEach((message, index) => {
      if (index === 0) {
        currentConversation = [message];
      } else {
        const timeDiff = new Date(message.timestamp) - new Date(messages[index - 1].timestamp);
        if (timeDiff < 60 * 60 * 1000) { // 1 hour
          currentConversation.push(message);
        } else {
          if (currentConversation.length > 0) {
            conversations.push([...currentConversation]);
          }
          currentConversation = [message];
        }
      }
    });
    
    if (currentConversation.length > 0) {
      conversations.push(currentConversation);
    }
    
    return conversations;
  };

  const generateConversationTitle = (messages) => {
    // Extract key topics or use first message
    const firstUserMessage = messages.find(m => m.From === 'user' || m.Action === 'user-message');
    if (firstUserMessage && firstUserMessage.Data) {
      const content = firstUserMessage.Data.substring(0, 50);
      return `Conversation: ${content}${content.length > 50 ? '...' : ''}`;
    }
    return `Conversation on ${new Date(messages[0]?.timestamp).toLocaleDateString()}`;
  };

  const generateConversationSummary = (messages) => {
    const userMessages = messages.filter(m => m.From === 'user' || m.Action === 'user-message').length;
    const assistantMessages = messages.length - userMessages;
    return `${userMessages} user messages, ${assistantMessages} Avatar responses`;
  };

  const extractTags = (messages) => {
    const text = messages.map(m => m.Data || '').join(' ').toLowerCase();
    const commonTopics = ['programming', 'ai', 'blockchain', 'technology', 'arweave', 'ao'];
    return commonTopics.filter(topic => text.includes(topic));
  };

  const extractParticipants = (messages) => {
    const participants = new Set();
    messages.forEach(m => {
      if (m.From) participants.add(m.From);
    });
    return Array.from(participants);
  };

  const extractInsights = (messages) => {
    const insights = [];
    
    // Simple pattern detection
    if (messages.length > 10) {
      insights.push({
        id: `insight-activity-${Date.now()}`,
        type: 'insight',
        title: '🔥 High Activity Period',
        summary: `Generated ${messages.length} messages in this period`,
        timestamp: new Date().toISOString(),
        content: `This appears to be a period of high activity with ${messages.length} messages exchanged.`,
        tags: ['activity', 'patterns', 'engagement'],
        metrics: {
          messageCount: messages.length,
          timeSpan: 'recent'
        }
      });
    }

    return insights;
  };

  const filteredMemories = memories.filter(memory => {
    const matchesSearch = memory.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         memory.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (memory.tags && memory.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesType = filterType === 'all' || memory.type === filterType;
    
    return matchesSearch && matchesType;
  });

  // Connection states
  if (!isConnected) {
    return (
      <div className="memory-container">
        <div className="connection-prompt">
          <h3>🔐 Wallet Not Connected</h3>
          <p>Please connect your Arweave wallet to access your Avatar's memories</p>
        </div>
      </div>
    );
  }

  if (isInitializing || loading) {
    return (
      <div className="memory-container">
        <div className="loading-state">
          <h3>🧠 Loading Memories</h3>
          <p>Retrieving memories from your Avatar process...</p>
          {processIds.avatar && (
            <p className="process-id">Avatar: {processIds.avatar.substring(0, 12)}...</p>
          )}
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="memory-container">
        <div className="connection-prompt">
          <h3>⚠️ AO Connection Issue</h3>
          <p>Unable to connect to your Avatar process</p>
          <div className="status-info">
            <p><strong>Status:</strong> {aoStatus}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memory-container">
      {/* Header */}
      <div className="memory-header">
        <div className="header-title">
          <h2>🧠 Avatar Memories</h2>
          <p>Memories stored on-chain in your Avatar process</p>
        </div>
        
        <div className="header-actions">
          {memories.some(m => m.canProcess) && (
            <button 
              className="process-btn"
              onClick={processInboxIntoMemories}
              disabled={isProcessing}
            >
              {isProcessing ? '⏳ Processing...' : '🔄 Process Chat History'}
            </button>
          )}
          <button 
            className="refresh-btn"
            onClick={loadMemoryData}
            title="Refresh memories"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="memory-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search memories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-buttons">
          {['all', 'conversation', 'insight', 'thought', 'suggestion'].map(type => (
            <button
              key={type}
              className={`filter-btn ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Memory List */}
      <div className="memory-content">
        {filteredMemories.length === 0 ? (
          <div className="empty-state">
            <h4>No memories found</h4>
            <p>
              {memories.length === 0 
                ? "Your Avatar hasn't created any memories yet. Start chatting to generate memories!"
                : "No memories match your search criteria."
              }
            </p>
          </div>
        ) : (
          <div className="memory-grid">
            {filteredMemories.map((memory) => (
              <div
                key={memory.id}
                className={`memory-card ${memory.type} ${selectedMemory?.id === memory.id ? 'selected' : ''}`}
                onClick={() => setSelectedMemory(memory)}
              >
                <div className="memory-header">
                  <div className="memory-type">
                    {memory.type === 'conversation' && '💬'}
                    {memory.type === 'insight' && '💡'}
                    {memory.type === 'thought' && '🤔'}
                    {memory.type === 'suggestion' && '💡'}
                  </div>
                  <div className="memory-title">{memory.title}</div>
                  <div className="memory-time">
                    {new Date(memory.timestamp).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="memory-summary">{memory.summary}</div>
                
                {memory.tags && memory.tags.length > 0 && (
                  <div className="memory-tags">
                    {memory.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
                
                {memory.canProcess && (
                  <div className="action-hint">
                    Click to process this data into memories
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memory Detail Panel */}
      {selectedMemory && (
        <div className="memory-detail-panel">
          <div className="panel-header">
            <h3>{selectedMemory.title}</h3>
            <button 
              className="close-btn"
              onClick={() => setSelectedMemory(null)}
            >
              ✕
            </button>
          </div>
          
          <div className="panel-content">
            <div className="memory-meta">
              <span className="memory-type-badge">{selectedMemory.type}</span>
              <span className="memory-date">
                {new Date(selectedMemory.timestamp).toLocaleString()}
              </span>
            </div>
            
            <div className="memory-summary-detail">
              {selectedMemory.summary}
            </div>
            
            {selectedMemory.content && (
              <div className="memory-content-detail">
                {typeof selectedMemory.content === 'string' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedMemory.content}
                  </ReactMarkdown>
                ) : Array.isArray(selectedMemory.content) ? (
                  <div className="message-list">
                    {selectedMemory.content.map((msg, index) => (
                      <div key={index} className="message-item">
                        <div className="message-sender">
                          {msg.From === 'user' ? 'You' : 'Avatar'}
                        </div>
                        <div className="message-content">{msg.Data || msg.content}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre>{JSON.stringify(selectedMemory.content, null, 2)}</pre>
                )}
              </div>
            )}
            
            {selectedMemory.tags && (
              <div className="memory-tags-detail">
                <h4>Tags</h4>
                <div className="tags-list">
                  {selectedMemory.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedMemory.canProcess && (
              <div className="process-action">
                <button 
                  className="process-btn primary"
                  onClick={processInboxIntoMemories}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Process Into Memories'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentMemoryView;
