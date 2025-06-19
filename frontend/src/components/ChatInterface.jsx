import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import AIService from '../services/AIService.js';
import ConversationSummarizer from '../services/ConversationSummarizer.js';
import './ChatInterface.css';

// Ollama configuration
const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'gemma3'; // Fallback to gemma3 if gemma3 not available

const ChatInterface = ({ agentData }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [currentModel, setCurrentModel] = useState(MODEL_NAME);
  const [conversationSummary, setConversationSummary] = useState('');
  const messagesEndRef = useRef(null);

  // Initialize with agent greeting and check Ollama
  useEffect(() => {
    if (agentData?.agent) {
      // Load chat history from localStorage
      const savedMessages = localStorage.getItem(`messages_${agentData.agent.processId}`);
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          setMessages(parsed);
        } catch (e) {
          console.error('Failed to load saved messages:', e);
        }
      }

      // Load conversation summary
      const summaryData = ConversationSummarizer.loadSummary(agentData.agent.processId);
      if (summaryData?.summary) {
        setConversationSummary(summaryData.summary);
      }

      // If no saved messages, show greeting
      if (!savedMessages) {
        setMessages([
          {
            id: 1,
            type: 'agent',
            content: `Hello! I'm your **RATi Digital Avatar** living on Arweave. 

My process ID is \`${agentData.agent.processId}\` and I'm powered by Ollama with your agent's personality!

What would you like to talk about?`,
            timestamp: new Date()
          }
        ]);
      }
      
      setConnectionStatus('connected');
      checkAIConnection();
    }
  }, [agentData]);

  // Check AI connection and available models using AIService
  const checkAIConnection = async () => {
    try {
      const connectionResult = await AIService.checkConnection();
      if (connectionResult.connected) {
        setConnectionStatus('connected');
        setCurrentModel(connectionResult.model);
        console.log(`Using ${connectionResult.model} model`);
      } else {
        setConnectionStatus('error');
        console.error('AI not available:', connectionResult.error);
      }
    } catch (error) {
      console.error('AI connection check failed:', error);
      setConnectionStatus('error');
    }
  };

  // Save messages to localStorage and update summary when messages change
  useEffect(() => {
    if (agentData?.agent?.processId && messages.length > 0) {
      localStorage.setItem(`messages_${agentData.agent.processId}`, JSON.stringify(messages));
      
      // Update conversation summary every 10 messages
      if (ConversationSummarizer.shouldUpdateSummary(messages.length)) {
        updateConversationSummary();
      }
    }
  }, [messages, agentData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update conversation summary
  const updateConversationSummary = useCallback(async () => {
    if (!agentData?.agent?.processId) return;
    
    try {
      const currentSummary = ConversationSummarizer.loadSummary(agentData.agent.processId)?.summary || '';
      const newSummary = await ConversationSummarizer.updateSummary(messages, currentSummary);
      
      setConversationSummary(newSummary);
      ConversationSummarizer.saveSummary(agentData.agent.processId, newSummary, messages.length);
    } catch (error) {
      console.error('Failed to update conversation summary:', error);
    }
  }, [agentData?.agent?.processId, messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading || !agentData?.agent) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Use AIService for consolidated generation
      const result = await AIService.generateChatResponse(
        userMessage.content,
        messages,
        agentData,
        {
          model: currentModel,
          temperature: 0.7,
          maxTokens: 500
        }
      );

      let agentResponse;
      if (result.success && result.text) {
        agentResponse = result.text.trim();
      } else {
        // Use AIService fallback
        agentResponse = AIService.generateFallbackChatResponse(userMessage.content, agentData);
      }

      const agentMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: agentResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);

    } catch (error) {
      console.error('Error with AI generation:', error);
      
      // Fallback response using AIService
      const fallbackMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: AIService.generateFallbackChatResponse(userMessage.content, agentData),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Debug: Log agentData to see what we're receiving
  console.log('ChatInterface: agentData received:', agentData);
  
  if (!agentData || !agentData.agent) {
    return (
      <div className="chat-interface">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading agent... (agentData: {agentData ? 'present but invalid' : 'missing'})</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="agent-info">
          <span className={`status-indicator ${connectionStatus}`}></span>
          <div className="agent-details">
            <h3>RATi Agent</h3>
            <p>Process: {agentData.agent.processId.slice(0, 16)}...</p>
            <p>Model: {currentModel} via Ollama</p>
          </div>
        </div>
      </div>

      {conversationSummary && (
        <div className="conversation-summary">
          <div className="summary-header">
            <h4>📋 Conversation Summary</h4>
            <span className="summary-count">{messages.length} messages</span>
          </div>
          <div className="summary-text">
            {conversationSummary}
          </div>
        </div>
      )}

      <div className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.type}`}>
            <div className="message-avatar">
              <img 
                src={msg.type === 'agent' ? '/rati-logo-light.png' : '/rati-logo-dark.png'} 
                alt={msg.type === 'agent' ? 'RATi Agent' : 'User'} 
              />
            </div>
            <div className="message-bubble">
              <div className="message-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    pre({ children, ...props }) {
                      return (
                        <pre className="code-block" {...props}>
                          {children}
                        </pre>
                      );
                    },
                    code({ inline, children, className, ...props }) {
                      return inline ? (
                        <code className="inline-code" {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className={`block-code ${className || ''}`} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              <div className="message-time">
                {(() => {
                  let time = msg.timestamp;
                  if (typeof time === 'string' || typeof time === 'number') {
                    try {
                      time = new Date(time);
                    } catch {
                      return '';
                    }
                  }
                  return time && typeof time.toLocaleTimeString === 'function' ? time.toLocaleTimeString() : '';
                })()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message agent">
            <div className="message-avatar">
              <img src="/rati-logo-light.png" alt="RATi Agent" />
            </div>
            <div className="message-bubble">
              <div className="message-content typing">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <div className="input-container">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Chat with your RATi agent..."
            disabled={isLoading}
            rows={1}
            style={{
              minHeight: '20px',
              maxHeight: '120px',
              resize: 'none',
              overflow: 'auto'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
