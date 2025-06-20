import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import collectiveService from '../services/CollectiveService';
import enhancedAIService from '../services/EnhancedAIService';
import { deriveCharacterBurnAddress } from '../api/solana';
import toast from 'react-hot-toast';
import './SimplifiedCharacterInterface.css';

/**
 * Simplified Character Interface
 * 
 * Simple local chat with AI characters. Create characters and chat with them locally.
 */

const SimplifiedCharacterInterface = () => {
  const { wallet, isConnected } = useWallet();
  const [characters, setCharacters] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [activeView, setActiveView] = useState('list'); // list, chat, create
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Chat state (per character)
  const [chatHistory, setChatHistory] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  
  // AI service status
  const [aiStatus, setAiStatus] = useState(null);
  
  // Refs
  const chatEndRef = useRef(null);
  
  // Character creation form state
  const [characterForm, setCharacterForm] = useState({
    name: '',
    bio: '',
    prompt: '',
    traits: []
  });

  // Load characters and AI status on mount
  useEffect(() => {
    const loadedCharacters = collectiveService.getCharacters();
    
    // Ensure default agent exists and is linked to journal
    const defaultAgent = collectiveService.getDefaultAgent();
    if (defaultAgent && !loadedCharacters[defaultAgent.id]) {
      loadedCharacters[defaultAgent.id] = defaultAgent;
    }
    
    setCharacters(loadedCharacters);
    
    // Initialize chat history for each character
    const chatHistoryData = {};
    Object.values(loadedCharacters).forEach(character => {
      chatHistoryData[character.id] = [];
    });
    setChatHistory(chatHistoryData);
    
    // Check AI service status
    checkAIStatus();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, selectedCharacter]);

  const checkAIStatus = async () => {
    const status = await enhancedAIService.getInferenceEndpoint();
    setAiStatus(status);
  };

  // Character form handlers
  const handleFormChange = (field, value) => {
    setCharacterForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTraitsChange = (traitsString) => {
    const traits = traitsString.split(',').map(t => t.trim()).filter(t => t);
    setCharacterForm(prev => ({
      ...prev,
      traits
    }));
  };

  const validateCharacterForm = () => {
    if (!characterForm.name.trim()) {
      toast.error('Character name is required');
      return false;
    }
    if (!characterForm.bio.trim()) {
      toast.error('Character bio is required');
      return false;
    }
    return true;
  };

  const handleAutoGenerate = async () => {
    if (!aiStatus?.available) {
      toast.error('AI service not available. Please check settings.');
      return;
    }

    setIsGenerating(true);
    
    try {
      const basePrompt = characterForm.name 
        ? `Create a character named "${characterForm.name}"`
        : 'Create a unique AI character';
      
      const fullPrompt = `${basePrompt}

Create a JSON object with:
{
  "name": "character name",
  "bio": "2-3 sentence character description",
  "prompt": "detailed personality and behavior prompt (100-200 words)",
  "traits": ["trait1", "trait2", "trait3", "trait4"]
}

Make them interesting and unique for conversations.`;

      const result = await enhancedAIService.generate(fullPrompt, {
        temperature: 0.8,
        maxTokens: 600,
        systemPrompt: 'You are a character creator. Return only valid JSON, no additional text.'
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      let generatedCharacter;
      
      try {
        const cleanResponse = result.text.replace(/```json|```/g, '').trim();
        generatedCharacter = JSON.parse(cleanResponse);
      } catch {
        // If JSON parsing fails, create a basic character
        generatedCharacter = {
          name: characterForm.name || 'AI Character',
          bio: 'A helpful AI assistant ready for conversation.',
          prompt: 'You are a friendly AI character who enjoys meaningful conversations.',
          traits: ['helpful', 'curious', 'thoughtful', 'creative']
        };
      }

      // Update form with generated data
      setCharacterForm(prev => ({
        ...prev,
        name: generatedCharacter.name || prev.name,
        bio: generatedCharacter.bio || prev.bio,
        prompt: generatedCharacter.prompt || prev.prompt,
        traits: Array.isArray(generatedCharacter.traits) ? generatedCharacter.traits : prev.traits
      }));

      toast.success('Character generated! Review and create.');
      
    } catch (error) {
      console.error('Auto-generation error:', error);
      toast.error('Failed to generate character. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (!validateCharacterForm()) {
      return;
    }

    setIsCreating(true);
    
    try {
      const characterDef = {
        ...characterForm,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        creator: isConnected ? wallet.address : 'local',
        platform: 'rati-collective'
      };

      // Use the new createCharacterWithAgent method
      const result = await collectiveService.createCharacterWithAgent(
        characterDef, 
        isConnected ? wallet : null
      );

      if (result.success) {
        const newCharacter = result.character;
        
        if (!result.isLocal && result.arweaveTxId) {
          const burnAddress = deriveCharacterBurnAddress(result.arweaveTxId);
          newCharacter.burnAddress = burnAddress;
        }
        
        toast.success(result.isLocal ? 
          'Local character created successfully!' : 
          'Character created on Arweave!'
        );
        
        // Update local state
        setCharacters(prev => ({
          ...prev,
          [newCharacter.id]: newCharacter
        }));
        
        // Initialize chat for new character
        setChatHistory(prev => ({
          ...prev,
          [newCharacter.id]: []
        }));
        
        // Select the new character
        setSelectedCharacter(newCharacter);
        setActiveView('chat');
        
        // Reset form
        setCharacterForm({
          name: '',
          bio: '',
          prompt: '',
          traits: []
        });
        
      } else {
        toast.error(`Character creation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Character creation error:', error);
      toast.error('Character creation failed. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Chat handlers
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedCharacter || isResponding) return;
    
    if (!aiStatus?.available) {
      toast.error('AI service not available. Please check settings.');
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsResponding(true);

    // Add user message to chat history
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => ({
      ...prev,
      [selectedCharacter.id]: [...(prev[selectedCharacter.id] || []), newUserMessage]
    }));

    try {
      // Generate character response
      const result = await enhancedAIService.generateCharacterResponse(
        userMessage,
        selectedCharacter.definition,
        chatHistory[selectedCharacter.id] || []
      );

      if (result.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.text,
          timestamp: new Date().toISOString(),
          model: result.model
        };

        setChatHistory(prev => ({
          ...prev,
          [selectedCharacter.id]: [...(prev[selectedCharacter.id] || []), assistantMessage]
        }));
      } else {
        toast.error(`Failed to generate response: ${result.error}`);
        
        // Add fallback message
        const fallbackMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `I'm having trouble connecting to my AI processing right now. Could you try again in a moment?`,
          timestamp: new Date().toISOString(),
          error: true
        };

        setChatHistory(prev => ({
          ...prev,
          [selectedCharacter.id]: [...(prev[selectedCharacter.id] || []), fallbackMessage]
        }));
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
    } finally {
      setIsResponding(false);
    }
  };

  const renderCharacterList = () => {
    const characterList = Object.values(characters);
    
    return (
      <div className="character-interface">
        <div className="interface-header">
          <h2>Local Chat</h2>
          <p className="interface-subtitle">Create and chat with AI characters locally</p>
          <div className="ai-status-indicator">
            {aiStatus?.available ? (
              <span className="status-connected">🟢 AI Ready ({aiStatus.model})</span>
            ) : (
              <span className="status-disconnected">🔴 AI Offline</span>
            )}
          </div>
        </div>

        {characterList.length === 0 ? (
          <div className="no-characters">
            <h3>No Characters Yet</h3>
            <p>Create your first AI character to start chatting!</p>
            <button 
              className="create-character-btn primary"
              onClick={() => setActiveView('create')}
            >
              Create Character
            </button>
          </div>
        ) : (
          <div className="character-grid">
            {characterList.map(character => (
              <div 
                key={character.id}
                className="character-card"
                onClick={() => {
                  setSelectedCharacter(character);
                  setActiveView('chat');
                }}
              >
                <div className="character-avatar">
                  {character.definition.name.charAt(0).toUpperCase()}
                </div>
                <div className="character-info">
                  <h4>{character.definition.name}</h4>
                  <p className="character-bio">{character.definition.bio}</p>
                  <div className="character-stats">
                    <span className="messages">
                      {(chatHistory[character.id] || []).length} messages
                    </span>
                  </div>
                  <div className="character-traits">
                    {character.definition.traits.map((trait, index) => (
                      <span key={index} className="trait-badge">{trait}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            
            <div 
              className="character-card create-new"
              onClick={() => setActiveView('create')}
            >
              <div className="create-icon">+</div>
              <div className="create-text">
                <h4>Create New</h4>
                <p>Add a new character</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChat = () => {
    if (!selectedCharacter) return null;

    return (
      <div className="chat-interface">
        <div className="chat-header">
          <button 
            className="back-btn"
            onClick={() => setActiveView('list')}
          >
            ← Back
          </button>
          <div className="chat-character-info">
            <div className="character-avatar-small">
              {selectedCharacter.definition.name.charAt(0).toUpperCase()}
            </div>
            <div className="character-details">
              <h3>{selectedCharacter.definition.name}</h3>
              <p>{selectedCharacter.definition.bio}</p>
            </div>
          </div>
        </div>

        <div className="chat-messages">
          {(chatHistory[selectedCharacter.id] || []).map(message => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-content">
                {message.content}
              </div>
              <div className="message-meta">
                {new Date(message.timestamp).toLocaleTimeString()}
                {message.model && <span className="model-tag">{message.model}</span>}
              </div>
            </div>
          ))}
          {isResponding && (
            <div className="message assistant typing">
              <div className="message-content">
                {selectedCharacter.definition.name} is thinking...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <div className="chat-input-area">
          <div className="input-group">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Chat with ${selectedCharacter.definition.name}...`}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isResponding || !aiStatus?.available}
              className="send-btn"
            >
              {isResponding ? '⏳' : '→'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateForm = () => {
    return (
      <div className="create-character-interface">
        <div className="create-header">
          <button 
            className="back-btn"
            onClick={() => setActiveView('list')}
          >
            ← Back
          </button>
          <h3>Create AI Character</h3>
        </div>
        
        <div className="create-form">
          <div className="form-section">
            <div className="form-group">
              <label>Character Name</label>
              <input
                type="text"
                value={characterForm.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Enter character name"
              />
            </div>
            
            <div className="form-group">
              <label>Biography</label>
              <textarea
                value={characterForm.bio}
                onChange={(e) => handleFormChange('bio', e.target.value)}
                placeholder="Brief character description (2-3 sentences)"
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label>Character Traits</label>
              <input
                type="text"
                value={characterForm.traits.join(', ')}
                onChange={(e) => handleTraitsChange(e.target.value)}
                placeholder="curious, helpful, creative, thoughtful (comma-separated)"
              />
            </div>

            <div className="form-group">
              <label>Character Prompt (Optional)</label>
              <textarea
                value={characterForm.prompt}
                onChange={(e) => handleFormChange('prompt', e.target.value)}
                placeholder="Detailed instructions for how this character should behave and respond..."
                rows={6}
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              onClick={handleAutoGenerate}
              disabled={isGenerating || !aiStatus?.available}
              className="auto-generate-btn"
            >
              {isGenerating ? 'Generating...' : '✨ Auto-Generate'}
            </button>
            
            <button 
              onClick={handleCreateCharacter}
              disabled={isCreating}
              className="create-btn primary"
            >
              {isCreating ? 'Creating...' : 
                isConnected ? 'Create Character (Arweave)' : 'Create Character (Local)'}
            </button>
          </div>

          {!isConnected && (
            <div className="wallet-info">
              ℹ️ Connect your Arweave wallet to create permanent characters on Arweave, or create local characters for testing
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="simplified-character-interface">
      {activeView === 'list' && renderCharacterList()}
      {activeView === 'chat' && renderChat()}
      {activeView === 'create' && renderCreateForm()}
    </div>
  );
};

export default SimplifiedCharacterInterface;
