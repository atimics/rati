import { message, dryrun, createDataItemSigner } from '@permaweb/aoconnect';
import { arweave } from '../services/arweave.js';
import { loadWallet } from '../services/deployment.js';
import { EventEmitter } from 'events';

/**
 * Enhanced Agent Processor Service
 * Manages intelligent updates to agents based on oracle-published process lists
 * Implements advanced sorting criteria and context-aware update coordination
 */
export class AgentProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.oracleProcessId = options.oracleProcessId;
    this.updateInterval = options.updateInterval || 300000; // 5 minutes
    this.maxBatchSize = options.maxBatchSize || 10;
    this.isRunning = false;
    this.lastUpdate = null;
    this.processedAgents = new Map();
    this.sortingCriteria = options.sortingCriteria || 'activity'; // 'activity', 'sequence', 'random', 'priority', 'intelligent'
    this.oracleContext = null;
    this.agentHealthMap = new Map();
    this.updateHistory = [];
    
    this.log('info', 'Enhanced Agent Processor initialized', {
      oracleProcessId: this.oracleProcessId,
      updateInterval: this.updateInterval,
      sortingCriteria: this.sortingCriteria
    });
  }

  /**
   * Start the agent processor with enhanced initialization
   */
  async start() {
    if (this.isRunning) {
      this.log('warn', 'Agent processor already running');
      return;
    }

    this.log('info', 'Starting enhanced agent processor');
    this.isRunning = true;
    this.lastUpdate = new Date();

    // Initialize oracle context
    await this.refreshOracleContext();

    // Initial agent health check
    await this.performHealthCheck();

    // Initial processing run
    await this.processAgentUpdates();

    // Schedule periodic updates with adaptive intervals
    this.scheduleUpdates();

    this.emit('started');
  }

  /**
   * Schedule updates with adaptive intervals based on oracle activity
   */
  scheduleUpdates() {
    this.updateTimer = setInterval(async () => {
      try {
        // Refresh oracle context before each cycle
        await this.refreshOracleContext();
        
        // Adjust update interval based on oracle activity
        const adaptiveInterval = this.calculateAdaptiveInterval();
        if (adaptiveInterval !== this.updateInterval) {
          this.updateInterval = adaptiveInterval;
          this.rescheduleUpdates();
          return;
        }

        await this.processAgentUpdates();
      } catch (error) {
        this.log('error', 'Error in scheduled agent update', error);
      }
    }, this.updateInterval);
  }

  /**
   * Calculate adaptive update interval based on oracle activity
   */
  calculateAdaptiveInterval() {
    if (!this.oracleContext) return this.updateInterval;

    const baseInterval = 300000; // 5 minutes
    const { recentActivity, activeProposals } = this.oracleContext;

    // More frequent updates during high activity
    if (recentActivity === 'active' || activeProposals > 5) {
      return Math.max(baseInterval / 2, 60000); // Min 1 minute
    }
    
    // Less frequent during quiet periods
    if (recentActivity === 'quiet' && activeProposals === 0) {
      return Math.min(baseInterval * 2, 900000); // Max 15 minutes
    }

    return baseInterval;
  }

  /**
   * Reschedule updates with new interval
   */
  rescheduleUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.scheduleUpdates();
    this.log('info', `Update interval adjusted to ${this.updateInterval / 1000}s`);
  }

  /**
   * Refresh oracle context for informed decision making
   */
  async refreshOracleContext() {
    try {
      const [status, recentProposals] = await Promise.all([
        this.getOracleStatus(),
        this.getRecentProposals()
      ]);

      this.oracleContext = {
        ...status,
        recentProposals,
        lastRefresh: new Date()
      };

      this.log('debug', 'Oracle context refreshed', {
        activeProposals: this.oracleContext.activeProposals,
        recentActivity: this.oracleContext.recentActivity
      });

    } catch (error) {
      this.log('warn', 'Failed to refresh oracle context', error);
    }
  }

  /**
   * Perform agent health check to identify priority agents
   */
  async performHealthCheck() {
    try {
      const agentList = await this.fetchAgentProcessList();
      if (!agentList || agentList.length === 0) return;

      this.log('info', `Performing health check on ${agentList.length} agents`);

      const healthChecks = await Promise.allSettled(
        agentList.map(async (processId) => {
          const health = await this.checkAgentHealth(processId);
          this.agentHealthMap.set(processId, health);
          return { processId, health };
        })
      );

      const healthyAgents = healthChecks
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(({ health }) => health.status === 'healthy');

      this.log('info', `Health check complete: ${healthyAgents.length}/${agentList.length} agents healthy`);

    } catch (error) {
      this.log('error', 'Health check failed', error);
    }
  }

  /**
   * Check individual agent health
   */
  async checkAgentHealth(processId) {
    try {
      // Query recent agent activity and responsiveness
      const result = await dryrun({
        process: processId,
        tags: [
          { name: 'Action', value: 'Health-Check' }
        ]
      });

      const isResponsive = result.Messages && result.Messages.length > 0;
      const lastSeen = this.processedAgents.get(processId)?.timestamp || 0;
      const timeSinceLastUpdate = Date.now() - lastSeen;

      return {
        status: isResponsive ? 'healthy' : 'unresponsive',
        lastSeen,
        timeSinceLastUpdate,
        isStale: timeSinceLastUpdate > 3600000, // 1 hour
        needsUpdate: timeSinceLastUpdate > 1800000 // 30 minutes
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        needsUpdate: true
      };
    }
  }

  /**
   * Main processing function
   */
  async processAgentUpdates() {
    try {
      this.log('info', 'Starting agent update cycle');

      // Get agent process list from oracle
      const agentList = await this.fetchAgentProcessList();
      if (!agentList || agentList.length === 0) {
        this.log('warn', 'No agents found in oracle process list');
        return;
      }

      this.log('info', `Found ${agentList.length} agents to process`);

      // Apply sorting criteria
      const sortedAgents = await this.sortAgents(agentList);

      // Process agents in batches
      const batches = this.createBatches(sortedAgents, this.maxBatchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.log('info', `Processing batch ${i + 1}/${batches.length} with ${batch.length} agents`);
        
        await this.processBatch(batch);
        
        // Small delay between batches to avoid overwhelming the network
        if (i < batches.length - 1) {
          await this.delay(2000);
        }
      }

      this.lastUpdate = new Date();
      this.emit('updateComplete', {
        totalAgents: agentList.length,
        processedBatches: batches.length,
        timestamp: this.lastUpdate
      });

    } catch (error) {
      this.log('error', 'Error processing agent updates', error);
      this.emit('error', error);
    }
  }

  /**
   * Fetch agent process list from oracle
   */
  async fetchAgentProcessList() {
    try {
      const result = await dryrun({
        process: this.oracleProcessId,
        tags: [
          { name: 'Action', value: 'Get-Agent-Process-List' }
        ]
      });

      if (result.Messages && result.Messages.length > 0) {
        const message = result.Messages[0];
        if (message.Data) {
          const parsedData = JSON.parse(message.Data);
          return parsedData.processes || parsedData;
        }
      }

      return [];
    } catch (error) {
      this.log('error', 'Failed to fetch agent process list', error);
      return [];
    }
  }

  /**
   * Enhanced agent selection with intelligent prioritization
   */
  async sortAgents(agentList) {
    const agentsWithMetadata = await Promise.all(
      agentList.map(async (processId) => {
        const metadata = await this.getAgentMetadata(processId);
        const health = this.agentHealthMap.get(processId) || { status: 'unknown' };
        return {
          processId,
          metadata,
          health,
          lastProcessed: this.processedAgents.get(processId)?.timestamp || 0,
          priority: this.calculateAgentPriority(processId, metadata, health)
        };
      })
    );

    switch (this.sortingCriteria) {
      case 'activity':
        return this.sortByActivity(agentsWithMetadata);
      case 'sequence':
        return this.sortBySequence(agentsWithMetadata);
      case 'random':
        return this.shuffleArray(agentsWithMetadata);
      case 'priority':
        return this.sortByPriority(agentsWithMetadata);
      case 'intelligent':
        return this.sortByIntelligentCriteria(agentsWithMetadata);
      default:
        return agentsWithMetadata;
    }
  }

  /**
   * Calculate agent priority based on multiple factors
   */
  calculateAgentPriority(processId, metadata, health) {
    let priority = 0;

    // Health-based priority
    if (health.needsUpdate) priority += 100;
    if (health.status === 'unresponsive') priority += 200;
    if (health.isStale) priority += 150;

    // Activity-based priority
    const timeSinceActivity = Date.now() - metadata.lastActivity;
    if (timeSinceActivity > 86400000) priority += 50; // 24 hours

    // Context-based priority (oracle activity should trigger more updates)
    if (this.oracleContext?.recentActivity === 'active') {
      priority += 75;
    }

    // Journal frequency priority
    if (metadata.journalCount < metadata.memoryCount * 0.1) priority += 25;

    return priority;
  }

  /**
   * Intelligent sorting combining multiple criteria
   */
  sortByIntelligentCriteria(agents) {
    return agents.sort((a, b) => {
      // Primary: Priority score
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Secondary: Health status
      const healthOrder = { 'error': 3, 'unresponsive': 2, 'healthy': 1, 'unknown': 0 };
      const aHealth = healthOrder[a.health.status] || 0;
      const bHealth = healthOrder[b.health.status] || 0;
      if (bHealth !== aHealth) {
        return bHealth - aHealth;
      }

      // Tertiary: Activity
      return b.metadata.lastActivity - a.metadata.lastActivity;
    });
  }

  /**
   * Get agent metadata for sorting
   */
  async getAgentMetadata(processId) {
    try {
      // Query for recent agent activity
      const query = `{
        transactions(
          tags: [
            {name: "Type", values: ["Agent-Memory", "Agent-Journal"]},
            {name: "Owner-Process", values: ["${processId}"]},
            {name: "Avatar-ID", values: ["${processId}"]}
          ],
          sort: HEIGHT_DESC,
          first: 5
        ) {
          edges {
            node {
              id,
              tags {
                name,
                value
              },
              block {
                timestamp,
                height
              }
            }
          }
        }
      }`;

      const response = await arweave.api.post('/graphql', { query });
      const edges = response.data.data.transactions.edges;

      let lastActivity = 0;
      let memoryCount = 0;
      let journalCount = 0;
      let maxSequence = 0;

      edges.forEach(edge => {
        const tags = {};
        edge.node.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });

        if (edge.node.block?.timestamp) {
          lastActivity = Math.max(lastActivity, edge.node.block.timestamp);
        }

        if (tags.Type === 'Agent-Memory') {
          memoryCount++;
          const sequence = parseInt(tags.Sequence || '0');
          maxSequence = Math.max(maxSequence, sequence);
        } else if (tags.Type === 'Agent-Journal') {
          journalCount++;
        }
      });

      return {
        lastActivity,
        memoryCount,
        journalCount,
        maxSequence,
        totalTransactions: edges.length
      };

    } catch (error) {
      this.log('warn', `Failed to get metadata for agent ${processId}`, error);
      return {
        lastActivity: 0,
        memoryCount: 0,
        journalCount: 0,
        maxSequence: 0,
        totalTransactions: 0
      };
    }
  }

  /**
   * Sort agents by activity (most active first)
   */
  sortByActivity(agents) {
    return agents.sort((a, b) => {
      const aScore = a.metadata.lastActivity + (a.metadata.totalTransactions * 1000);
      const bScore = b.metadata.lastActivity + (b.metadata.totalTransactions * 1000);
      return bScore - aScore;
    });
  }

  /**
   * Sort agents by sequence (highest sequence first)
   */
  sortBySequence(agents) {
    return agents.sort((a, b) => b.metadata.maxSequence - a.metadata.maxSequence);
  }

  /**
   * Sort agents by priority (least recently processed first)
   */
  sortByPriority(agents) {
    return agents.sort((a, b) => a.lastProcessed - b.lastProcessed);
  }

  /**
   * Shuffle agents randomly
   */
  shuffleArray(agents) {
    const shuffled = [...agents];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Create batches from sorted agent list
   */
  createBatches(agents, batchSize) {
    const batches = [];
    for (let i = 0; i < agents.length; i += batchSize) {
      batches.push(agents.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of agents
   */
  async processBatch(batch) {
    const promises = batch.map(agent => this.updateAgent(agent));
    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        this.processedAgents.set(batch[index].processId, {
          timestamp: Date.now(),
          status: 'success'
        });
      } else {
        errorCount++;
        this.log('error', `Failed to update agent ${batch[index].processId}`, result.reason);
        this.processedAgents.set(batch[index].processId, {
          timestamp: Date.now(),
          status: 'error',
          error: result.reason.message
        });
      }
    });

    this.log('info', `Batch completed: ${successCount} success, ${errorCount} errors`);
  }

  /**
   * Enhanced agent update with context-aware messaging
   */
  async updateAgent(agent) {
    try {
      const wallet = await loadWallet();
      const signer = createDataItemSigner(wallet);

      // Prepare context-aware update data
      const updateData = {
        type: 'oracle-update',
        timestamp: new Date().toISOString(),
        oracleStatus: this.oracleContext,
        processorInfo: {
          lastUpdate: this.lastUpdate,
          sortingCriteria: this.sortingCriteria,
          agentMetadata: agent.metadata,
          agentHealth: agent.health,
          priority: agent.priority
        },
        contextualPrompts: this.generateContextualPrompts(agent)
      };

      // Send enhanced update to agent
      const messageId = await message({
        process: agent.processId,
        signer,
        tags: [
          { name: 'Action', value: 'Oracle-Update' },
          { name: 'Update-Type', value: 'Context-Refresh' },
          { name: 'Oracle-Process', value: this.oracleProcessId },
          { name: 'Priority-Level', value: agent.priority.toString() },
          { name: 'Health-Status', value: agent.health.status }
        ],
        data: JSON.stringify(updateData)
      });

      // Track successful update
      this.recordUpdate(agent.processId, 'success', { messageId, priority: agent.priority });

      this.log('debug', `Enhanced update sent to agent ${agent.processId}`, { 
        messageId, 
        priority: agent.priority,
        healthStatus: agent.health.status 
      });
      
      return { success: true, messageId };

    } catch (error) {
      this.recordUpdate(agent.processId, 'error', { error: error.message });
      this.log('error', `Failed to update agent ${agent.processId}`, error);
      throw error;
    }
  }

  /**
   * Generate contextual prompts based on oracle state and agent condition
   */
  generateContextualPrompts(agent) {
    const prompts = [];

    // Oracle activity prompts
    if (this.oracleContext?.recentActivity === 'active') {
      prompts.push("The community oracle shows high activity. Consider how current governance discussions might influence your thoughts and actions.");
    }

    // Agent-specific prompts
    if (agent.health.isStale) {
      prompts.push("It's been a while since your last update. Reflect on any changes in your perspective or new insights gained.");
    }

    if (agent.metadata.journalCount < agent.metadata.memoryCount * 0.1) {
      prompts.push("Your memory-to-journal ratio suggests you might benefit from more reflective journaling about your experiences.");
    }

    // Proposal-based prompts
    if (this.oracleContext?.recentProposals?.length > 0) {
      const recentProposal = this.oracleContext.recentProposals[0];
      prompts.push(`A recent ${recentProposal.category} proposal "${recentProposal.title}" is ${recentProposal.status}. How might this affect the broader community context?`);
    }

    return prompts;
  }

  /**
   * Record update attempt for analytics and optimization
   */
  recordUpdate(processId, status, details = {}) {
    const record = {
      timestamp: Date.now(),
      processId,
      status,
      ...details
    };

    this.updateHistory.push(record);
    
    // Keep only last 1000 records
    if (this.updateHistory.length > 1000) {
      this.updateHistory = this.updateHistory.slice(-1000);
    }

    this.processedAgents.set(processId, {
      timestamp: Date.now(),
      status,
      ...details
    });
  }

  /**
   * Get recent proposals from oracle
   */
  async getRecentProposals() {
    try {
      const result = await dryrun({
        process: this.oracleProcessId,
        tags: [
          { name: 'Action', value: 'Get-Recent-Proposals' },
          { name: 'Limit', value: '5' }
        ]
      });

      if (result.Messages && result.Messages.length > 0) {
        const message = result.Messages[0];
        if (message.Data) {
          return JSON.parse(message.Data);
        }
      }

      return [];
    } catch (error) {
      this.log('warn', 'Failed to get recent proposals', error);
      return [];
    }
  }

  /**
   * Get current oracle status
   */
  async getOracleStatus() {
    try {
      const result = await dryrun({
        process: this.oracleProcessId,
        tags: [
          { name: 'Action', value: 'Get-Community-Status' }
        ]
      });

      if (result.Messages && result.Messages.length > 0) {
        const message = result.Messages[0];
        if (message.Data) {
          return JSON.parse(message.Data);
        }
      }

      return { status: 'unknown' };
    } catch (error) {
      this.log('warn', 'Failed to get oracle status', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'AgentProcessor',
      message,
      ...(data && { data })
    };

    console.log(`[${timestamp}] [${level.toUpperCase()}] [AgentProcessor] ${message}`, 
      data ? JSON.stringify(data, null, 2) : '');
    
    this.emit('log', logEntry);
  }

  /**
   * Get enhanced processor status with analytics
   */
  getStatus() {
    const recentUpdates = this.updateHistory.filter(
      record => Date.now() - record.timestamp < 3600000 // Last hour
    );

    const successRate = recentUpdates.length > 0 
      ? recentUpdates.filter(r => r.status === 'success').length / recentUpdates.length
      : 0;

    const avgPriority = recentUpdates.length > 0
      ? recentUpdates.reduce((sum, r) => sum + (r.priority || 0), 0) / recentUpdates.length
      : 0;

    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      processedAgentsCount: this.processedAgents.size,
      oracleProcessId: this.oracleProcessId,
      sortingCriteria: this.sortingCriteria,
      updateInterval: this.updateInterval,
      oracleContext: this.oracleContext,
      analytics: {
        recentUpdatesCount: recentUpdates.length,
        successRate: Math.round(successRate * 100),
        avgPriority: Math.round(avgPriority),
        healthyAgents: Array.from(this.agentHealthMap.values())
          .filter(h => h.status === 'healthy').length,
        totalTrackedAgents: this.agentHealthMap.size
      }
    };
  }
}

export default AgentProcessor;
