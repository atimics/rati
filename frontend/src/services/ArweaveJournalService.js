/**
 * Arweave Journal Service
 * 
 * Manages the permanent journal record on Arweave blockchain
 * Handles genesis prompt, journal pages, oracle scrolls, conversation summaries,
 * and inter-agent messages as a living record of the entity's existence
 */

class ArweaveJournalService {
  constructor() {
    this.arweave = null;
    this.initialized = false;
  }

  /**
   * Initialize Arweave connection
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      if (window.arweaveWallet) {
        // Request permissions needed for journal operations
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH']);
      } else {
        throw new Error('ArConnect not found. Please install the ArConnect extension.');
      }

      // Initialize Arweave for mainnet (not arlocal)
      this.arweave = window.arweave || (await import('arweave')).default.init({
        host: 'arweave.net',
        port: 443,
        protocol: 'https'
      });
      
      this.initialized = true;
      console.log('ArweaveJournalService: Initialized successfully with Arweave mainnet');
    } catch (error) {
      console.error('ArweaveJournalService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create a new journal record structure
   */
  createJournalRecord(agentId, genesisPrompt) {
    return {
      version: '1.0',
      type: 'rati-agent-journal',
      agentId: agentId,
      created: new Date().toISOString(),
      genesis: {
        prompt: genesisPrompt,
        timestamp: new Date().toISOString()
      },
      entries: [],
      oracleScrolls: [],
      conversationSummaries: [],
      interAgentMessages: [],
      metadata: {
        totalEntries: 0,
        lastUpdated: new Date().toISOString(),
        tags: ['rati', 'agent-journal', 'digital-consciousness']
      }
    };
  }

  /**
   * Tool: Write journal entry to Arweave
   * This is designed to be called as a tool by the AI agent
   */
  async writeJournalEntry(context) {
    await this.initialize();
    
    try {
      const { agentId, content, entry, entryType = 'reflection', metadata = {} } = context;
      
      // Support both 'content' and 'entry' parameter names for backward compatibility
      const journalContent = content || entry;
      
      if (!journalContent) {
        throw new Error('Journal entry content is required (provide either "content" or "entry" parameter)');
      }

      // Check content size (support up to 200KB for reduced-cost transactions)
      const contentSize = new Blob([journalContent]).size;
      const isReducedCost = contentSize < 200 * 1024; // 200KB limit
      
      console.log('ArweaveJournalService: Processing journal entry', {
        size: `${(contentSize / 1024).toFixed(2)} KB`,
        reducedCost: isReducedCost,
        threshold: '200 KB'
      });
      
      // Load existing journal or create new one
      let journalRecord = await this.loadJournalRecord(agentId);
      if (!journalRecord) {
        journalRecord = this.createJournalRecord(agentId, context.genesisPrompt || '');
      }

      // Create new journal entry with status tracking
      const entryObject = {
        id: `entry_${Date.now()}`,
        type: entryType, // 'reflection', 'oracle-scroll', 'conversation-summary', 'inter-agent-message'
        content: journalContent,
        timestamp: new Date().toISOString(),
        arweaveTimestamp: null, // Will be set after transaction
        arweaveTransactionId: null, // Will be set after transaction creation
        arweaveStatus: 'pending', // 'pending', 'submitted', 'confirmed', 'failed'
        statusCheckCount: 0,
        lastStatusCheck: null,
        uploadAttempts: 1,
        metadata: {
          wordCount: journalContent.split(/\s+/).length,
          ...metadata
        }
      };

      // Add to appropriate section based on type
      switch (entryType) {
        case 'oracle-scroll':
          journalRecord.oracleScrolls.push(entryObject);
          break;
        case 'conversation-summary':
          journalRecord.conversationSummaries.push(entryObject);
          break;
        case 'inter-agent-message':
          journalRecord.interAgentMessages.push(entryObject);
          break;
        default:
          journalRecord.entries.push(entryObject);
      }

      // Update metadata
      journalRecord.metadata.totalEntries++;
      journalRecord.metadata.lastUpdated = new Date().toISOString();

      // Create Arweave transaction
      const transaction = await this.createJournalTransaction(journalRecord);
      
      // Store transaction ID and update status
      entryObject.arweaveTransactionId = transaction.id;
      entryObject.arweaveTimestamp = new Date().toISOString();
      entryObject.arweaveStatus = 'submitted';
      entryObject.lastStatusCheck = new Date().toISOString();

      // Save to localStorage as backup
      this.saveJournalBackup(agentId, journalRecord);

      // Schedule status check after a short delay
      setTimeout(() => {
        this.checkTransactionStatus(agentId, entryObject.id, transaction.id);
      }, 10000); // Check after 10 seconds

      console.log('ArweaveJournalService: Journal entry written to Arweave mainnet', {
        transactionId: transaction.id,
        entryType: entryType,
        agentId: agentId,
        status: entryObject.arweaveStatus
      });
      
      return {
        success: true,
        entry: journalContent,
        transactionId: transaction.id,
        message: `Journal entry "${entryType}" written to permanent record on Arweave mainnet`,
        arweaveUrl: `https://arweave.net/${transaction.id}`,
        viewBlockUrl: `https://viewblock.io/arweave/tx/${transaction.id}`,
        arnsUrl: `https://arweave.app/tx/${transaction.id}`,
        network: 'mainnet'
      };

    } catch (error) {
      console.error('ArweaveJournalService: Failed to write journal entry:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to write journal entry to permanent record'
      };
    }
  }

