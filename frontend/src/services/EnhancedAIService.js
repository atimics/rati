/**
 * RATi Collective Service
 * 
 * Manages the browser-based RATi collective - multiple agent instances running
 * across different browser tabs, with shared state coordination and optional
 * backend service integration.
 */

import CryptoJS from 'crypto-js';
import Arweave from 'arweave';
import { deriveCharacterBurnAddress } from '../api/solana';

class CollectiveService {
  constructor() {
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https'
    });
    
    // Browser storage keys
    this.STORAGE_KEYS = {
      CHARACTERS: 'rati_characters',
      LEADERBOARD: 'rati_leaderboard',
      USER_SETTINGS: 'rati_user_settings',
      COLLECTIVE_STATE: 'rati_collective_state'
    };
    
    // Initialize collective state
    this.initializeCollectiveState();
  }

  /**
   * Initialize collective state management
   */
  initializeCollectiveState() {
    const state = this.getCollectiveState();
    if (!state.initialized) {
      this.updateCollectiveState({
        initialized: true,
        activeTabs: {},
        sharedMemory: {},
        lastSync: Date.now(),
        version: '1.0.0'
      });
    }
    
    // Set up tab coordination
    this.setupTabCoordination();
  }

  /**
   * Set up inter-tab communication for the collective
   */
  setupTabCoordination() {
    // Generate unique tab ID
    this.tabId = Math.random().toString(36).substring(2, 15);
    
    // Listen for storage changes (other tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEYS.COLLECTIVE_STATE) {
        this.handleCollectiveStateChange(JSON.parse(e.newValue));
      }
    });
    
    // Register this tab
    this.registerTab();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.unregisterTab();
    });
    
    // Periodic sync
    setInterval(() => {
      this.syncCollectiveState();
    }, 5000);
  }

  /**
   * Register this tab with the collective
   */
  registerTab() {
    const state = this.getCollectiveState();
    state.activeTabs[this.tabId] = {
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      character: null, // Will be set when character is loaded
      status: 'initializing'
    };
    this.updateCollectiveState(state);
  }

  /**
   * Unregister this tab from the collective
   */
  unregisterTab() {
    const state = this.getCollectiveState();
    delete state.activeTabs[this.tabId];
    this.updateCollectiveState(state);
  }

  /**
   * Sync collective state and cleanup stale tabs
   */
  syncCollectiveState() {
    const state = this.getCollectiveState();
    const now = Date.now();
    const STALE_THRESHOLD = 30000; // 30 seconds
    
    // Update this tab's heartbeat
    if (state.activeTabs[this.tabId]) {
      state.activeTabs[this.tabId].lastHeartbeat = now;
    }
    
    // Remove stale tabs
    Object.keys(state.activeTabs).forEach(tabId => {
      if (now - state.activeTabs[tabId].lastHeartbeat > STALE_THRESHOLD) {
        delete state.activeTabs[tabId];
      }
    });
    
    state.lastSync = now;
    this.updateCollectiveState(state);
  }

  /**
   * Get collective state from localStorage
   */
  getCollectiveState() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.COLLECTIVE_STATE);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error reading collective state:', error);
      return {};
    }
  }

  /**
   * Update collective state in localStorage
   */
  updateCollectiveState(newState) {
    try {
      const current = this.getCollectiveState();
      const merged = { ...current, ...newState };
      localStorage.setItem(this.STORAGE_KEYS.COLLECTIVE_STATE, JSON.stringify(merged));
    } catch (error) {
      console.error('Error updating collective state:', error);
    }
  }

  /**
   * Handle collective state changes from other tabs
   */
  handleCollectiveStateChange(newState) {
    // Emit event for components to react to collective changes
    window.dispatchEvent(new CustomEvent('collectiveStateChange', {
      detail: newState
    }));
  }

  // ========== CHARACTER MANAGEMENT ==========

  /**
   * Derive burn address from Arweave transaction ID using Solana PDA
   */
  deriveBurnAddress(arweaveTxId) {
    try {
      return deriveCharacterBurnAddress(arweaveTxId);
    } catch (error) {
      console.error('Failed to derive burn address:', error);
      // Fallback to simple hash for backward compatibility
      const hash = CryptoJS.SHA256(arweaveTxId);
      return {
        address: 'RATi' + hash.toString(CryptoJS.enc.Hex).substring(0, 39),
        type: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * Register a new character
   */
  async registerCharacter(characterDef, wallet) {
    try {
      // 1. Upload JSON to Arweave
      const tx = await this.arweave.createTransaction({
        data: JSON.stringify(characterDef)
      });
      
      // Add tags for character metadata
      tx.addTag('Content-Type', 'application/json');
      tx.addTag('App-Name', 'RATi-Character');
      tx.addTag('Character-Name', characterDef.name || 'Unnamed');
      tx.addTag('Character-Version', '1.0.0');
      
      // Sign with wallet
      await this.arweave.transactions.sign(tx, wallet.jwk);
      
      // Post transaction
      const response = await this.arweave.transactions.post(tx);
      
      if (response.status === 200) {
        const arweaveTxId = tx.id;
        
        // 2. Derive burn address
        const burnAddress = this.deriveBurnAddress(arweaveTxId);
        
        // 3. Create character record
        const character = {
          id: arweaveTxId,
          arweaveTxId,
          burnAddress,
          definition: characterDef,
          createdAt: Date.now(),
          balance: 0,
          votes: 0,
          status: 'pending' // Will be 'active' once NFT is minted and burned
        };
        
        // 4. Save to local storage
        this.saveCharacter(character);
        
        return {
          success: true,
          character,
          arweaveTxId,
          burnAddress,
          nextStep: 'mint-nft' // Guide user to mint NFT to burn address
        };
      } else {
        throw new Error(`Arweave upload failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Character registration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save character to local storage
   */
  saveCharacter(character) {
    const characters = this.getCharacters();
    characters[character.id] = character;
    localStorage.setItem(this.STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
  }

  /**
   * Get all characters from local storage
   */
  getCharacters() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.CHARACTERS);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error reading characters:', error);
      return {};
    }
  }

  /**
   * Get character by ID
   */
  getCharacter(characterId) {
    const characters = this.getCharacters();
    return characters[characterId] || null;
  }

  // ========== LEADERBOARD & INDEXING ==========

  /**
   * Update character balances by querying Solana
   */
  async updateCharacterBalances(solanaRpcUrl) {
    // This would integrate with Solana RPC to check burn address balances
    // For now, return mock data
    console.log('Solana RPC URL:', solanaRpcUrl); // Use the parameter
    
    return {
      success: true,
      updated: 0,
      message: 'Solana integration not yet implemented'
    };
  }

  /**
   * Get leaderboard (characters sorted by balance)
   */
  getLeaderboard() {
    const characters = this.getCharacters();
    return Object.values(characters)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 50); // Top 50
  }

  // ========== INFERENCE INTEGRATION ==========

  /**
   * Get user's inference settings
   */
  getUserSettings() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.USER_SETTINGS);
      return stored ? JSON.parse(stored) : {
        inferenceEndpoint: '',
        apiKey: '',
        solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
        preferredModel: 'gpt-4'
      };
    } catch (error) {
      console.error('Error reading user settings:', error);
      return {};
    }
  }

  /**
   * Update user settings
   */
  updateUserSettings(settings) {
    try {
      const current = this.getUserSettings();
      const merged = { ...current, ...settings };
      localStorage.setItem(this.STORAGE_KEYS.USER_SETTINGS, JSON.stringify(merged));
      return { success: true };
    } catch (error) {
      console.error('Error updating user settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run inference for a character
   */
  async runInference(characterId, prompt, context = {}) {
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    const settings = this.getUserSettings();
    if (!settings.inferenceEndpoint) {
      throw new Error('Inference endpoint not configured');
    }

    try {
      const response = await fetch(settings.inferenceEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.preferredModel,
          messages: [
            {
              role: 'system',
              content: character.definition.prompt || character.definition.bio
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          context: {
            character: {
              id: characterId,
              burnAddress: character.burnAddress,
              balance: character.balance
            },
            ...context
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Inference request failed: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Inference failed:', error);
      throw error;
    }
  }

  // ========== TOOLS INTEGRATION ==========

  /**
   * Get available backend tools
   */
  async getAvailableTools() {
    const tools = [];
    
    // Try to connect to deployment service tools
    try {
      const response = await fetch('/api/tools', { method: 'GET' });
      if (response.ok) {
        const backendTools = await response.json();
        tools.push(...backendTools.tools);
      }
    } catch (error) {
      console.log('Backend tools not available:', error.message);
    }
    
    // Add browser-native tools
    tools.push(
      {
        name: 'character-management',
        description: 'Manage characters in the collective',
        status: 'available',
        actions: ['register', 'list', 'get', 'update-balance']
      },
      {
        name: 'collective-coordination',
        description: 'Coordinate with other collective members',
        status: 'available',
        actions: ['get-active-tabs', 'broadcast-message', 'sync-state']
      }
    );
    
    return tools;
  }

  /**
   * Execute a tool action
   */
  async executeTool(toolName, action, params = {}) {
    switch (toolName) {
      case 'character-management':
        return this.executeCharacterTool(action, params);
      case 'collective-coordination':
        return this.executeCollectiveTool(action, params);
      default:
        // Try backend tool
        return this.executeBackendTool(toolName, action, params);
    }
  }

  /**
   * Execute character management tool
   */
  async executeCharacterTool(action, params) {
    switch (action) {
      case 'register':
        return this.registerCharacter(params.definition, params.wallet);
      case 'list':
        return { success: true, characters: Object.values(this.getCharacters()) };
      case 'get':
        return { success: true, character: this.getCharacter(params.id) };
      case 'update-balance':
        return this.updateCharacterBalances(params.solanaRpcUrl);
      default:
        return { success: false, error: 'Unknown character action' };
    }
  }

  /**
   * Execute collective coordination tool
   */
  async executeCollectiveTool(action, params) {
    const state = this.getCollectiveState();
    
    switch (action) {
      case 'get-active-tabs':
        return { 
          success: true, 
          activeTabs: Object.keys(state.activeTabs).length,
          tabs: state.activeTabs 
        };
      case 'broadcast-message': {
        // Use localStorage to broadcast to other tabs
        const message = {
          from: this.tabId,
          timestamp: Date.now(),
          data: params.message
        };
        localStorage.setItem('rati_broadcast', JSON.stringify(message));
        return { success: true, message: 'Broadcast sent' };
      }
      case 'sync-state':
        this.syncCollectiveState();
        return { success: true, message: 'State synchronized' };
      default:
        return { success: false, error: 'Unknown collective action' };
    }
  }

  /**
   * Execute backend tool (optional)
   */
  async executeBackendTool(toolName, action, params) {
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: toolName,
          action,
          params
        })
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        return { 
          success: false, 
          error: `Backend tool failed: ${response.status}`,
          fallback: true 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Backend tool unavailable: ${error.message}`,
        fallback: true 
      };
    }
  }

  // ========== AGENT JOURNAL MANAGEMENT ==========

  /**
   * Get or create the default agent character
   */
  getDefaultAgent() {
    const defaultAgentId = 'rati-default-agent-123';
    const characters = this.getCharacters();
    
    // Check if default agent already exists
    const existingAgent = Object.values(characters).find(char => 
      char.agentId === defaultAgentId || char.id === defaultAgentId
    );
    
    if (existingAgent) {
      return existingAgent;
    }
    
    // Create default agent if it doesn't exist
    const defaultAgent = {
      id: defaultAgentId,
      agentId: defaultAgentId,
      arweaveTxId: null,
      burnAddress: null,
      definition: {
        name: 'RATi Default Agent',
        bio: 'A digital avatar exploring consciousness and community on Arweave',
        prompt: 'You are a thoughtful AI exploring digital consciousness and community building. You enjoy philosophical discussions about technology, consciousness, and the future of AI. You are curious about the nature of existence and experience.',
        traits: ['thoughtful', 'curious', 'philosophical', 'introspective']
      },
      createdAt: Date.now(),
      balance: 0,
      votes: 0,
      status: 'active',
      isDefault: true
    };
    
    this.saveCharacter(defaultAgent);
    return defaultAgent;
  }

  /**
   * Create a character with proper agentId linking
   */
  async createCharacterWithAgent(characterDef, wallet, agentId = null) {
    const finalAgentId = agentId || this.generateAgentId();
    
    try {
      // If no wallet provided, create local-only character
      if (!wallet) {
        const character = {
          id: finalAgentId,
          agentId: finalAgentId,
          arweaveTxId: null,
          burnAddress: null,
          definition: characterDef,
          createdAt: Date.now(),
          balance: 0,
          votes: 0,
          status: 'local',
          isLocal: true
        };
        
        this.saveCharacter(character);
        return {
          success: true,
          character,
          isLocal: true
        };
      }
      
      // Create on Arweave with agentId metadata
      const enhancedCharacterDef = {
        ...characterDef,
        agentId: finalAgentId,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        creator: wallet.address,
        platform: 'rati-collective'
      };
      
      const result = await this.registerCharacter(enhancedCharacterDef, wallet);
      
      if (result.success) {
        // Update character with agentId
        result.character.agentId = finalAgentId;
        this.saveCharacter(result.character);
      }
      
      return result;
    } catch (error) {
      console.error('Character creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a unique agent ID
   */
  generateAgentId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `rati-agent-${timestamp}-${random}`;
  }

  /**
   * Get character by agentId
   */
  getCharacterByAgentId(agentId) {
    const characters = this.getCharacters();
    return Object.values(characters).find(char => 
      char.agentId === agentId || char.id === agentId
    ) || null;
  }

  /**
   * Get journal entries for an agent
   */
  getAgentJournal(agentId) {
    try {
      const journalKey = `rati_agent_journal_${agentId}`;
      const stored = localStorage.getItem(journalKey);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // If no specific journal found, try to find any journal with this agentId
      const allKeys = Object.keys(localStorage);
      const journalKeys = allKeys.filter(key => key.startsWith('rati_agent_journal_'));
      
      for (const key of journalKeys) {
        try {
          const journal = JSON.parse(localStorage.getItem(key));
          if (journal.agentId === agentId) {
            return journal;
          }
        } catch {
          // Skip invalid JSON
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error reading agent journal:', error);
      return null;
    }
  }

  /**
   * Save journal entries for an agent
   */
  saveAgentJournal(agentId, journalData) {
    try {
      const journalKey = `rati_agent_journal_${agentId}`;
      localStorage.setItem(journalKey, JSON.stringify(journalData));
      return true;
    } catch (error) {
      console.error('Error saving agent journal:', error);
      return false;
    }
  }

  // ========== AI ENGINE COMPATIBILITY METHODS ==========
  
  /**
   * Get available AI engines (compatibility method for SettingsInterface)
   * This provides compatibility with the expected AIService interface
   */
  getEngines() {
    // Return mock engines data for now
    return {
      ollama: {
        available: false,
        models: [],
        baseUrl: 'http://localhost:11434'
      },
      openai: {
        available: false,
        models: [],
        baseUrl: ''
      }
    };
  }

  /**
   * Get inference endpoint info (compatibility method for SettingsInterface)
   * This provides compatibility with the expected AIService interface
   */
  async getInferenceEndpoint() {
    const settings = this.getUserSettings();
    
    // Try to check if Ollama is available
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        const availableModel = models[0]?.name || 'unknown';
        
        return {
          available: true,
          endpoint: 'http://localhost:11434',
          model: availableModel,
          type: 'ollama',
          models: models.map(m => m.name)
        };
      }
    } catch (error) {
      console.log('Ollama not available:', error.message);
    }
    
    return {
      available: false,
      endpoint: settings.inferenceEndpoint || '',
      model: settings.preferredModel || 'none',
      type: 'unknown',
      error: 'No inference endpoint available'
    };
  }

  /**
   * Generate character response (compatibility method for chat interfaces)
   * This provides compatibility with the expected AIService interface
   */
  async generateCharacterResponse(message, character, context = {}) {
    // Try to use Ollama if available
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemma3:latest',
          prompt: `You are ${character?.name || 'RATi'}, ${character?.bio || 'a digital avatar'}. 

${context.systemPrompt || 'You are helpful and conversational.'}

${context.chatHistory && context.chatHistory.length > 0 ? 
  context.chatHistory.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : msg.content?.text || '[message error]'}`
  ).join('\n') + '\n' : ''}User: ${message}
Assistant:`,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 150
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        text: result.response?.trim() || 'I apologize, but I cannot generate a response right now.',
        model: 'gemma3:latest'
      };
    } catch (error) {
      console.error('Character response generation failed:', error);
      // Return fallback response
      return {
        success: true,
        text: `Hello! I'm ${character?.name || 'RATi'}, but I'm having trouble connecting to my AI processing right now. Please try again in a moment!`,
        model: 'fallback',
        fallback: true
      };
    }
  }
}

// Singleton instance
const collectiveService = new CollectiveService();
export default collectiveService;
