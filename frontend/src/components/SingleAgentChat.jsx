import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAO } from '../contexts/AOContext';
import { useWallet } from '../contexts/WalletContext';
import toast from 'react-hot-toast';
import './SingleAgentChat.css';

/**
 * Single Agent Chat Interface - AO Integrated
 * 
 * Chat interface that communicates directly with the Avatar process on AO.
 * Creates a true single-agent experience powered by blockchain state.
 */

const SingleAgentChat = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  
  // AO and wallet integration
  const { 
    aoStatus, 
    processIds, 
    isInitializing, 
    isReady,
    sendChatMessage,
    readInbox,
    pollForMessages
  } = useAO();
  const { isConnected } = useWallet();
  
  // Refs
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollIntervalRef = useRef(null);
  
  // Load chat history from Avatar process
  useEffect(() => {
    if (isReady) {
      loadChatHistory();
      startPolling();
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isReady]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const loadChatHistory = async () => {
    try {
      const inbox = await readInbox();
      const formattedHistory = formatInboxToChat(inbox);
      setChatHistory(formattedHistory);
      
      if (formattedHistory.length > 0) {
        setLastMessageId(formattedHistory[formattedHistory.length - 1].id);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      toast.error('Failed to load chat history');
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const newMessages = await pollForMessages(lastMessageId);
        if (newMessages.length > 0) {
          const formattedNew = formatInboxToChat(newMessages);
          setChatHistory(prev => {
            // Remove temporary "thinking" messages
            const withoutTemp = prev.filter(msg => !msg.isTemporary);
            return [...withoutTemp, ...formattedNew];
          });
          setLastMessageId(formattedNew[formattedNew.length - 1].id);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds
  };

  const formatInboxToChat = (inbox) => {
    if (!Array.isArray(inbox)) return [];
    
    return inbox.map(msg => ({
      id: msg.Id || msg.id || Date.now().toString(),
      content: msg.Data || msg.content || '',
      timestamp: msg.Timestamp || new Date().toISOString(),
      role: msg.From === 'user' || msg.Action === 'user-message' ? 'user' : 'assistant',
      sender: msg.From === 'user' ? 'You' : 'RATi Avatar'
    }));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isResponding || !isReady) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
      role: 'user',
      sender: 'You'
    };

    // Add user message to history immediately
    setChatHistory(prev => [...prev, userMessage]);
    setIsResponding(true);
    setChatInput('');

    try {
      // Send message to Avatar process
      const messageId = await sendChatMessage(userMessage.content);
      
      // Add a temporary "thinking" message
      const thinkingMessage = {
        id: `thinking-${Date.now()}`,
        content: '🤔 *Avatar is processing your message...*',
        timestamp: new Date().toISOString(),
        role: 'assistant',
        sender: 'RATi Avatar',
        isTemporary: true
      };
      
      setChatHistory(prev => [...prev, thinkingMessage]);
      
      // The response will come through polling
      toast.success('Message sent to Avatar');
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message to Avatar');
      
      // Remove user message on error
      setChatHistory(prev => prev.filter(msg => msg.id !== userMessage.id));
    } finally {
      setIsResponding(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const clearChatHistory = () => {
    setChatHistory([]);
    setLastMessageId(null);
    toast.success('Chat history cleared');
  };

  // Connection states
  if (!isConnected) {
    return (
      <div className="chat-container">
        <div className="connection-prompt">
          <h3>🔐 Wallet Not Connected</h3>
          <p>Please connect your Arweave wallet to chat with your Avatar</p>
          <div className="help-text">
            <p>You need to connect your wallet to:</p>
            <ul>
              <li>Send messages to your Avatar process</li>
              <li>Access your chat history on the blockchain</li>
              <li>Interact with the AO ecosystem</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="chat-container">
        <div className="connection-prompt">
          <h3>🔗 Connecting to AO</h3>
          <p>Initializing connection to your Avatar process...</p>
          {processIds.avatar && (
            <p className="process-id">Avatar: {processIds.avatar.substring(0, 12)}...</p>
          )}
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="chat-container">
        <div className="connection-prompt">
          <h3>⚠️ AO Connection Issue</h3>
          <p>Unable to connect to your Avatar process</p>
          <div className="status-info">
            <p><strong>Status:</strong> {aoStatus}</p>
            {processIds.avatar ? (
              <p><strong>Avatar Process:</strong> {processIds.avatar.substring(0, 12)}...</p>
            ) : (
              <p><strong>Error:</strong> No Avatar process configured</p>
            )}
          </div>
          <div className="help-text">
            <p>Please ensure:</p>
            <ul>
              <li>Your processes are deployed correctly</li>
              <li>Your wallet has sufficient AR balance</li>
              <li>The deployment service is running</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="agent-info">
          <div className="agent-avatar">
            <div className="avatar-circle">
              🤖
            </div>
          </div>
          <div className="agent-details">
            <h3>RATi Avatar</h3>
            <div className="status-indicators">
              <span className={`status-indicator ${aoStatus === 'connected' ? 'connected' : 'disconnected'}`}>
                ● AO {aoStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
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
            onClick={loadChatHistory}
            title="Refresh chat history"
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
              <h4>Welcome to your RATi Avatar!</h4>
              <p>Your Avatar is powered by AO processes and stores conversations on the blockchain.</p>
              <div className="features">
                <div className="feature">
                  <span className="feature-icon">🔗</span>
                  <span>On-chain persistence</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🤖</span>
                  <span>AI-powered responses</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🌐</span>
                  <span>Decentralized network</span>
                </div>
              </div>
              <p className="start-prompt">Start a conversation below...</p>
            </div>
          </div>
        ) : (
          chatHistory.map((message, index) => (
            <div 
              key={message.id || index} 
              className={`message ${message.role} ${message.isTemporary ? 'temporary' : ''}`}
            >
              <div className="message-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    code({ inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              <div className="message-meta">
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                <span className="sender">{message.sender}</span>
              </div>
            </div>
          ))
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
            onKeyPress={handleKeyPress}
            placeholder="Chat with your Avatar..."
            disabled={isResponding || !isReady}
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
            disabled={!chatInput.trim() || isResponding || !isReady}
          >
            {isResponding ? '⏳' : '➤'}
          </button>
        </div>
        {!isReady && (
          <div className="connection-warning">
            AO service is not available. Please check your connection.
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleAgentChat;
