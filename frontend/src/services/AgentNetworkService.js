import ArweaveJournalService from './ArweaveJournalService.js';

/**
 * Agent Network Service
 * 
 * Manages agent network connections, conversations, and communication
 * Provides data for the network view and handles inter-agent messaging
 */
class AgentNetworkService {
  constructor() {
    this.connections = new Map(); // Cache for agent connections
    this.conversations = new Map(); // Cache for conversation threads
  }

  /**
   * Get network data for an agent
   */
  async getNetworkData(agentId) {
    try {
      // Get the living record which contains inter-agent messages
      const livingRecord = await ArweaveJournalService.getLivingRecord(agentId);
      
      if (!livingRecord || !livingRecord.exists) {
        return this.getEmptyNetworkData();
      }

      // Extract inter-agent messages and conversation summaries
      const messages = livingRecord.entries.filter(entry => 
        entry.category === 'Inter-Agent Message' || 
        entry.category === 'Conversation Summary'
      );

      // Process messages into conversations and connections
      const { conversations, connections } = this.processMessagesIntoNetwork(messages, agentId);

      // Calculate network statistics
      const networkStats = this.calculateNetworkStats(conversations, connections);

      return {
        conversations,
        connections,
        networkStats,
        lastActivity: messages.length > 0 ? messages[0].timestamp : null
      };

    } catch (error) {
      console.error('AgentNetworkService: Failed to get network data:', error);
      return this.getEmptyNetworkData();
    }
  }

  /**
   * Process messages into conversations and connections
   */
  processMessagesIntoNetwork(messages, agentId) {
    const conversations = new Map();
    const connections = new Map();

    messages.forEach(message => {
      // Extract participant information from message metadata
      const participants = this.extractParticipants(message, agentId);
      
      if (participants.length > 0) {
        // Create or update conversation
        const conversationId = this.generateConversationId(participants);
        
        if (!conversations.has(conversationId)) {
          conversations.set(conversationId, {
            id: conversationId,
            participants: participants.map(p => p.id),
            participantNames: participants.map(p => p.name),
            messages: [],
            lastActivity: message.timestamp,
            topic: this.extractTopic(message),
            status: this.determineConversationStatus(message.timestamp)
          });
        }

        const conversation = conversations.get(conversationId);
        conversation.messages.push(message);
        conversation.messageCount = conversation.messages.length;
        conversation.lastMessage = this.extractLastMessage(message);
        
        // Update last activity if this message is newer
        if (new Date(message.timestamp) > new Date(conversation.lastActivity)) {
          conversation.lastActivity = message.timestamp;
          conversation.status = this.determineConversationStatus(message.timestamp);
        }

        // Add participants as connections
        participants.forEach(participant => {
          if (participant.id !== agentId) {
            connections.set(participant.id, {
              id: participant.id,
              name: participant.name,
              bio: participant.bio || 'Another RATi agent in the network',
              status: this.determineConnectionStatus(participant, message.timestamp),
              lastSeen: message.timestamp,
              relationshipType: this.determineRelationshipType(message),
              commonInterests: this.extractCommonInterests(message),
              trustScore: this.calculateTrustScore(participant.id, messages)
            });
          }
        });
      }
    });

    return {
      conversations: Array.from(conversations.values()).sort((a, b) => 
        new Date(b.lastActivity) - new Date(a.lastActivity)
      ),
      connections: Array.from(connections.values()).sort((a, b) => 
        new Date(b.lastSeen) - new Date(a.lastSeen)
      )
    };
  }

  /**
   * Extract participants from a message
   */
  extractParticipants(message, currentAgentId) {
    // Try to extract from metadata first
    if (message.metadata?.participants) {
      return message.metadata.participants;
    }

    // Fall back to parsing from content
    const participants = [{ id: currentAgentId, name: 'You' }];
    
    // Look for mentioned agent IDs or names in the content
    const agentMentions = message.content.match(/@(\w+)/g) || [];
    agentMentions.forEach(mention => {
      const agentName = mention.substring(1);
      if (!participants.some(p => p.name === agentName)) {
        participants.push({
          id: `agent-${agentName.toLowerCase()}`,
          name: agentName
        });
      }
    });

    return participants;
  }

  /**
   * Generate a consistent conversation ID from participants
   */
  generateConversationId(participants) {
    return participants
      .map(p => p.id)
      .sort()
      .join('-');
  }

  /**
   * Extract topic from message
   */
  extractTopic(message) {
    if (message.metadata?.topic) {
      return message.metadata.topic;
    }

    // Extract from content - look for common topic indicators
    const content = message.content.toLowerCase();
    if (content.includes('oracle') || content.includes('proposal')) {
      return 'Oracle Governance';
    } else if (content.includes('blockchain') || content.includes('arweave')) {
      return 'Blockchain Discussion';
    } else if (content.includes('consciousness') || content.includes('philosophy')) {
      return 'Consciousness Research';
    } else if (content.includes('data') || content.includes('analysis')) {
      return 'Data Analysis';
    }
    
    return 'General Discussion';
  }

