import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import config from '../config.js';
import './ChatInterface.css';

// Ollama configuration constants
const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'gemma3:latest'; // Using gemma3 for better performance

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'agent',
      content: 'Hello! I\'m your **RATi Digital Avatar AI Agent**. I can help you with deploying and managing your digital avatar. What would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentModel, setCurrentModel] = useState(MODEL_NAME);
  const [loreData, setLoreData] = useState(null);
  const [agentMemories, setAgentMemories] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const messagesEndRef = useRef(null);

  // Detect theme preference
  useEffect(() => {
    const checkTheme = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches ||
                     document.documentElement.classList.contains('dark') ||
                     document.body.classList.contains('dark-mode');
      setIsDarkMode(isDark);
    };

    checkTheme();
    
    // Listen for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(checkTheme);
    
    mediaQuery.addEventListener('change', checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      mediaQuery.removeEventListener('change', checkTheme);
      observer.disconnect();
    };
  }, []);

  const getAvailableModel = async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        
        // Prefer gemma3, fallback to gemma2:2b
        if (models.some(m => m.name.includes('gemma3'))) {
          return models.find(m => m.name.includes('gemma3')).name;
        } else if (models.some(m => m.name.includes('gemma2'))) {
          return models.find(m => m.name.includes('gemma2')).name;
        }
        return MODEL_NAME; // fallback to default
      }
    } catch (error) {
      console.error('Error getting available models:', error);
      return MODEL_NAME;
    }
  };

  // JSON Schema for structured responses
  const responseSchema = {
    type: "object",
    properties: {
      response: {
        type: "string",
        description: "The main response text to the user"
      },
      action: {
        type: "string",
        enum: ["chat", "deploy", "status", "help", "lore"],
        description: "The type of action this response represents"
      },
      suggestions: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Follow-up suggestions for the user",
        maxItems: 3
      },
      metadata: {
        type: "object",
        properties: {
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1
          },
          topic: {
            type: "string"
          }
        }
      }
    },
    required: ["response", "action"]
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check Ollama connection and load data
  useEffect(() => {
    checkOllamaConnection();
    loadLoreData();
    loadAgentMemories();
  }, []);

  const checkOllamaConnection = async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        
        // Check which Gemma model is available and set it
        const hasGemma3 = models.some(m => m.name.includes('gemma3'));
        const hasGemma2 = models.some(m => m.name.includes('gemma2'));
        
        if (hasGemma3) {
          const gemma3Model = models.find(m => m.name.includes('gemma3')).name;
          setCurrentModel(gemma3Model);
          console.log(`Using ${gemma3Model} model`);
        } else if (hasGemma2) {
          const gemma2Model = models.find(m => m.name.includes('gemma2')).name;
          setCurrentModel(gemma2Model);
          console.log(`Using ${gemma2Model} model`);
        } else {
          console.warn('No Gemma models found. Please install gemma3 or gemma2:2b');
        }
        
        setIsConnected(true);
        console.log('Connected to Ollama');
      }
    } catch (error) {
      console.error('Failed to connect to Ollama:', error);
      setIsConnected(false);
    }
  };

  const loadLoreData = async () => {
    try {
      // Load genesis scroll from Arweave
      if (config.genesis?.txid) {
        const arweaveUrl = `${config.arweave.protocol}://${config.arweave.host === 'localhost' ? 'arweave.net' : config.arweave.host}/${config.genesis.txid}`;
        const response = await fetch(arweaveUrl);
        if (response.ok) {
          const lore = await response.text();
          setLoreData(lore);
          console.log('Loaded lore data from Arweave');
        }
      }
    } catch (error) {
      console.error('Failed to load lore data:', error);
    }
  };

  const loadAgentMemories = async () => {
    try {
      // This could be expanded to load from Arweave transactions tagged with agent memories
      setAgentMemories([
        { id: 1, content: "Digital avatar deployment patterns", timestamp: new Date() },
        { id: 2, content: "Oracle council interactions", timestamp: new Date() },
        { id: 3, content: "User preferences and behavior", timestamp: new Date() }
      ]);
    } catch (error) {
      console.error('Failed to load agent memories:', error);
    }
  };

  const buildSystemPrompt = () => {
    let systemPrompt = `You are RATi, an AI agent for a decentralized digital avatar platform. You help users deploy and manage autonomous digital organisms on Arweave.

Key responsibilities:
- Help with genesis scroll deployment
- Assist with oracle council setup  
- Guide AI agent deployment
- Answer questions about the RATi platform
- Provide deployment status and troubleshooting

Always respond in a helpful, technical but friendly manner. You have access to the platform's lore and previous interactions.`;

    if (loreData) {
      systemPrompt += `\n\nPlatform Lore:\n${loreData.substring(0, 2000)}...`;
    }

    if (agentMemories.length > 0) {
      systemPrompt += `\n\nRecent memories:\n${agentMemories.map(m => `- ${m.content}`).join('\n')}`;
    }

    return systemPrompt;
  };

  const callOllama = async (userMessage) => {
    try {
      const modelToUse = await getAvailableModel();
      
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          system: buildSystemPrompt(),
          prompt: userMessage,
          format: responseSchema,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 500
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Try to parse structured response
      try {
        const structuredResponse = JSON.parse(data.response);
        return structuredResponse;
      } catch {
        // Fallback to plain text response
        return {
          response: data.response,
          action: "chat",
          suggestions: [],
          metadata: { confidence: 0.8 }
        };
      }
    } catch (error) {
      console.error('Ollama API call failed:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      if (!isConnected) {
        throw new Error('Not connected to Ollama. Please ensure Ollama is running on localhost:11434');
      }

      const aiResponse = await callOllama(currentInput);
      
      const agentMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: aiResponse.response,
        timestamp: new Date(),
        action: aiResponse.action,
        suggestions: aiResponse.suggestions || [],
        metadata: aiResponse.metadata || {}
      };

      setMessages(prev => [...prev, agentMessage]);

      // Store interaction in agent memories
      setAgentMemories(prev => [
        ...prev,
        {
          id: Date.now(),
          content: `User asked: "${currentInput.substring(0, 100)}..." - Responded about ${aiResponse.metadata?.topic || aiResponse.action}`,
          timestamp: new Date()
        }
      ].slice(-10)); // Keep last 10 memories

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: `Sorry, I encountered an error: ${error.message}. Make sure Ollama is running with the ${MODEL_NAME} model loaded.`,
        timestamp: new Date(),
        action: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { text: "Deploy Genesis Scroll", action: "deploy-genesis", prompt: "I want to deploy the genesis scroll for my digital avatar. Can you guide me through the process?" },
    { text: "Deploy Oracle Council", action: "deploy-oracle", prompt: "How do I deploy the oracle council? What are the requirements?" },
    { text: "Deploy AI Agent", action: "deploy-agent", prompt: "I'd like to deploy an AI agent. What steps do I need to follow?" },
    { text: "Check System Status", action: "status", prompt: "What's the current system status? Are all services running properly?" },
    { text: "Explain RATi Platform", action: "lore", prompt: "Can you explain what the RATi platform is and how digital avatars work?" },
    { text: "View Documentation", action: "docs", prompt: "Where can I find documentation about the RATi platform?" },
    { text: "Troubleshoot Issues", action: "troubleshoot", prompt: "I'm having issues with my deployment. Can you help me troubleshoot?" }
  ];

  const handleQuickAction = (action) => {
    const quickAction = quickActions.find(qa => qa.action === action);
    if (quickAction) {
      setInputText(quickAction.prompt);
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-title">
          <h3>🤖 RATi Digital Avatar Assistant</h3>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? `Connected (${currentModel})` : 'Connecting to Ollama...'}
          </div>
        </div>
        {loreData && (
          <div className="lore-status">
            <small>📜 Lore loaded from Arweave • 🧠 {agentMemories.length} memories</small>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-avatar">
              {message.type === 'agent' ? (
                <img 
                  src={isDarkMode ? "/rati-logo-light.png" : "/rati-logo-dark.png"} 
                  alt="RATi Agent" 
                  className="avatar-logo agent-avatar"
                />
              ) : (
                <img 
                  src={isDarkMode ? "/rati-logo-light.png" : "/rati-logo-dark.png"} 
                  alt="User" 
                  className="avatar-logo user-avatar"
                />
              )}
            </div>
            <div className="message-content">
              <div className="message-text">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    // Prevent code blocks from being too large
                    code: ({inline, className, children, ...props}) => {
                      return inline ? (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      ) : (
                        <pre className="code-block">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    },
                    // Style links
                    a: ({children, ...props}) => (
                      <a {...props} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    )
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="message-suggestions">
                  <small>💡 Suggestions:</small>
                  {message.suggestions.map((suggestion, idx) => (
                    <button 
                      key={idx} 
                      className="suggestion-btn"
                      onClick={() => setInputText(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <div className="message-time">
                {formatTime(message.timestamp)}
                {message.metadata?.confidence && (
                  <span className="confidence"> (confidence: {Math.round(message.metadata.confidence * 100)}%)</span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message agent">
            <div className="message-avatar">
              <img 
                src={isDarkMode ? "/rati-logo-light.png" : "/rati-logo-dark.png"} 
                alt="RATi Agent" 
                className="avatar-logo agent-avatar"
              />
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!inputText.trim() && (
        <div className="quick-actions">
          <div className="quick-actions-label">💡 Try asking:</div>
          <div className="quick-actions-buttons">
            {(() => {
              const randomSuggestion = quickActions[Math.floor(Math.random() * quickActions.length)];
              return (
                <button
                  className="quick-action-btn"
                  onClick={() => handleQuickAction(randomSuggestion.action)}
                >
                  {randomSuggestion.text}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me about digital avatar deployment, oracle management, or AI agents..."
          rows="3"
        />
        <button 
          onClick={handleSendMessage}
          disabled={!inputText.trim() || isTyping || !isConnected}
          className="send-button"
        >
          {isTyping ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
