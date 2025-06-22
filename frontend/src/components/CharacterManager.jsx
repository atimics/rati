import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import collectiveService from '../services/CollectiveService';
import toast from 'react-hot-toast';
import './CharacterManager.css';

/**
 * Character Manager Component
 * 
 * Implements the character registration workflow:
 * 1. Upload JSON definition to Arweave
 * 2. Derive burn address from transaction ID
 * 3. Guide user to mint NFT to burn address
 * 4. Track character balances and community voting
 */

const CharacterManager = () => {
  const { wallet, isConnected } = useWallet();
  const [characters, setCharacters] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Character creation form state
  const [characterForm, setCharacterForm] = useState({
    name: '',
    bio: '',
    prompt: '',
    traits: [],
    avatar: '',
    metadata: {}
  });

  // Load characters on mount
  useEffect(() => {
    const loadedCharacters = collectiveService.getCharacters();
    setCharacters(loadedCharacters);
  }, []);

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
    setIsGenerating(true);
    
    try {
      // Create a prompt for character generation based on existing form data
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

      const response = await fetch('/api/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          system: 'You are a character creation assistant. Always respond with valid JSON only, no additional text.',
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate character');
      }

      const result = await response.json();
      let generatedCharacter;
      
      try {
        // Try to parse the AI response as JSON
        const cleanResponse = result.response.replace(/```json|```/g, '').trim();
        generatedCharacter = JSON.parse(cleanResponse);
      } catch (jsonParseError) {
        console.warn('Failed to parse AI response as JSON:', jsonParseError);
        // If JSON parsing fails, create a basic character from the text response
        generatedCharacter = {
          name: characterForm.name || 'Generated Character',
          bio: result.response.substring(0, 200) + '...',
          prompt: result.response,
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
        toast.success('Character registered successfully!');
        
        // Update local state
        setCharacters(prev => ({
          ...prev,
          [result.character.id]: result.character
        }));
        
        // Select the new character
        setSelectedCharacter(result.character);
        
        // Reset form
        setCharacterForm({
          name: '',
          bio: '',
          prompt: '',
          traits: [],
          avatar: '',
          metadata: {}
        });
        setShowCreateForm(false);
        
        // Show next steps
        toast.success('Next: Mint an NFT to the burn address to activate your character');
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

  const handleUpdateBalances = async () => {
    try {
      const result = await collectiveService.updateCharacterBalances();
      if (result.success) {
        toast.success(result.message);
        // Reload characters to show updated balances
        const updatedCharacters = collectiveService.getCharacters();
        setCharacters(updatedCharacters);
      }
    } catch (error) {
      console.error('Balance update error:', error);
      toast.error('Failed to update balances');
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
        </div>
      );
    }

    return (
      <div className="character-grid">
        {characterList.map(character => (
          <div 
            key={character.id}
            className={`character-card ${selectedCharacter?.id === character.id ? 'selected' : ''}`}
            onClick={() => setSelectedCharacter(character)}
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
                <span className="balance">Balance: {character.balance} SOL</span>
                <span className="status">Status: {character.status}</span>
              </div>
              <div className="character-traits">
                {character.definition.traits.map((trait, index) => (
                  <span key={index} className="trait-badge">{trait}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSelectedCharacter = () => {
    if (!selectedCharacter) return null;

    return (
      <div className="character-details">
        <h3>Character Details</h3>
        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="detail-row">
            <span>Name:</span>
            <span>{selectedCharacter.definition.name}</span>
          </div>
          <div className="detail-row">
            <span>Bio:</span>
            <span>{selectedCharacter.definition.bio}</span>
          </div>
          <div className="detail-row">
            <span>Status:</span>
            <span className={`status-badge ${selectedCharacter.status}`}>
              {selectedCharacter.status}
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h4>Blockchain Information</h4>
          <div className="detail-row">
            <span>Arweave TX ID:</span>
            <span className="monospace">
              {selectedCharacter.arweaveTxId}
              <button 
                className="copy-btn"
                onClick={() => copyToClipboard(selectedCharacter.arweaveTxId)}
              >
                📋
              </button>
            </span>
          </div>
          <div className="detail-row">
            <span>Burn Address:</span>
            <span className="monospace">
              {selectedCharacter.burnAddress}
              <button 
                className="copy-btn"
                onClick={() => copyToClipboard(selectedCharacter.burnAddress)}
              >
                📋
              </button>
            </span>
          </div>
          <div className="detail-row">
            <span>Balance:</span>
            <span>{selectedCharacter.balance} SOL</span>
          </div>
        </div>

        <div className="detail-section">
          <h4>Character Prompt</h4>
          <div className="prompt-display">
            {selectedCharacter.definition.prompt}
          </div>
        </div>

        <div className="character-actions">
          <button 
            className="action-btn primary"
            onClick={() => copyToClipboard(selectedCharacter.burnAddress)}
          >
            Copy Burn Address
          </button>
          <button className="action-btn secondary">
            View on Arweave
          </button>
          <button className="action-btn secondary">
            Chat with Character
          </button>
        </div>
      </div>
    );
  };

  const renderCreateForm = () => {
    if (!showCreateForm) return null;

    return (
      <div className="create-form-overlay">
        <div className="create-form">
          <h3>Create New Character</h3>
          
          <div className="auto-generate-section">
            <button 
              className="btn-auto-generate"
              onClick={handleAutoGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? '🤖 Generating...' : '✨ Auto-Generate Character'}
            </button>
            <p className="auto-generate-hint">
              Fill out the name field (optional) and click to generate a complete character profile using AI
            </p>
          </div>
          
          <div className="form-group">
            <label>Character Name *</label>
            <input
              type="text"
              value={characterForm.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="Enter character name (optional for auto-generation)"
            />
          </div>

          <div className="form-group">
            <label>Bio *</label>
            <textarea
              value={characterForm.bio}
              onChange={(e) => handleFormChange('bio', e.target.value)}
              placeholder="Describe your character in a few sentences"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Character Prompt *</label>
            <textarea
              value={characterForm.prompt}
              onChange={(e) => handleFormChange('prompt', e.target.value)}
              placeholder="Define your character's personality, knowledge, and behavior..."
              rows={8}
            />
          </div>

          <div className="form-group">
            <label>Traits (comma-separated)</label>
            <input
              type="text"
              value={characterForm.traits.join(', ')}
              onChange={(e) => handleTraitsChange(e.target.value)}
              placeholder="Curious, Helpful, Creative"
            />
          </div>

          <div className="form-group">
            <label>Avatar URL (optional)</label>
            <input
              type="url"
              value={characterForm.avatar}
              onChange={(e) => handleFormChange('avatar', e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </div>

          <div className="form-actions">
            <button 
              className="btn-cancel"
              onClick={() => setShowCreateForm(false)}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button 
              className="btn-create"
              onClick={handleCreateCharacter}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Character'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="character-manager">
      <div className="manager-header">
        <h2>RATi Character Manager</h2>
        <div className="header-actions">
          <button 
            className="btn-refresh"
            onClick={handleUpdateBalances}
          >
            🔄 Update Balances
          </button>
          <button 
            className="btn-create"
            onClick={() => setShowCreateForm(true)}
            disabled={!isConnected}
          >
            ➕ Create Character
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="wallet-warning">
          <p>⚠️ Connect your Arweave wallet to create and manage characters</p>
        </div>
      )}

      <div className="manager-content">
        <div className="characters-section">
          <h3>Your Characters</h3>
          {renderCharacterList()}
        </div>
        
        {selectedCharacter && (
          <div className="details-section">
            {renderSelectedCharacter()}
          </div>
        )}
      </div>

      {renderCreateForm()}
    </div>
  );
};

export default CharacterManager;
