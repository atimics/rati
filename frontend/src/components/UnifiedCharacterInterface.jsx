import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useWallet } from '../contexts/WalletContext';
import collectiveService from '../services/CollectiveService';
import enhancedAIService from '../services/EnhancedAIService';
import { deriveCharacterBurnAddress, getBurnAddressInfo } from '../api/solana';
import toast from 'react-hot-toast';
import './UnifiedCharacterInterface.css';

/**
 * Unified Character Interface
 * 
 * Simplified interface for local chat with AI characters.
 * Focuses on character creation and direct conversation.
 */

const UnifiedCharacterInterface = () => {
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
    traits: [],
    avatar: '',
    metadata: {}
  });

  // Load characters and AI status on mount
  useEffect(() => {
    const loadedCharacters = collectiveService.getCharacters();
    setCharacters(loadedCharacters);
    
    // Initialize chat history and journal entries for each character
    const chatHistoryData = {};
    const journalData = {};
    
    Object.values(loadedCharacters).forEach(character => {
      chatHistoryData[character.id] = [];
      journalData[character.id] = [];
    });
    
    setChatHistory(chatHistoryData);
    setJournalEntries(journalData);
    
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
    if (!characterForm.prompt.trim()) {
      toast.error('Character prompt is required');
      return false;
    }
    return true;
  };

  const handleAutoGenerate = async () => {
    if (!aiStatus?.available) {
      toast.error('AI service not available. Please ensure Ollama is running.');
      return;
    }

    setIsGenerating(true);
    
    try {
      const basePrompt = characterForm.name 
        ? `Generate a detailed AI character profile for "${characterForm.name}"`
        : 'Generate a unique AI character profile for a decentralized collective';
      
      const fullPrompt = `${basePrompt}

${characterForm.bio ? `Current bio: ${characterForm.bio}` : ''}

Please return a JSON object with the following structure:
{
  "name": "character name${characterForm.name ? ` (enhance: ${characterForm.name})` : ''}",
  "bio": "2-3 sentence character biography focusing on their role in an AI collective",
  "prompt": "detailed system prompt for AI behavior (200-400 words)",
  "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "personality": "brief personality description",
  "expertise": "areas of knowledge/specialization",
  "communication_style": "how they communicate"
}

Make the character unique, interesting, and suitable for participating in decentralized AI collective discussions and governance.`;

      const result = await enhancedAIService.generate(fullPrompt, {
        temperature: 0.8,
        maxTokens: 800,
        systemPrompt: 'You are a character creation assistant. Always respond with valid JSON only, no additional text.'
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      let generatedCharacter;
      
      try {
        // Try to parse the AI response as JSON
        const cleanResponse = result.text.replace(/```json|```/g, '').trim();
        generatedCharacter = JSON.parse(cleanResponse);
      } catch (jsonParseError) {
        console.warn('Failed to parse AI response as JSON:', jsonParseError);
        // If JSON parsing fails, create a basic character from the text response
        generatedCharacter = {
          name: characterForm.name || 'Generated Character',
          bio: result.text.substring(0, 200) + '...',
          prompt: result.text,
          traits: ['creative', 'analytical', 'collaborative', 'innovative', 'thoughtful'],
          personality: 'Generated from AI response',
          expertise: 'General AI assistance',
          communication_style: 'Helpful and engaging'
        };
      }

      // Update form with generated data
      setCharacterForm(prev => ({
        ...prev,
        name: generatedCharacter.name || prev.name,
        bio: generatedCharacter.bio || prev.bio,
        prompt: generatedCharacter.prompt || prev.prompt,
        traits: Array.isArray(generatedCharacter.traits) ? generatedCharacter.traits : prev.traits,
        metadata: {
          ...prev.metadata,
          personality: generatedCharacter.personality,
          expertise: generatedCharacter.expertise,
          communication_style: generatedCharacter.communication_style,
          auto_generated: true,
          generated_at: new Date().toISOString()
        }
      }));

      toast.success('Character details generated! Review and edit as needed.');
      
    } catch (error) {
      console.error('Auto-generation error:', error);
      toast.error('Failed to generate character. Please try again or fill out manually.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (!isConnected) {
      toast.error('Please connect your Arweave wallet first');
      return;
    }

    if (!validateCharacterForm()) {
      return;
    }

    setIsCreating(true);
    
    try {
      // Prepare character definition
      const characterDef = {
        ...characterForm,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        creator: wallet.address,
        platform: 'rati-collective'
      };

      // Register character via collective service
      const result = await collectiveService.registerCharacter(characterDef, wallet);

      if (result.success) {
        // Derive burn address from Arweave TX
        const burnAddress = deriveCharacterBurnAddress(result.arweaveTxId);
        
        const newCharacter = {
          ...result.character,
          burnAddress: burnAddress
        };
        
        toast.success('Character registered successfully!');
        
        // Update local state
        setCharacters(prev => ({
          ...prev,
          [result.character.id]: newCharacter
        }));
        
        // Initialize chat and journal for new character
        setChatHistory(prev => ({
          ...prev,
          [result.character.id]: []
        }));
        
        setJournalEntries(prev => ({
          ...prev,
          [result.character.id]: []
        }));
        
        // Select the new character
        setSelectedCharacter(newCharacter);
        setActiveView('overview');
        
        // Reset form
        setCharacterForm({
          name: '',
          bio: '',
          prompt: '',
          traits: [],
          avatar: '',
          metadata: {}
        });
        setActiveView('overview');
        
        // Show burn address info
        toast.success(`Burn address generated: ${burnAddress.address.slice(0, 8)}...`);
      } else {
        toast.error(`Character registration failed: ${result.error}`);
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
      toast.error('AI service not available. Please ensure Ollama is running.');
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

  // Journal handlers
  const handleGenerateJournal = async () => {
    if (!selectedCharacter || isGeneratingJournal) return;
    
    if (!aiStatus?.available) {
      toast.error('AI service not available. Please ensure Ollama is running.');
      return;
    }

    setIsGeneratingJournal(true);

    try {
      const result = await enhancedAIService.generateCharacterJournal(
        selectedCharacter.definition,
        chatHistory[selectedCharacter.id] || []
      );

      if (result.success) {
        const newEntry = {
          id: Date.now(),
          content: result.text,
          timestamp: new Date().toISOString(),
          characterId: selectedCharacter.id,
          model: result.model
        };

        setJournalEntries(prev => ({
          ...prev,
          [selectedCharacter.id]: [newEntry, ...(prev[selectedCharacter.id] || [])]
        }));

        toast.success('Journal entry generated!');
      } else {
        toast.error(`Failed to generate journal entry: ${result.error}`);
      }
    } catch (error) {
      console.error('Journal generation error:', error);
      toast.error('Failed to generate journal entry');
    } finally {
      setIsGeneratingJournal(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const renderCharacterList = () => {
    const characterList = Object.values(characters);
    
    if (characterList.length === 0) {
      return (
        <div className="no-characters">
          <h3>No Characters Yet</h3>
          <p>Create your first RATi character to join the collective!</p>
          <button 
            className="create-character-btn primary"
            onClick={() => setActiveView('create')}
          >
            Create Character
          </button>
        </div>
      );
    }

    return (
      <div className="character-grid">
        {characterList.map(character => (
          <div 
            key={character.id}
            className={`character-card ${selectedCharacter?.id === character.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedCharacter(character);
              setActiveView('overview');
            }}
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
              <h4>{character.definition.name}</h4>
              <p className="character-bio">{character.definition.bio}</p>
              <div className="character-stats">
                <span className="messages">
                  {(chatHistory[character.id] || []).length} messages
                </span>
                <span className="journals">
                  {(journalEntries[character.id] || []).length} entries
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
            <h4>Create New Character</h4>
            <p>Add a new character to your collective</p>
          </div>
        </div>
      </div>
    );
  };

  const renderCharacterOverview = () => {
    if (!selectedCharacter) return null;

    const character = selectedCharacter;
    const messageCount = (chatHistory[character.id] || []).length;
    const journalCount = (journalEntries[character.id] || []).length;
    const burnAddressInfo = character.burnAddress ? getBurnAddressInfo(character.burnAddress.address) : null;

    return (
      <div className="character-overview">
        <div className="overview-header">
          <div className="character-avatar-large">
            {character.definition.avatar ? (
              <img src={character.definition.avatar} alt={character.definition.name} />
            ) : (
              <div className="avatar-placeholder-large">
                {character.definition.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="character-details">
            <h2>{character.definition.name}</h2>
            <p className="bio">{character.definition.bio}</p>
            <div className="traits-list">
              {character.definition.traits.map((trait, index) => (
                <span key={index} className="trait-badge">{trait}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="overview-stats">
          <div className="stat-card">
            <h3>Conversations</h3>
            <div className="stat-number">{messageCount}</div>
            <button 
              className="stat-action"
              onClick={() => setActiveView('chat')}
            >
              Start Chat
            </button>
          </div>
          <div className="stat-card">
            <h3>Journal Entries</h3>
            <div className="stat-number">{journalCount}</div>
            <button 
              className="stat-action"
              onClick={() => setActiveView('journal')}
            >
              View Journal
            </button>
          </div>
        </div>

        {burnAddressInfo && (
          <div className="burn-address-section">
            <h3>Character Burn Address</h3>
            <div className="burn-address-card">
              <div className="address-info">
                <span className="address-label">RATi Burn Address:</span>
                <code className="address-value">{burnAddressInfo.formatted}</code>
                <button 
                  className="copy-btn"
                  onClick={() => copyToClipboard(burnAddressInfo.address)}
                  title="Copy full address"
                >
                  📋
                </button>
              </div>
              <p className="address-note">
                This is a deterministic "dead" address derived from your character's Arweave transaction.
                Any SOL/SPL tokens sent here support the character's standing in the collective.
              </p>
              <a 
                href={burnAddressInfo.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                View on Solana Explorer →
              </a>
            </div>
          </div>
        )}

        <div className="character-prompt-section">
          <h3>Character Prompt</h3>
          <div className="prompt-content">
            {character.definition.prompt}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="unified-character-interface">
      <div className="interface-header">
        <h2>RATi Characters</h2>
        <div className="header-status">
          {aiStatus && (
            <div className={`ai-status ${aiStatus.available ? 'connected' : 'disconnected'}`}>
              <span className="status-indicator">●</span>
              <span className="status-text">
                {aiStatus.available ? `AI: ${aiStatus.model}` : 'AI: Offline'}
              </span>
            </div>
          )}
        </div>
      </div>

      {!selectedCharacter || activeView === 'overview' ? (
        <div className="character-list-view">
          {renderCharacterList()}
        </div>
      ) : (
        <div className="character-detail-view">
          <div className="detail-header">
            <button 
              className="back-btn"
              onClick={() => {
                setSelectedCharacter(null);
                setActiveView('overview');
              }}
            >
              ← Back to Characters
            </button>
            <h3>{selectedCharacter.definition.name}</h3>
            <nav className="detail-nav">
              <button 
                className={`nav-btn ${activeView === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveView('overview')}
              >
                Overview
              </button>
              <button 
                className={`nav-btn ${activeView === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveView('chat')}
              >
                Chat
              </button>
              <button 
                className={`nav-btn ${activeView === 'journal' ? 'active' : ''}`}
                onClick={() => setActiveView('journal')}
              >
                Journal
              </button>
            </nav>
          </div>

          <div className="detail-content">
            {activeView === 'overview' && renderCharacterOverview()}
            
            {activeView === 'chat' && (
              <div className="chat-interface">
                <div className="chat-messages">
                  {(chatHistory[selectedCharacter.id] || []).map(message => (
                    <div key={message.id} className={`message ${message.role}`}>
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
            )}
            
            {activeView === 'journal' && (
              <div className="journal-interface">
                <div className="journal-header">
                  <h3>{selectedCharacter.definition.name}'s Journal</h3>
                  <button 
                    onClick={handleGenerateJournal}
                    disabled={isGeneratingJournal || !aiStatus?.available}
                    className="generate-entry-btn"
                  >
                    {isGeneratingJournal ? 'Generating...' : 'Generate Entry'}
                  </button>
                </div>
                
                <div className="journal-entries">
                  {(journalEntries[selectedCharacter.id] || []).map(entry => (
                    <div key={entry.id} className="journal-entry">
                      <div className="entry-header">
                        <span className="entry-date">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                        {entry.model && <span className="model-tag">{entry.model}</span>}
                      </div>
                      <div className="entry-content">
                        {entry.content}
                      </div>
                    </div>
                  ))}
                  
                  {(journalEntries[selectedCharacter.id] || []).length === 0 && !isGeneratingJournal && (
                    <div className="no-entries">
                      <p>No journal entries yet. Generate the first entry to begin {selectedCharacter.definition.name}'s reflection journey.</p>
                    </div>
                  )}
                  
                  {isGeneratingJournal && (
                    <div className="journal-entry generating">
                      <div className="entry-content">
                        Generating journal entry...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'create' && (
        <div className="create-character-interface">
          <div className="create-header">
            <button 
              className="back-btn"
              onClick={() => setActiveView('overview')}
            >
              ← Back
            </button>
            <h3>Create New Character</h3>
          </div>
          
          <div className="create-form">
            <div className="form-section">
              <h4>Basic Information</h4>
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
                  placeholder="Brief character biography (2-3 sentences)"
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Character Traits</label>
                <input
                  type="text"
                  value={characterForm.traits.join(', ')}
                  onChange={(e) => handleTraitsChange(e.target.value)}
                  placeholder="curious, analytical, creative, empathetic (comma-separated)"
                />
              </div>
            </div>

            <div className="form-section">
              <h4>AI Behavior</h4>
              <div className="form-group">
                <label>Character Prompt</label>
                <textarea
                  value={characterForm.prompt}
                  onChange={(e) => handleFormChange('prompt', e.target.value)}
                  placeholder="Detailed prompt that defines how this character thinks and responds..."
                  rows={8}
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
                disabled={isCreating || !isConnected}
                className="create-btn primary"
              >
                {isCreating ? 'Creating...' : 'Create Character'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedCharacterInterface;
