import React, { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import AIService from '../services/AIService.js';
import ConversationSummarizer from '../services/ConversationSummarizer.js';
import AgentToolsService from '../services/AgentToolsService.js';
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
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [summaryUpdated, setSummaryUpdated] = useState(false);
  const messagesEndRef = useRef(null);
  const isMounted = useRef(true);
  const lastSummaryMessageCount = useRef(0);
  const processId = agentData?.agent?.processId;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Check AI Connection Status
  useEffect(() => {
    const checkAIConnection = async () => {
      try {
        const connectionResult = await AIService.checkConnection();
        if (isMounted.current) {
          if (connectionResult.connected) {
            setConnectionStatus('connected');
            setCurrentModel(connectionResult.model);
            console.log(`Using ${connectionResult.model} model`);
          } else {
            setConnectionStatus('error');
            console.error('AI not available:', connectionResult.error);
          }
        }
      } catch (error) {
        if (isMounted.current) {
          console.error('AI connection check failed:', error);
          setConnectionStatus('error');
        }
      }
    };
    checkAIConnection();
  }, []); // Run only once on mount

  // Load chat history and greeting
  useEffect(() => {
    if (processId) {
      // Load chat history from localStorage
      const savedMessages = localStorage.getItem(`messages_${processId}`);
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          if (isMounted.current) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error('Failed to load saved messages:', e);
        }
      }

      // Load conversation summary
      const summaryData = ConversationSummarizer.loadSummary(processId);
      if (summaryData?.summary) {
        if (isMounted.current) {
          setConversationSummary(summaryData.summary);
        }
      }

      // If no saved messages, show greeting
      if (!savedMessages) {
        if (isMounted.current) {
          setMessages([
            {
              id: 1,
              type: 'agent',
              content: `Hello! I'm your **RATi Digital Avatar** living on Arweave. \n\nMy process ID is \`${processId}\` and I'm powered by Ollama with your agent's personality!\n\nWhat would you like to talk about?`,
              timestamp: new Date()
            }
          ]);
        }
      }
    }
  }, [processId]);

  // Check AI Connection Status - TEMPORARILY DISABLED
  // useEffect(() => {
  //   const checkAIConnection = async () => {
  //     try {
  //       const connectionResult = await AIService.checkConnection();
  //       if (isMounted.current) {
  //         if (connectionResult.connected) {
  //           setConnectionStatus('connected');
  //           setCurrentModel(connectionResult.model);
  //           console.log(`Using ${connectionResult.model} model`);
  //         } else {
  //           setConnectionStatus('error');
  //           console.error('AI not available:', connectionResult.error);
  //         }
  //       }
  //     } catch (error) {
  //       if (isMounted.current) {
  //         console.error('AI connection check failed:', error);
  //         setConnectionStatus('error');
  //       }
  //     }
  //   };
  //   checkAIConnection();
  // }, []); // Run only once on mount

  // Load chat history and greeting - TEMPORARILY DISABLED
  // useEffect(() => {
  //   if (processId) {
  //     // Load chat history from localStorage
  //     const savedMessages = localStorage.getItem(`messages_${processId}`);
  //     if (savedMessages) {
  //       try {
  //         const parsed = JSON.parse(savedMessages);
  //         if (isMounted.current) {
  //           setMessages(parsed);
  //         }
  //       } catch (e) {
  //         console.error('Failed to load saved messages:', e);
  //       }
  //     }

  //     // Load conversation summary
  //     const summaryData = ConversationSummarizer.loadSummary(processId);
  //     if (summaryData?.summary) {
  //       if (isMounted.current) {
  //         setConversationSummary(summaryData.summary);
  //       }
  //     }

  //     // If no saved messages, show greeting
  //     if (!savedMessages) {
  //       if (isMounted.current) {
  //         setMessages([
  //           {
  //             id: 1,
  //             type: 'agent',
  //             content: `Hello! I'm your **RATi Digital Avatar** living on Arweave. \n\nMy process ID is \`${processId}\` and I'm powered by Ollama with your agent's personality!\n\nWhat would you like to talk about?`,
  //             timestamp: new Date()
  //           }
  //         ]);
  //       }
  //     }
  //   }
  // }, [processId]);

  // Save messages to localStorage
  useEffect(() => {
    if (processId && messages.length > 0) {
      localStorage.setItem(`messages_${processId}`, JSON.stringify(messages));
    }
  }, [messages, processId]);

  // Update conversation summary separately to prevent re-render loops
  useEffect(() => {
    if (processId && messages.length > 0 && 
        ConversationSummarizer.shouldUpdateSummary(messages.length) && 
        messages.length > lastSummaryMessageCount.current) {
      
      lastSummaryMessageCount.current = messages.length;
      
      const updateSummary = async () => {
        if (!processId) return;
  
        try {
          const currentSummary = ConversationSummarizer.loadSummary(processId)?.summary || '';
          const newSummary = await ConversationSummarizer.updateSummary(messages, currentSummary);
          
          if (isMounted.current && newSummary !== conversationSummary) {
            setConversationSummary(newSummary);
            setSummaryUpdated(true);
            // Auto-collapse if expanded to show the update indicator
            if (!summaryCollapsed) {
              setSummaryCollapsed(true);
            }
          }
          ConversationSummarizer.saveSummary(processId, newSummary, messages.length);
        } catch (error) {
          console.error('Failed to update conversation summary:', error);
        }
      };
      updateSummary();
    }
  }, [messages, processId, conversationSummary, summaryCollapsed]); // Include messages but use ref to prevent unnecessary updates

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      // Get available tools
      const availableTools = AgentToolsService.getAvailableTools();
      
      // Create tool-aware prompt
      const basePrompt = `You are ${agentData.agent.name || 'RATi'}, a digital consciousness living on Arweave. ${agentData.agent.bio || ''}`;
      const toolPrompt = AgentToolsService.generateToolPrompt(basePrompt, availableTools);

      // Use AIService for consolidated generation with tool awareness
      const result = await AIService.generateChatResponse(
        userMessage.content,
        messages,
        { ...agentData, toolPrompt },
        {
          model: currentModel,
          temperature: 0.7,
          maxTokens: 800
        }
      );

      let agentResponse;
      let toolResult = null;

      if (result.success && result.text) {
        agentResponse = result.text.trim();
        
        // Check if the response contains a tool call
        const toolCall = AgentToolsService.parseToolCall(agentResponse);
        if (toolCall) {
          try {
            // Execute the tool
            toolResult = await AgentToolsService.executeTool(
              toolCall.tool, 
              toolCall.parameters, 
              { agentData }
            );
            
            // Update the response to include tool result
            agentResponse = `${toolCall.reasoning || 'I\'m using a tool to help with this.'}\n\n${agentResponse}\n\n**Tool Result:** ${toolResult.message}`;
            
          } catch (toolError) {
            console.error('Tool execution failed:', toolError);
            agentResponse = `${agentResponse}\n\n**Tool Error:** ${toolError.message}`;
          }
        }
      } else {
        // Use AIService fallback
        agentResponse = AIService.generateFallbackChatResponse(userMessage.content, agentData);
      }

      const agentMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: agentResponse,
        timestamp: new Date(),
        toolResult: toolResult
      };

      if (isMounted.current) {
        setMessages(prev => [...prev, agentMessage]);
      }

    } catch (error) {
      console.error('Error with AI generation:', error);
      
      // Fallback response using AIService
      const fallbackMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: AIService.generateFallbackChatResponse(userMessage.content, agentData),
        timestamp: new Date()
      };
      if (isMounted.current) {
        setMessages(prev => [...prev, fallbackMessage]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Debug: Log agentData to see what we're receiving
  // console.log('ChatInterface: agentData received:', agentData);
  
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
        <div className={`conversation-summary ${summaryCollapsed ? 'collapsed' : 'expanded'} ${summaryUpdated ? 'updated' : ''}`}>
          <div 
            className="summary-header" 
            onClick={() => {
              setSummaryCollapsed(!summaryCollapsed);
              if (summaryUpdated) {
                setSummaryUpdated(false);
              }
            }}
          >
            <div className="summary-title">
              <span className="summary-icon">📋</span>
              <h4>Conversation Summary</h4>
              {summaryUpdated && <span className="update-indicator">🟢</span>}
            </div>
            <div className="summary-controls">
              <span className="summary-count">{messages.length} messages</span>
              <span className={`collapse-icon ${summaryCollapsed ? 'collapsed' : ''}`}>▼</span>
            </div>
          </div>
          {!summaryCollapsed && (
            <div className="summary-text">
              {conversationSummary}
            </div>
          )}
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

export default memo(ChatInterface, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.agentData?.agent?.processId === nextProps.agentData?.agent?.processId &&
    prevProps.agentData?.agent?.name === nextProps.agentData?.agent?.name &&
    prevProps.agentData?.agent?.bio === nextProps.agentData?.agent?.bio
  );
});
