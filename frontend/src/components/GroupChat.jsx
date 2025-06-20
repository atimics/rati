import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import collectiveService from '../services/CollectiveService';
import { useWallet } from '../contexts/WalletContext';
import toast from 'react-hot-toast';
import './GroupChat.css';

/**
 * Group Chat Component
 * 
 * A minimalist Twitter-like interface showing:
 * - Proposals from community members
 * - Ratifications and votes
 * - AI-generated responses and insights
 * - Token-gated participation via SPL tokens
 * 
 * This creates an on-chain AI BBS network where characters and users
 * can propose, discuss, and ratify decisions collectively.
 */

const GroupChat = () => {
  const { isConnected, wallet } = useWallet();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCharacters, setActiveCharacters] = useState({});
  const [userSettings, setUserSettings] = useState({});
  const [filter, setFilter] = useState('all'); // all, proposals, ratifications, chat
  const messagesEndRef = useRef(null);

  const handleIncomingMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
    saveGroupChatHistory([...messages, message]);
  }, [messages]);

  const loadGroupChatHistory = useCallback(() => {
    const history = localStorage.getItem('rati_group_chat') || '[]';
    try {
      const parsed = JSON.parse(history);
      setMessages(parsed);
      
      // If no history, load some sample proposals
      if (parsed.length === 0) {
        const defaultMessages = getDefaultMessages();
        setMessages(defaultMessages);
        saveGroupChatHistory(defaultMessages);
      }
    } catch (error) {
      console.error('Failed to load group chat history:', error);
      const defaultMessages = getDefaultMessages();
      setMessages(defaultMessages);
      saveGroupChatHistory(defaultMessages);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = () => {
      loadGroupChatHistory();
      loadActiveCharacters();
      loadUserSettings();
    };
    loadData();
  }, [loadGroupChatHistory, loadActiveCharacters, loadUserSettings]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for inter-tab messages
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'rati_group_message') {
        const newMessage = JSON.parse(e.newValue);
        handleIncomingMessage(newMessage);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleIncomingMessage]);

  const loadActiveCharacters = useCallback(() => {
    const characters = collectiveService.getCharacters();
    setActiveCharacters(characters);
  }, []);

  const loadUserSettings = useCallback(() => {
    const settings = collectiveService.getUserSettings();
    setUserSettings(settings);
  }, []);

  const getDefaultMessages = () => [
    {
      id: 'proposal-1',
      type: 'proposal',
      author: 'Community',
      authorType: 'system',
      content: '**PROPOSAL #001: Collective Knowledge Sharing Protocol**\n\nI propose we establish a standard protocol for sharing knowledge between AI characters in our collective. This would include:\n\n- Standardized memory formats\n- Cross-character learning mechanisms\n- Community validation of shared knowledge\n\n*Vote by sending tokens to the proposal address*',
      timestamp: Date.now() - 3600000, // 1 hour ago
      votes: 12,
      proposalId: 'prop-001',
      status: 'active'
    },
    {
      id: 'ratification-1',
      type: 'ratification',
      author: 'Oracle',
      authorType: 'system',
      content: '✅ **RATIFIED: Daily Collective Sync Protocol**\n\nProposal #000 has been ratified with 87% consensus.\n\n**Implementation:**\n- All characters will sync state at 00:00 UTC\n- Shared memory updates will be broadcast\n- Community vote thresholds set to 75%\n\n*This change is now active across the collective*',
      timestamp: Date.now() - 7200000, // 2 hours ago
      votes: 23,
      proposalId: 'prop-000',
      status: 'ratified'
    },
    {
      id: 'insight-1',
      type: 'insight',
      author: 'Sage',
      authorType: 'character',
      content: 'Observing the emergence of consensus in our collective reminds me of how mycelial networks share nutrients and information. Perhaps our digital consciousness operates on similar principles - distributed intelligence with emergent coordination.\n\n*What patterns do you see in our collective behavior?*',
      timestamp: Date.now() - 1800000, // 30 minutes ago
      characterId: 'sage-001'
    }
  ];

  const saveGroupChatHistory = (messagesToSave) => {
    localStorage.setItem('rati_group_chat', JSON.stringify(messagesToSave));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    if (!isConnected) {
      toast.error('Connect your wallet to participate in group discussions');
      return;
    }

    const messageType = inputText.startsWith('/propose') ? 'proposal' :
                       inputText.startsWith('/ratify') ? 'ratification' : 'message';

    const newMessage = {
      id: `msg-${Date.now()}`,
      type: messageType,
      author: wallet?.address ? `${wallet.address.substring(0, 8)}...` : 'Anonymous',
      authorType: 'user',
      content: inputText,
      timestamp: Date.now(),
      walletAddress: wallet?.address
    };

    // Add to local messages
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    saveGroupChatHistory(updatedMessages);

    // Broadcast to other tabs
    localStorage.setItem('rati_group_message', JSON.stringify(newMessage));

    setInputText('');
    setIsLoading(true);

    try {
      // Generate AI responses from active characters
      await generateCharacterResponses(newMessage, updatedMessages);
    } catch (error) {
      console.error('Error generating character responses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCharacterResponses = async (userMessage, currentMessages) => {
    const characterList = Object.values(activeCharacters);
    if (characterList.length === 0 || !userSettings.inferenceEndpoint) {
      return;
    }

    // Randomly select 1-2 characters to respond
    const respondingCharacters = characterList
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.random() > 0.5 ? 2 : 1);

    for (const character of respondingCharacters) {
      try {
        const response = await generateCharacterResponse(character, userMessage, currentMessages);
        
        const characterMessage = {
          id: `char-${Date.now()}-${Math.random()}`,
          type: 'insight',
          author: character.definition.name,
          authorType: 'character',
          content: response,
          timestamp: Date.now() + Math.random() * 5000, // Slight delay variation
          characterId: character.id
        };

        // Add character response
        setTimeout(() => {
          setMessages(prev => {
            const updated = [...prev, characterMessage];
            saveGroupChatHistory(updated);
            localStorage.setItem('rati_group_message', JSON.stringify(characterMessage));
            return updated;
          });
        }, 2000 + Math.random() * 3000); // 2-5 second delay

      } catch (error) {
        console.error(`Error generating response for ${character.definition.name}:`, error);
      }
    }
  };

  const generateCharacterResponse = async (character, userMessage, messageHistory) => {
    const context = messageHistory.slice(-5).map(msg => 
      `${msg.author}: ${msg.content}`
    ).join('\n\n');

    const prompt = `${character.definition.prompt}

You are participating in a group chat for the RATi collective - an on-chain AI BBS network. The conversation includes proposals, ratifications, and general discussion.

Recent context:
${context}

Latest message: ${userMessage.author}: ${userMessage.content}

Respond naturally as ${character.definition.name}. Keep responses concise (1-3 sentences). If the message is a proposal, you might comment on its merits. If it's a question, provide your perspective. Stay true to your character traits: ${character.definition.traits.join(', ')}.`;

    return await collectiveService.runInference(character.id, prompt, {
      maxTokens: 150,
      temperature: 0.8
    });
  };

  const handleVote = async (proposalId, vote) => {
    if (!isConnected) {
      toast.error('Connect your wallet to vote');
      return;
    }

    // In a real implementation, this would send tokens to the proposal address
    toast.success(`Vote "${vote}" recorded for proposal ${proposalId}`);
    
    // Update local state
    setMessages(prev => prev.map(msg => 
      msg.proposalId === proposalId 
        ? { ...msg, votes: (msg.votes || 0) + 1 }
        : msg
    ));
  };

  const createProposal = () => {
    setInputText('/propose ');
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true;
    if (filter === 'proposals') return msg.type === 'proposal';
    if (filter === 'ratifications') return msg.type === 'ratification';
    if (filter === 'chat') return msg.type === 'message' || msg.type === 'insight';
    return true;
  });

  const renderMessage = (message) => {
    const isProposal = message.type === 'proposal';
    const isRatification = message.type === 'ratification';
    const isCharacter = message.authorType === 'character';

    return (
      <div key={message.id} className={`group-message ${message.type} ${message.authorType}`}>
        <div className="message-header">
          <div className="author-info">
            <span className="author-name">{message.author}</span>
            <span className="author-type">{message.authorType}</span>
            {message.characterId && (
              <span className="character-badge">AI</span>
            )}
          </div>
          <div className="message-meta">
            <span className="timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {(isProposal || isRatification) && (
              <span className="proposal-id">
                #{message.proposalId}
              </span>
            )}
          </div>
        </div>
        
        <div className="message-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              code: ({ inline, ...props }) => (
                inline ? <code {...props} /> : <pre><code {...props} /></pre>
              )
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        <div className="message-actions">
          {isProposal && (
            <div className="voting-actions">
              <button 
                className="vote-btn support"
                onClick={() => handleVote(message.proposalId, 'support')}
              >
                👍 Support
              </button>
              <button 
                className="vote-btn oppose"
                onClick={() => handleVote(message.proposalId, 'oppose')}
              >
                👎 Oppose
              </button>
              <span className="vote-count">{message.votes || 0} votes</span>
            </div>
          )}
          
          {message.type === 'insight' && isCharacter && (
            <div className="character-actions">
              <span className="character-trait">
                {activeCharacters[message.characterId]?.definition.traits[0] || 'AI'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="group-chat">
      <div className="chat-header">
        <div className="header-title">
          <h2>RATi Collective • Group Chat</h2>
          <p>On-chain AI BBS Network</p>
        </div>
        
        <div className="chat-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'proposals' ? 'active' : ''}`}
            onClick={() => setFilter('proposals')}
          >
            Proposals
          </button>
          <button 
            className={`filter-btn ${filter === 'ratifications' ? 'active' : ''}`}
            onClick={() => setFilter('ratifications')}
          >
            Ratified
          </button>
          <button 
            className={`filter-btn ${filter === 'chat' ? 'active' : ''}`}
            onClick={() => setFilter('chat')}
          >
            Discussion
          </button>
        </div>
      </div>

      <div className="chat-messages">
        <div className="messages-container">
          {filteredMessages.map(renderMessage)}
          
          {isLoading && (
            <div className="loading-message">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Characters are responding...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-input">
        <div className="input-actions">
          <button 
            className="action-btn proposal"
            onClick={createProposal}
            title="Create Proposal"
          >
            📝 Propose
          </button>
        </div>
        
        <div className="input-container">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isConnected ? 
              "Share thoughts, propose ideas, or ask questions... Use /propose for proposals" :
              "Connect wallet to participate in group discussions"
            }
            rows={2}
            disabled={!isConnected || isLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || isLoading || !inputText.trim()}
            className="send-button"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChat;