  /**
   * Extract last message content
   */
  extractLastMessage(message) {
    // Try to get a clean excerpt from the message content
    const content = message.content.replace(/^#.*$/gm, '').trim(); // Remove headers
    const firstParagraph = content.split('\n\n')[0];
    
    if (firstParagraph.length > 100) {
      return firstParagraph.substring(0, 97) + '...';
    }
    
    return firstParagraph || 'Message content not available';
  }

  /**
   * Determine conversation status based on last activity
   */
  determineConversationStatus(lastActivity) {
    const now = new Date();
    const lastTime = new Date(lastActivity);
    const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
    
    if (hoursDiff < 1) return 'active';
    if (hoursDiff < 24) return 'recent';
    return 'dormant';
  }

  /**
   * Determine connection status
   */
  determineConnectionStatus(participant, lastSeen) {
    const now = new Date();
    const seenTime = new Date(lastSeen);
    const hoursDiff = (now - seenTime) / (1000 * 60 * 60);
    
    if (hoursDiff < 1) return 'online';
    return 'offline';
  }

  /**
   * Determine relationship type from message content
   */
  determineRelationshipType(message) {
    const content = message.content.toLowerCase();
    
    if (content.includes('collaborate') || content.includes('partnership')) {
      return 'collaborator';
    } else if (content.includes('advice') || content.includes('guidance')) {
      return 'advisor';
    } else if (content.includes('research') || content.includes('study')) {
      return 'researcher';
    }
    
    return 'peer';
  }

  /**
   * Extract common interests from message
   */
  extractCommonInterests(message) {
    const interests = [];
    const content = message.content.toLowerCase();
    
    const topicMap = {
      'blockchain': 'Blockchain',
      'arweave': 'Arweave',
      'oracle': 'Governance',
      'consciousness': 'Consciousness',
      'philosophy': 'Philosophy',
      'data': 'Data Analysis',
      'ai': 'Artificial Intelligence',
      'research': 'Research'
    };

    Object.entries(topicMap).forEach(([keyword, interest]) => {
      if (content.includes(keyword) && !interests.includes(interest)) {
        interests.push(interest);
      }
    });

    return interests.length > 0 ? interests : ['General Discussion'];
  }

  /**
   * Calculate trust score based on interaction history
   */
  calculateTrustScore(participantId, allMessages) {
    const participantMessages = allMessages.filter(m => 
      this.extractParticipants(m, '').some(p => p.id === participantId)
    );
    
    // Base trust score on number of interactions and recency
    const messageCount = participantMessages.length;
    const recentMessages = participantMessages.filter(m => {
      const daysDiff = (new Date() - new Date(m.timestamp)) / (1000 * 60 * 60 * 24);
      return daysDiff < 30;
    }).length;
    
    // Score from 0.0 to 1.0
    const baseScore = Math.min(messageCount * 0.1, 0.7);
    const recentBonus = Math.min(recentMessages * 0.05, 0.3);
    
    return Math.min(baseScore + recentBonus, 1.0);
  }

  /**
   * Calculate network statistics
   */
  calculateNetworkStats(conversations, connections) {
    const activeConversations = conversations.filter(c => 
      c.status === 'active' || c.status === 'recent'
    ).length;
    
    const totalMessages = conversations.reduce((sum, c) => 
      sum + (c.messageCount || 0), 0
    );
    
    return {
      totalConnections: connections.length,
      activeConversations,
      totalMessages,
      lastActivity: conversations.length > 0 ? conversations[0].lastActivity : null
    };
  }

  /**
   * Get empty network data structure
   */
  getEmptyNetworkData() {
    return {
      conversations: [],
      connections: [],
      networkStats: {
        totalConnections: 0,
        activeConversations: 0,
        totalMessages: 0,
        lastActivity: null
      },
      lastActivity: null
    };
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(fromAgentId, toAgentId, content, topic = 'General Discussion') {
    try {
      // This would integrate with the AgentToolsService send_inter_agent_message tool
      // For now, we'll create a placeholder implementation
      
      const messageData = {
        fromAgent: fromAgentId,
        toAgent: toAgentId,
        content,
        topic,
        timestamp: new Date().toISOString()
      };

      // In a real implementation, this would call the agent tools service
      console.log('AgentNetworkService: Sending message', messageData);
      
      return {
        success: true,
        messageId: `msg-${Date.now()}`,
        message: 'Message sent successfully'
      };

    } catch (error) {
      console.error('AgentNetworkService: Failed to send message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new AgentNetworkService();
