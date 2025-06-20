import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import collectiveService from '../services/CollectiveService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import toast from 'react-hot-toast';
import './CharacterChat.css';

/**
 * Character Chat Interface
 * 
 * Enables direct conversation with registered characters using:
 * - Character selection from user's collection
 * - Inference endpoint integration
 * - Persistent chat history
 * - Character-aware responses
 */

const CharacterChat = () => {
  const { isConnected: _isConnected } = useWallet();
  const [characters, setCharacters] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userSettings, setUserSettings] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);

  // Load characters and settings on mount
  useEffect(() => {
    const loadedCharacters = collectiveService.getCharacters();
    setCharacters(loadedCharacters);
    
    const settings = collectiveService.getUserSettings();
    setUserSettings(settings);
    
    // Auto-select first character if available
    const characterList = Object.values(loadedCharacters);
    if (characterList.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characterList[0]);
    }
  }, [selectedCharacter]);

  // Load chat history when character changes
  useEffect(() => {
    if (selectedCharacter) {
      const chatHistory = localStorage.getItem(`chat_${selectedCharacter.id}`);
      if (chatHistory) {
        try {
          setMessages(JSON.parse(chatHistory));
        } catch (error) {
          console.error('Failed to load chat history:', error);
          setMessages([]);
        }
      } else {
        // Initialize with character greeting
        setMessages([
          {
            id: Date.now(),
            type: 'character',
            content: `Hello! I'm **${selectedCharacter.definition.name}**. ${selectedCharacter.definition.bio}\n\nWhat would you like to talk about?`,
            timestamp: new Date().toISOString()
          }
        ]);
      }
    }
  }, [selectedCharacter]);

  // Save chat history when messages change
  useEffect(() => {
    if (selectedCharacter && messages.length > 0) {
      localStorage.setItem(`chat_${selectedCharacter.id}`, JSON.stringify(messages));
    }
  }, [messages, selectedCharacter]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCharacterSelect = (character) => {
    setSelectedCharacter(character);
    setMessages([]); // Will be loaded by useEffect
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (!selectedCharacter) {
      toast.error('Please select a character first');
      return;
    }
    if (!userSettings.inferenceEndpoint) {
      toast.error('Please configure inference endpoint in settings');
      setShowSettings(true);
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Prepare conversation context
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add current user message
      conversationHistory.push({
        role: 'user',
        content: inputText
      });

      // Run inference
      const response = await collectiveService.runInference(
        selectedCharacter.id,
        inputText,
        {
          conversation: conversationHistory,
          characterContext: {
            name: selectedCharacter.definition.name,
            bio: selectedCharacter.definition.bio,
            traits: selectedCharacter.definition.traits,
            burnAddress: selectedCharacter.burnAddress,
            balance: selectedCharacter.balance
          }
        }
      );

      // Extract response content
      let responseContent = 'I apologize, but I encountered an error generating a response.';
      
      if (response.choices && response.choices[0] && response.choices[0].message) {
        responseContent = response.choices[0].message.content;
      } else if (response.content) {
        responseContent = response.content;
      } else if (response.message) {
        responseContent = response.message;
      }

      const characterMessage = {
        id: Date.now() + 1,
        type: 'character',
        content: responseContent,
        timestamp: new Date().toISOString(),
        characterId: selectedCharacter.id
      };

      setMessages(prev => [...prev, characterMessage]);

    } catch (error) {
      console.error('Inference error:', error);
      toast.error('Failed to get character response');
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'character',
        content: `I apologize, but I'm having trouble connecting to my inference service right now. Please check your settings and try again.\n\nError: ${error.message}`,
        timestamp: new Date().toISOString(),
        characterId: selectedCharacter.id,
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    if (selectedCharacter) {
      localStorage.removeItem(`chat_${selectedCharacter.id}`);
      setMessages([
        {
          id: Date.now(),
          type: 'character',
          content: `Hello! I'm **${selectedCharacter.definition.name}**. ${selectedCharacter.definition.bio}\n\nWhat would you like to talk about?`,
          timestamp: new Date().toISOString()
        }
      ]);
      toast.success('Chat history cleared');
    }
  };

  const updateSettings = (newSettings) => {
    const updated = { ...userSettings, ...newSettings };
    setUserSettings(updated);
    collectiveService.updateUserSettings(updated);
    toast.success('Settings updated');
  };

  const renderCharacterSelector = () => {
    const characterList = Object.values(characters);
    
    if (characterList.length === 0) {
      return (
        <div className="no-characters">
          <p>No characters available. Create a character first!</p>
        </div>
      );
    }

    return (
      <div className="character-selector">
        <h3>Select Character</h3>
        <div className="character-list">
          {characterList.map(character => (
            <div
              key={character.id}
              className={`character-option ${selectedCharacter?.id === character.id ? 'selected' : ''}`}
              onClick={() => handleCharacterSelect(character)}
            >
              <div className="character-avatar">
                {character.definition.avatar ? (
                  <img src={character.definition.avatar} alt={character.definition.name} />
                ) : (
                  <div className="avatar-placeholder">
                    {character.definition.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="character-info">
                <div className="character-name">{character.definition.name}</div>
                <div className="character-balance">{character.balance} SOL</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    if (!showSettings) return null;

    return (
      <div className="settings-overlay">
        <div className="settings-panel">
          <h3>Inference Settings</h3>
          
          <div className="form-group">
            <label>Inference Endpoint *</label>
            <input
              type="url"
              value={userSettings.inferenceEndpoint || ''}
              onChange={(e) => updateSettings({ inferenceEndpoint: e.target.value })}
              placeholder="https://api.openai.com/v1/chat/completions"
            />
          </div>
          
          <div className="form-group">
            <label>API Key *</label>
            <input
              type="password"
              value={userSettings.apiKey || ''}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              placeholder="Your API key"
            />
          </div>
          
          <div className="form-group">
            <label>Model</label>
            <select
              value={userSettings.preferredModel || 'gpt-4'}
              onChange={(e) => updateSettings({ preferredModel: e.target.value })}
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              <option value="gemma3">Gemma 2</option>
            </select>
          </div>
          
          <div className="settings-buttons">
            <button
              className="btn-cancel"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (messages.length === 0) return null;

    return (
      <div className="messages-container">
        {messages.map(message => (
          <div
            key={message.id}
            className={`message ${message.type} ${message.isError ? 'error' : ''}`}
          >
            <div className="message-header">
              <span className="message-sender">
                {message.type === 'user' ? 'You' : selectedCharacter?.definition.name}
              </span>
              <span className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  // Custom components for better rendering
                  code: ({ inline, ...props }) => (
                    inline ? <code {...props} /> : <pre><code {...props} /></pre>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  return (
    <div className="character-chat">
      <div className="chat-header">
        <div className="header-title">
          <h2>Character Chat</h2>
          {selectedCharacter && (
            <div className="selected-character">
              Chatting with <strong>{selectedCharacter.definition.name}</strong>
            </div>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn-settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙️ Settings
          </button>
          {selectedCharacter && (
            <button
              className="btn-clear"
              onClick={clearChat}
            >
              🗑️ Clear Chat
            </button>
          )}
        </div>
      </div>

      <div className="chat-body">
        <div className="chat-sidebar">
          {renderCharacterSelector()}
        </div>

        <div className="chat-main">
          {!selectedCharacter ? (
            <div className="chat-placeholder">
              <h3>Select a character to start chatting</h3>
              <p>Choose from your registered characters on the left</p>
            </div>
          ) : (
            <>
              <div className="chat-messages">
                {renderMessages()}
                {isLoading && (
                  <div className="loading-indicator">
                    <div className="typing-animation">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>Character is thinking...</span>
                  </div>
                )}
              </div>

              <div className="chat-input">
                <div className="input-container">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Type your message to ${selectedCharacter.definition.name}...`}
                    rows={3}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputText.trim()}
                    className="send-button"
                  >
                    {isLoading ? '⏳' : '📤'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {renderSettings()}
    </div>
  );
};

export default CharacterChat;