  /**
   * Tool: Create or ratify an oracle proposal
   */
  async createOracleProposal(context) {
    await this.initialize();

    try {
      const { agentId, proposalType, title, description, data, action = 'create' } = context;

      const proposal = {
        type: 'oracle-proposal',
        proposalType: proposalType, // 'governance', 'consensus', 'resource-allocation', etc.
        title: title,
        description: description,
        data: data,
        action: action, // 'create', 'ratify', 'reject'
        proposer: agentId,
        timestamp: new Date().toISOString(),
        status: action === 'create' ? 'pending' : action,
        votes: [],
        metadata: {
          proposalId: `proposal_${Date.now()}`,
          expiryDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString() // 7 days
        }
      };

      // Write as oracle scroll entry
      const result = await this.writeJournalEntry({
        agentId: agentId,
        content: `# Oracle Proposal: ${title}\n\n**Type:** ${proposalType}\n**Action:** ${action}\n\n${description}\n\n**Proposal Data:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        entryType: 'oracle-scroll',
        metadata: {
          proposalType: proposalType,
          action: action,
          proposalId: proposal.metadata.proposalId
        }
      });

      if (result.success) {
        return {
          success: true,
          proposal: proposal,
          transactionId: result.transactionId,
          message: `Oracle proposal "${title}" ${action}d and recorded permanently on Arweave mainnet`,
          arweaveUrl: result.arweaveUrl,
          viewBlockUrl: result.viewBlockUrl,
          arnsUrl: result.arnsUrl,
          network: result.network
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('ArweaveJournalService: Failed to create oracle proposal:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create oracle proposal'
      };
    }
  }

  /**
   * Create Arweave transaction for journal data
   */
  async createJournalTransaction(journalRecord) {
    if (!window.arweaveWallet) {
      throw new Error('ArConnect wallet not available. Please install and connect ArConnect wallet.');
    }

    try {
      const data = JSON.stringify(journalRecord, null, 2);
      const transaction = await this.arweave.createTransaction({ data });
      
      transaction.addTag('Content-Type', 'application/json');
      transaction.addTag('App-Name', 'RATi-Agent-Journal');
      transaction.addTag('App-Version', '1.0');
      transaction.addTag('Agent-Id', journalRecord.agentId);
      transaction.addTag('Journal-Version', journalRecord.version);
      transaction.addTag('Unix-Time', String(Math.floor(Date.now() / 1000)));

      // Dispatch the transaction using ArConnect, which handles signing and posting
      const result = await window.arweaveWallet.dispatch(transaction);

      if (!result || !result.id) {
        throw new Error('Failed to dispatch transaction: Invalid response from ArConnect.');
      }

      console.log('ArweaveJournalService: Transaction dispatched successfully', {
        transactionId: result.id,
      });

      // The transaction object passed to dispatch is not modified, so we return a new object
      // with the original transaction and the new ID.
      return {
        ...transaction,
        id: result.id,
      };
    } catch (error) {
      console.error('ArweaveJournalService: Failed to create and dispatch Arweave transaction:', error);
      throw error;
    }
  }

  /**
   * Find the latest journal transaction ID on Arweave using GraphQL
   */
  async findLatestJournalTransaction(agentId) {
    await this.initialize();
    try {
      const query = `
        query {
          transactions(
            first: 1,
            sort: HEIGHT_DESC,
            tags: [
              { name: "App-Name", values: ["RATi-Agent-Journal"] },
              { name: "Agent-Id", values: ["${agentId}"] }
            ]
          ) {
            edges {
              node {
                id
              }
            }
          }
        }
      `;
      const response = await this.arweave.api.post('/graphql', { query });
      
      if (response.data.data.transactions.edges.length > 0) {
        const txId = response.data.data.transactions.edges[0].node.id;
        console.log(`ArweaveJournalService: Found latest journal transaction ${txId} for agent ${agentId}`);
        return txId;
      }
      return null;
    } catch (error) {
      console.error('ArweaveJournalService: Error querying Arweave GraphQL:', error);
      // Do not throw here, allow fallback to local cache
      return null;
    }
  }

  /**
   * Load journal record from Arweave (with remote-first strategy and local cache)
   */
  async loadJournalRecord(agentId) {
    await this.initialize();

    try {
      // Query Arweave for the latest version first
      const latestTxId = await this.findLatestJournalTransaction(agentId);

      if (latestTxId) {
        console.log(`ArweaveJournalService: Found journal on Arweave (tx: ${latestTxId}). Fetching...`);
        const data = await this.arweave.transactions.getData(latestTxId, { decode: true, string: true });
        const arweaveJournal = JSON.parse(data);

        // Save the fetched version to localStorage as a cache
        this.saveJournalBackup(agentId, arweaveJournal);
        return arweaveJournal;
      }
      
      // If nothing on Arweave, try loading from local backup (e.g., for offline-created agents)
      console.log(`ArweaveJournalService: No journal found on Arweave for agent ${agentId}. Checking local backup.`);
      const localJournal = this.loadJournalBackup(agentId);
      if (localJournal) {
        console.log('ArweaveJournalService: Loaded journal from local backup.');
        return localJournal;
      }

      return null; // No journal found anywhere
      
    } catch (error) {
      console.error('ArweaveJournalService: Failed to load journal record from Arweave. Trying local backup as fallback.', error);
      // As a fallback on error, try to load from local storage
      try {
        const backup = this.loadJournalBackup(agentId);
        if (backup) {
            console.log('ArweaveJournalService: Loaded journal from local backup due to an error.');
            return backup;
        }
      } catch (backupError) {
        console.error('ArweaveJournalService: Failed to load from local backup during fallback.', backupError);
      }
      return null;
    }
  }

  /**
   * Save journal backup to localStorage
   */
  saveJournalBackup(agentId, journalRecord) {
    try {
      localStorage.setItem(`arweave_journal_${agentId}`, JSON.stringify(journalRecord));
      console.log('ArweaveJournalService: Journal backup saved to localStorage');
    } catch (error) {
      console.error('ArweaveJournalService: Failed to save journal backup:', error);
    }
  }

  /**
   * Load journal backup from localStorage
   */
  loadJournalBackup(agentId) {
    try {
      const backup = localStorage.getItem(`arweave_journal_${agentId}`);
      return backup ? JSON.parse(backup) : null;
    } catch (error) {
      console.error('ArweaveJournalService: Failed to load journal backup:', error);
      return null;
    }
  }

  /**
   * Get all journal entries of a specific type
   */
  getEntriesByType(journalRecord, entryType) {
    if (!journalRecord) return [];
    
    switch (entryType) {
      case 'oracle-scroll':
        return journalRecord.oracleScrolls || [];
      case 'conversation-summary':
        return journalRecord.conversationSummaries || [];
      case 'inter-agent-message':
        return journalRecord.interAgentMessages || [];
      default:
        return journalRecord.entries || [];
    }
  }

  /**
   * Get the complete living record for display
   */
  async getLivingRecord(agentId) {
    const journalRecord = await this.loadJournalRecord(agentId);
    
    if (!journalRecord) {
      return {
        exists: false,
        message: 'No permanent record found on Arweave',
        statusSummary: this.getEntryStatusSummary(agentId),
        entriesNeedingAttention: []
      };
    }

    // Combine all entries with timestamps for chronological view
    const allEntries = [
      ...journalRecord.entries.map(e => ({...e, category: 'Journal Reflection'})),
      ...journalRecord.oracleScrolls.map(e => ({...e, category: 'Oracle Scroll'})),
      ...journalRecord.conversationSummaries.map(e => ({...e, category: 'Conversation Summary'})),
      ...journalRecord.interAgentMessages.map(e => ({...e, category: 'Inter-Agent Message'}))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      exists: true,
      genesis: journalRecord.genesis,
      entries: allEntries,
      metadata: journalRecord.metadata,
      agentId: journalRecord.agentId,
      totalEntries: journalRecord.metadata.totalEntries,
      statusSummary: this.getEntryStatusSummary(agentId),
      entriesNeedingAttention: this.getEntriesNeedingAttention(agentId)
    };
  }

  /**
   * Check transaction status and update entry
   */
  async checkTransactionStatus(agentId, entryId, transactionId) {
    try {
      const journalRecord = await this.loadJournalRecord(agentId);
      if (!journalRecord) return;

      // Find the entry across all sections
      let entry = null;
      
      const sections = ['entries', 'oracleScrolls', 'conversationSummaries', 'interAgentMessages'];
      for (const section of sections) {
        if (journalRecord[section]) {
          entry = journalRecord[section].find(e => e.id === entryId);
          if (entry) {
            break;
          }
        }
      }

      if (!entry || entry.arweaveTransactionId !== transactionId) {
        console.warn('ArweaveJournalService: Entry not found for status check', { entryId, transactionId });
        return;
      }

      // Skip if already confirmed
      if (entry.arweaveStatus === 'confirmed') {
        return;
      }

      // Import arweave utils for status checking
      const { getTransactionStatus } = await import('../utils/arweave.js');
      
      // Check transaction status
      const status = await getTransactionStatus(transactionId);
      entry.statusCheckCount = (entry.statusCheckCount || 0) + 1;
      entry.lastStatusCheck = new Date().toISOString();

      if (status.confirmed) {
        entry.arweaveStatus = 'confirmed';
        console.log('ArweaveJournalService: Transaction confirmed', { transactionId, entryId });
      } else if (status.pending) {
        entry.arweaveStatus = 'submitted';
        // Schedule another check if not too many attempts
        if (entry.statusCheckCount < 10) {
          setTimeout(() => {
            this.checkTransactionStatus(agentId, entryId, transactionId);
          }, 30000); // Check again in 30 seconds
        }
      } else {
        entry.arweaveStatus = 'failed';
        console.warn('ArweaveJournalService: Transaction failed', { transactionId, entryId, status });
      }

      // Save updated record
      this.saveJournalBackup(agentId, journalRecord);
      
    } catch (error) {
      console.error('ArweaveJournalService: Failed to check transaction status:', error);
      
      // Mark as failed if we can't check status
      try {
        const journalRecord = await this.loadJournalRecord(agentId);
        if (journalRecord) {
          const sections = ['entries', 'oracleScrolls', 'conversationSummaries', 'interAgentMessages'];
          for (const section of sections) {
            if (journalRecord[section]) {
              const entry = journalRecord[section].find(e => e.id === entryId);
              if (entry) {
                entry.arweaveStatus = 'failed';
                entry.statusCheckCount = (entry.statusCheckCount || 0) + 1;
                entry.lastStatusCheck = new Date().toISOString();
                this.saveJournalBackup(agentId, journalRecord);
                break;
              }
            }
          }
        }
      } catch (saveError) {
        console.error('ArweaveJournalService: Failed to save failed status:', saveError);
      }
    }
  }

  /**
   * Re-upload a failed entry
   */
  async reuploadEntry(agentId, entryId) {
    try {
      const journalRecord = await this.loadJournalRecord(agentId);
      if (!journalRecord) {
        throw new Error('Journal record not found');
      }

      // Find the entry across all sections
      let entry = null;
      
      const sections = ['entries', 'oracleScrolls', 'conversationSummaries', 'interAgentMessages'];
      for (const section of sections) {
        if (journalRecord[section]) {
          entry = journalRecord[section].find(e => e.id === entryId);
          if (entry) {
            break;
          }
        }
      }

      if (!entry) {
        throw new Error('Entry not found');
      }

      if (entry.arweaveStatus === 'confirmed') {
        return {
          success: true,
          message: 'Entry is already confirmed on Arweave',
          transactionId: entry.arweaveTransactionId
        };
      }

      // Update attempt count and reset status
      entry.uploadAttempts = (entry.uploadAttempts || 0) + 1;
      entry.arweaveStatus = 'pending';
      entry.statusCheckCount = 0;
      entry.lastStatusCheck = null;

      // Create new transaction
      const transaction = await this.createJournalTransaction(journalRecord);
      
      // Update entry with new transaction info
      entry.arweaveTransactionId = transaction.id;
      entry.arweaveTimestamp = new Date().toISOString();
      entry.arweaveStatus = 'submitted';
      entry.lastStatusCheck = new Date().toISOString();

      // Save updated record
      this.saveJournalBackup(agentId, journalRecord);

      // Schedule status check
      setTimeout(() => {
        this.checkTransactionStatus(agentId, entryId, transaction.id);
      }, 10000);

      console.log('ArweaveJournalService: Entry re-uploaded', { 
        entryId, 
        transactionId: transaction.id, 
        attempt: entry.uploadAttempts 
      });

      return {
        success: true,
        transactionId: transaction.id,
        attempt: entry.uploadAttempts,
        message: `Entry re-uploaded (attempt ${entry.uploadAttempts})`
      };

    } catch (error) {
      console.error('ArweaveJournalService: Failed to re-upload entry:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to re-upload entry'
      };
    }
  }

  /**
   * Get status summary for all entries
   */
  getEntryStatusSummary(agentId) {
    try {
      const journalRecord = this.loadJournalBackup(agentId);
      if (!journalRecord) {
        return {
          total: 0,
          pending: 0,
          submitted: 0,
          confirmed: 0,
          failed: 0
        };
      }

      const summary = {
        total: 0,
        pending: 0,
        submitted: 0,
        confirmed: 0,
        failed: 0
      };

      const sections = ['entries', 'oracleScrolls', 'conversationSummaries', 'interAgentMessages'];
      for (const section of sections) {
        if (journalRecord[section]) {
          for (const entry of journalRecord[section]) {
            summary.total++;
            const status = entry.arweaveStatus || 'pending';
            summary[status] = (summary[status] || 0) + 1;
          }
        }
      }

      return summary;
    } catch (error) {
      console.error('ArweaveJournalService: Failed to get status summary:', error);
      return {
        total: 0,
        pending: 0,
        submitted: 0,
        confirmed: 0,
        failed: 0
      };
    }
  }

  /**
   * Get entries that need attention (failed or long-pending)
   */
  getEntriesNeedingAttention(agentId) {
    try {
      const journalRecord = this.loadJournalBackup(agentId);
      if (!journalRecord) return [];

      const needingAttention = [];
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const sections = ['entries', 'oracleScrolls', 'conversationSummaries', 'interAgentMessages'];
      for (const section of sections) {
        if (journalRecord[section]) {
          for (const entry of journalRecord[section]) {
            const shouldFlag = (
              entry.arweaveStatus === 'failed' ||
              (entry.arweaveStatus === 'submitted' && 
               entry.lastStatusCheck && 
               new Date(entry.lastStatusCheck) < thirtyMinutesAgo)
            );

            if (shouldFlag) {
              needingAttention.push({
                ...entry,
                section: section,
                reason: entry.arweaveStatus === 'failed' ? 'Upload failed' : 'Long pending submission'
              });
            }
          }
        }
      }

      return needingAttention.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('ArweaveJournalService: Failed to get entries needing attention:', error);
      return [];
    }
  }
}

export default new ArweaveJournalService();
