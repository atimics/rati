import { dryrun, message, createDataItemSigner } from '@permaweb/aoconnect';
import config from '../config.js';

/**
 * Unified AO Service for RATi Frontend
 * 
 * Provides a clean interface for all AO process communication,
 * replacing the mock ArweaveService with real blockchain integration.
 */

class AOService {
  constructor() {
    this.wallet = null;
    this.signer = null;
    this.processIds = {
      avatar: null,
      oracle: null
    };
    this.isInitialized = false;
    this.connectionStatus = 'disconnected';
  }

  /**
   * Initialize AO service with wallet and process IDs
   */
  async initialize(wallet) {
    try {
      this.wallet = wallet;
      this.signer = createDataItemSigner(window.arweaveWallet);
      
      // Discover process IDs from deployment service
      await this.discoverProcessIds();
      
      this.isInitialized = true;
      this.connectionStatus = 'connected';
      
      console.log('✅ AO Service initialized with processes:', this.processIds);
      return true;
    } catch (error) {
      console.error('❌ AO Service initialization failed:', error);
      this.connectionStatus = 'error';
      throw error;
    }
  }

  /**
   * Discover process IDs from seed.json via deployment service
   */
  async discoverProcessIds() {
    try {
      // Try to get process IDs from deployment service
      const response = await fetch(`${config.arweaveProxy.baseUrl}/api/seed`);
      
      if (response.ok) {
        const seedData = await response.json();
        this.processIds = {
          avatar: seedData.agent?.processId || config.processes.cell,
          oracle: seedData.oracle?.processId || config.processes.oracle
        };
      } else {
        // Fallback to config values
        this.processIds = {
          avatar: config.processes.cell,
          oracle: config.processes.oracle
        };
      }
      
      // Validate process IDs
      if (!this.processIds.avatar || this.processIds.avatar === 'YOUR_CELL_PROCESS_ID_HERE') {
        throw new Error('Avatar process ID not configured. Please deploy processes first.');
      }
      
      if (!this.processIds.oracle || this.processIds.oracle === 'YOUR_ORACLE_PROCESS_ID_HERE') {
        throw new Error('Oracle process ID not configured. Please deploy processes first.');
      }
      
    } catch (error) {
      console.warn('Process ID discovery failed, using config defaults:', error);
      this.processIds = {
        avatar: config.processes.cell,
        oracle: config.processes.oracle
      };
    }
  }

  /**
   * Send a message to the Avatar process
   */
  async sendToAvatar(action, data = '', additionalTags = []) {
    if (!this.isInitialized) {
      throw new Error('AO Service not initialized');
    }

    const tags = [
      { name: 'Action', value: action },
      { name: 'From-Frontend', value: 'true' },
      ...additionalTags
    ];

    try {
      const msgId = await message({
        process: this.processIds.avatar,
        signer: this.signer,
        tags,
        data: typeof data === 'string' ? data : JSON.stringify(data)
      });

      console.log(`📤 Sent to Avatar (${action}):`, msgId.substring(0, 12) + '...');
      return msgId;
    } catch (error) {
      console.error(`❌ Failed to send to Avatar (${action}):`, error);
      throw error;
    }
  }

