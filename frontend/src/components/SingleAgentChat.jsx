import React, { useState, useEffect, useRef } from 'react';
import collectiveService from '../services/CollectiveService';
import enhancedAIService from '../services/EnhancedAIService';
import toast from 'react-hot-toast';
import './SingleAgentChat.css';

/**
 * Single Agent Chat Interface
 * 
 * Simple chat interface focused on one specific agent.
 * Perfect for deployment as a single-page application on Arweave.
 */

const SingleAgentChat = () => {
  const [agent, setAgent] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  
  // Default agent ID for single-agent mode
  const DEFAULT_AGENT_ID = 'default-rati-agent';
  
  // Refs
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Load default agent and AI status on mount
  useEffect(() => {
    // Create or load default agent
    let defaultAgent = collectiveService.getCharacter(DEFAULT_AGENT_ID);
    
    if (!defaultAgent) {
      // Create a default agent if none exists
      defaultAgent = {
        id: DEFAULT_AGENT_ID,
        name: 'RATi Agent',
        definition: {
          bio: 'I am a helpful AI assistant powered by the RATi collective intelligence system.',
          prompt: 'You are a helpful AI assistant. Respond conversationally and be helpful.',
          description: 'Default RATi collective agent'
        },
        agentId: DEFAULT_AGENT_ID,
        burnAddress: null,
        balance: 0,
        createdAt: new Date().toISOString()
      };
      
      // Save the default agent
      collectiveService.saveCharacter(defaultAgent);
    }
    
    setAgent(defaultAgent);
    
    // Load chat history from agent journal
    loadChatHistory(defaultAgent.id);
    
    // Check AI service status
    checkAIStatus();
  }, []);

  const loadChatHistory = (agentId) => {
    try {
      const journal = collectiveService.getAgentJournal(agentId);
      if (journal && journal.entries && Array.isArray(journal.entries)) {
        // Convert journal entries to chat messages
        const chatMessages = journal.entries
          .filter(entry => entry.type === 'chat' || entry.type === 'message')
          .map(entry => {
            let content = entry.content || entry.text;
            
            // Handle case where content might be an object (from old data)
            if (typeof content === 'object' && content !== null) {
              if (content.text) {
                content = content.text;
              } else {
                content = JSON.stringify(content);
              }
            }
            
            return {
              role: entry.role || (entry.isUser ? 'user' : 'assistant'),
              content: String(content), // Ensure content is always a string
              timestamp: entry.timestamp || new Date().toISOString(),
              model: entry.model || 'unknown'
            };
          });
        setChatHistory(chatMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Continue with empty history
    }
  };

  const saveChatHistory = (agentId, history) => {
    try {
      // Get existing journal or create new one
      let journal = collectiveService.getAgentJournal(agentId) || {
        agentId: agentId,
        entries: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      // Convert chat history to journal entries
      const journalEntries = history.map((message, index) => ({
        id: `chat-${Date.now()}-${index}`,
        type: 'chat',
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        model: message.model
      }));
      
      // Update journal with new entries
      journal.entries = journalEntries;
      journal.lastUpdated = new Date().toISOString();
      
      // Save to localStorage
      collectiveService.saveAgentJournal(agentId, journal);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const checkAIStatus = async () => {
    try {
      const status = await enhancedAIService.getInferenceEndpoint();
      // Map 'available' to 'connected' for UI consistency
      setAiStatus({
        ...status,
        connected: status.available
      });
    } catch (error) {
      console.error('Error checking AI status:', error);
      setAiStatus({ connected: false, available: false, error: 'AI service unavailable' });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isResponding || !agent) return;
    
    const userMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
      model: aiStatus?.model || 'unknown'
    };
    
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setChatInput('');
    setIsResponding(true);
    
    try {
      // Get AI response
      const response = await enhancedAIService.generateCharacterResponse(
        chatInput.trim(),
        agent,
        { 
          systemPrompt: 'You are helpful and conversational.',
          chatHistory: newHistory.slice(-6) // Last 6 messages for context (excluding current message)
        }
      );
      
      // Extract text from response object
      const responseText = typeof response === 'string' ? response : response.text || 'No response generated';
      const responseModel = typeof response === 'object' ? response.model : aiStatus?.model || 'unknown';
      
      const assistantMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        model: responseModel
      };
      
      const updatedHistory = [...newHistory, assistantMessage];
      setChatHistory(updatedHistory);
      
      // Save chat history to agent journal
      saveChatHistory(agent.id, updatedHistory);
      
    } catch (error) {
      console.error('Error generating response:', error);
      toast.error('Failed to generate response. Please try again.');
      
      // Add error message to chat
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        model: 'error',
        isError: true
      };
      
      const updatedHistory = [...newHistory, errorMessage];
      setChatHistory(updatedHistory);
    } finally {
      setIsResponding(false);
      // Focus input after response
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleInputKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChatHistory = () => {
    setChatHistory([]);
    if (agent) {
      saveChatHistory(agent.id, []);
    }
    toast.success('Chat history cleared');
  };

  if (!agent) {
    return (
      <div className="single-agent-chat">
        <div className="loading-state">
          <h3>Loading Agent...</h3>
          <p>Setting up your AI companion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="single-agent-chat">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="agent-info">
          <div className="agent-avatar">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="agent-details">
            <h3>{agent.name}</h3>
            <p>{agent.bio}</p>
            <div className="ai-status">
              {aiStatus?.connected ? (
                <span className="status-connected">
                  ● AI Ready ({aiStatus.model || 'unknown'})
                </span>
              ) : (
                <span className="status-disconnected">
                  ● AI Disconnected
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="clear-btn"
            onClick={clearChatHistory}
            title="Clear chat history"
          >
            🗑️
          </button>
          <button 
            className="refresh-btn"
            onClick={checkAIStatus}
            title="Refresh AI status"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {chatHistory.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-content">
              <h4>Welcome to {agent.name}!</h4>
              <p>{agent.bio}</p>
              <div className="agent-traits">
                {agent.traits?.map((trait, index) => (
                  <span key={index} className="trait-badge">{trait}</span>
                ))}
              </div>
              <p className="start-prompt">Start a conversation below...</p>
            </div>
          </div>
        ) : (
          chatHistory.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.role} ${message.isError ? 'error' : ''}`}
            >
              <div className="message-content">
                {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
              </div>
              <div className="message-meta">
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                {message.model && message.model !== 'unknown' && (
                  <span className="model-tag">{message.model}</span>
                )}
              </div>
            </div>
          ))
        )}
        
        {isResponding && (
          <div className="message assistant typing">
            <div className="message-content">
              {agent.name} is thinking...
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="chat-input-area">
        <div className="input-group">
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={handleInputKeyPress}
            placeholder={`Chat with ${agent.name}...`}
            disabled={isResponding || !aiStatus?.connected}
            rows={1}
            style={{
              minHeight: '50px',
              maxHeight: '120px',
              resize: 'none',
              overflow: 'auto'
            }}
          />
          <button 
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isResponding || !aiStatus?.connected}
          >
            {isResponding ? '⏳' : '➤'}
          </button>
        </div>
        {!aiStatus?.connected && (
          <div className="connection-warning">
            AI service is not available. Please check your connection.
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleAgentChat;
