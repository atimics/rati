import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import JournalManager from './JournalManager';
import './ChatInterface.css';

// Ollama configuration
const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'gemma2:2b'; // Fallback to gemma2:2b if gemma3 not available

const ChatInterface = ({ agentData }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [currentModel, setCurrentModel] = useState(MODEL_NAME);
  const [journalDraft, setJournalDraft] = useState('');
  const [publishedJournal, setPublishedJournal] = useState('');
  const messagesEndRef = useRef(null);

  // Handle journal updates from JournalManager
  const handleJournalUpdate = (draft, published) => {
    setJournalDraft(draft);
    setPublishedJournal(published);
  };

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
      checkOllamaConnection();
    }
  }, [agentData]);

  // Check Ollama connection and available models
  const checkOllamaConnection = async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        
        // Prefer gemma3, fallback to gemma2:2b
        if (models.some(m => m.name.includes('gemma3'))) {
          const gemma3Model = models.find(m => m.name.includes('gemma3')).name;
          setCurrentModel(gemma3Model);
          console.log(`Using ${gemma3Model} model`);
        } else if (models.some(m => m.name.includes('gemma2'))) {
          const gemma2Model = models.find(m => m.name.includes('gemma2')).name;
          setCurrentModel(gemma2Model);
          console.log(`Using ${gemma2Model} model`);
        } else {
          console.warn('No Gemma models found. Please install gemma3 or gemma2:2b');
        }
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
        console.error('Ollama not available');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('Error connecting to Ollama:', error);
    }
  };

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (agentData?.agent?.processId && messages.length > 0) {
      localStorage.setItem(`messages_${agentData.agent.processId}`, JSON.stringify(messages));
    }
  }, [messages, agentData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (agentData?.agent?.processId && messages.length > 0) {
      localStorage.setItem(`messages_${agentData.agent.processId}`, JSON.stringify(messages));
    }
  }, [messages, agentData?.agent?.processId]);

  // Function to chunk and summarize long chat histories
  const summarizeChatHistory = (messages, maxLength = 2000) => {
    const recentMessages = messages.slice(-10); // Always keep last 10 messages
    const recentText = recentMessages.map(m => `${m.type}: ${m.content}`).join('\n');
    
    if (recentText.length <= maxLength) {
      return recentText;
    }
    
    // If still too long, create a summary
    const summary = `[SUMMARY] Recent conversation covered ${messages.length} messages about: ` +
      messages.slice(-5).map(m => m.content.substring(0, 50) + '...').join('; ') +
      '\n\n[RECENT MESSAGES]\n' +
      recentMessages.slice(-3).map(m => `${m.type}: ${m.content}`).join('\n');
    
    return summary.substring(0, maxLength);
  };

  // Construct enhanced system prompt with journal and chat history
  const buildSystemPrompt = (userMessage) => {
    const baseSeed = agentData.agent.prompt || 
      `You are a RATi Digital Avatar, an autonomous AI entity living on the Arweave permanent web. You embody creativity, curiosity, and collaboration.`;
    
    let enhancedPrompt = `${baseSeed}\n\n`;
    
    // Add published journal (persistent memory)
    if (publishedJournal) {
      enhancedPrompt += `## YOUR PUBLISHED MEMORY JOURNAL:\n${publishedJournal}\n\n`;
    }
    
    // Add recent chat context
    if (messages.length > 0) {
      const chatContext = summarizeChatHistory(messages);
      enhancedPrompt += `## RECENT CONVERSATION CONTEXT:\n${chatContext}\n\n`;
    }
    
    // Add draft journal thoughts (if any)
    if (journalDraft) {
      enhancedPrompt += `## YOUR CURRENT THOUGHTS (DRAFT):\n${journalDraft}\n\n`;
    }
    
    enhancedPrompt += `## CURRENT INTERACTION:\nUser: ${userMessage}\nAssistant:`;
    
    return enhancedPrompt;
  };

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
      // Use enhanced system prompt with journal and chat context
      const enhancedPrompt = buildSystemPrompt(userMessage.content);
      
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: currentModel,
          prompt: enhancedPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const agentResponse = data.response || 'I apologize, but I had trouble generating a response. Please try again!';

      const agentMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: agentResponse.trim(),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);

    } catch (error) {
      console.error('Error with Ollama:', error);
      
      // Fallback response that still uses agent personality
      const fallbackMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: `I understand you said: "${userMessage.content}"

As your RATi digital avatar, I'm experiencing some technical difficulties with my AI processing right now. I'm running on Arweave with process ID \`${agentData.agent.processId}\`, but my Ollama connection seems to have an issue.

Could you please try your message again, or check if Ollama is running locally?`,
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

  if (!agentData) {
    return (
      <div className="chat-interface">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading agent...</p>
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
                    code({ inline, children, ...props }) {
                      return inline ? (
                        <code className="inline-code" {...props}>
                          {children}
                        </code>
                      ) : (
                        <pre className="code-block">
                          <code {...props}>{children}</code>
                        </pre>
                      );
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              <div className="message-time">
                {msg.timestamp.toLocaleTimeString()}
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

      {/* Journal Manager */}
      <JournalManager 
        agentData={agentData}
        messages={messages}
        onJournalUpdate={handleJournalUpdate}
      />
    </div>
  );
};

export default ChatInterface;