  /**
   * Query the Avatar process
   */
  async queryAvatar(action, additionalTags = []) {
    if (!this.isInitialized) {
      throw new Error('AO Service not initialized');
    }

    const tags = [
      { name: 'Action', value: action },
      ...additionalTags
    ];

    try {
      const result = await dryrun({
        process: this.processIds.avatar,
        tags
      });

      const data = result.Messages?.[0]?.Data;
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`❌ Failed to query Avatar (${action}):`, error);
      throw error;
    }
  }

  /**
   * Send a message to the Oracle process
   */
  async sendToOracle(action, data = '', additionalTags = []) {
    if (!this.isInitialized) {
      throw new Error('AO Service not initialized');
    }

    const tags = [
      { name: 'Action', value: action },
      { name: 'From-Frontend', value: 'true' },
      ...additionalTags
    ];

    try {
      const msgId = await message({
        process: this.processIds.oracle,
        signer: this.signer,
        tags,
        data: typeof data === 'string' ? data : JSON.stringify(data)
      });

      console.log(`📤 Sent to Oracle (${action}):`, msgId.substring(0, 12) + '...');
      return msgId;
    } catch (error) {
      console.error(`❌ Failed to send to Oracle (${action}):`, error);
      throw error;
    }
  }

  /**
   * Query the Oracle process
   */
  async queryOracle(action, additionalTags = []) {
    if (!this.isInitialized) {
      throw new Error('AO Service not initialized');
    }

    const tags = [
      { name: 'Action', value: action },
      ...additionalTags
    ];

    try {
      const result = await dryrun({
        process: this.processIds.oracle,
        tags
      });

      const data = result.Messages?.[0]?.Data;
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`❌ Failed to query Oracle (${action}):`, error);
      throw error;
    }
  }

  // === CHAT INTERFACE METHODS ===

  /**
   * Send a chat message to the Avatar process
   */
  async sendChatMessage(message) {
    return await this.sendToAvatar('Gossip', message, [
      { name: 'Type', value: 'Chat' },
      { name: 'Timestamp', value: new Date().toISOString() }
    ]);
  }

  /**
   * Read messages from Avatar inbox
   */
  async readAvatarInbox() {
    try {
      const inbox = await this.queryAvatar('Read-Inbox');
      return Array.isArray(inbox) ? inbox : [];
    } catch (error) {
      console.error('Failed to read Avatar inbox:', error);
      return [];
    }
  }

  /**
   * Poll for new messages (for real-time chat)
   */
  async pollForNewMessages(lastMessageId = null) {
    const inbox = await this.readAvatarInbox();
    
    if (!lastMessageId) {
      return inbox;
    }
    
    // Return only messages after the last seen message
    const lastIndex = inbox.findIndex(msg => msg.id === lastMessageId);
    return lastIndex >= 0 ? inbox.slice(lastIndex + 1) : inbox;
  }

  // === MEMORY INTERFACE METHODS ===

  /**
   * Get agent memories from Avatar process
   */
  async getAgentMemories() {
    try {
      // Note: This would require adding a 'Get-Memories' handler to avatar.lua
      const memories = await this.queryAvatar('Get-Memories');
      return memories || [];
    } catch (error) {
      console.warn('Memory retrieval not yet implemented in Avatar process');
      return [];
    }
  }

  /**
   * Store a memory in the Avatar process
   */
  async storeMemory(memory) {
    try {
      // Note: This would require adding a 'Store-Memory' handler to avatar.lua
      return await this.sendToAvatar('Store-Memory', memory);
    } catch (error) {
      console.warn('Memory storage not yet implemented in Avatar process');
      throw error;
    }
  }

  // === NETWORK INTERFACE METHODS ===

  /**
   * Get peer network status from Avatar process
   */
  async getPeerNetwork() {
    try {
      const result = await this.queryAvatar('Get-Peers');
      return {
        peers: result?.peers || [],
        proposals: result?.proposals || []
      };
    } catch (error) {
      console.error('Failed to get peer network:', error);
      return { peers: [], proposals: [] };
    }
  }

  /**
   * Add a peer to Avatar network
   */
  async addPeer(processId) {
    return await this.sendToAvatar('Add-Peer', '', [
      { name: 'ProcessId', value: processId }
    ]);
  }

  /**
   * Get Oracle community status
   */
  async getOracleStatus() {
    try {
      const status = await this.queryOracle('Get-Community-Status');
      return status || {
        activeProposals: 0,
        recentActivity: 'unknown',
        consensusHealth: 'unknown',
        communityMood: 'unknown'
      };
    } catch (error) {
      console.error('Failed to get Oracle status:', error);
      return {
        activeProposals: 0,
        recentActivity: 'error',
        consensusHealth: 'error',
        communityMood: 'error'
      };
    }
  }

  /**
   * Get recent proposals from Oracle
   */
  async getRecentProposals(limit = 10, status = 'all') {
    try {
      const proposals = await this.queryOracle('Get-Recent-Proposals', [
        { name: 'Limit', value: limit.toString() },
        { name: 'Status', value: status }
      ]);
      return proposals || [];
    } catch (error) {
      console.error('Failed to get recent proposals:', error);
      return [];
    }
  }

  /**
   * Submit a proposal to the Oracle
   */
  async submitProposal(title, content, category = 'general') {
    return await this.sendToOracle('Ping', content, [
      { name: 'Title', value: title },
      { name: 'Category', value: category }
    ]);
  }

  /**
   * Get agent process list from Oracle
   */
  async getAgentProcessList() {
    try {
      const result = await this.queryOracle('Get-Agent-Process-List');
      return result?.processes || [];
    } catch (error) {
      console.error('Failed to get agent process list:', error);
      return [];
    }
  }

  // === UTILITY METHODS ===

  /**
   * Check if AO service is ready
   */
  isReady() {
    return this.isInitialized && this.connectionStatus === 'connected';
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      connectionStatus: this.connectionStatus,
      processIds: this.processIds,
      wallet: this.wallet?.address || null
    };
  }

  /**
   * Reset service (for wallet disconnection)
   */
  reset() {
    this.wallet = null;
    this.signer = null;
    this.isInitialized = false;
    this.connectionStatus = 'disconnected';
  }
}

// Export singleton instance
export default new AOService();
