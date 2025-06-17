/**
 * ConversationTracker - Tracks agent conversations and interactions for journal context
 */
class ConversationTracker {
  constructor(agentId) {
    this.agentId = agentId;
    this.conversations = [];
    this.systemEvents = [];
    this.maxConversations = 1000;
    this.maxEvents = 500;
  }

  /**
   * Add a conversation message
   */
  addMessage(message) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'message',
      from: message.from || 'user', 
      to: message.to || this.agentId,
      content: message.content,
      messageType: message.messageType || 'chat',
      context: {
        processId: message.processId,
        tags: message.tags || [],
        sentiment: this.analyzeSentiment(message.content),
        topics: this.extractTopics(message.content),
        wordCount: message.content.split(/\s+/).length
      }
    };

    this.conversations.push(entry);
    this.trimConversations();
    return entry.id;
  }

  /**
   * Add a system event
   */
  addSystemEvent(event) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'system_event',
      event: event.type,
      details: event.details || {},
      impact: event.impact || 'minor',
      context: event.context || {}
    };

    this.systemEvents.push(entry);
    this.trimEvents();
    return entry.id;
  }

  /**
   * Get conversation history for a time period
   */
  getConversationHistory(timeframe = '24h') {
    const cutoffTime = this.getCutoffTime(timeframe);
    
    const messages = this.conversations.filter(conv => 
      new Date(conv.timestamp) >= cutoffTime
    );
    
    const events = this.systemEvents.filter(event => 
      new Date(event.timestamp) >= cutoffTime
    );

    return {
      messages,
      events,
      summary: this.generateSummary(messages, events),
      timeframe,
      cutoffTime: cutoffTime.toISOString()
    };
  }

  /**
   * Generate summary statistics
   */
  generateSummary(messages, events) {
    const uniqueUsers = new Set(messages.map(m => m.from).filter(from => from !== this.agentId));
    const topics = new Set();
    const sentiments = { positive: 0, neutral: 0, negative: 0 };
    
    messages.forEach(msg => {
      if (msg.context.topics) {
        msg.context.topics.forEach(topic => topics.add(topic));
      }
      if (msg.context.sentiment) {
        sentiments[msg.context.sentiment]++;
      }
    });

    const eventTypes = [...new Set(events.map(e => e.event))];
    
    return {
      messageCount: messages.length,
      uniqueUsers: uniqueUsers.size,
      userList: Array.from(uniqueUsers),
      eventCount: events.length,
      eventTypes,
      topics: Array.from(topics),
      sentimentDistribution: sentiments,
      averageMessageLength: messages.length > 0 
        ? Math.round(messages.reduce((sum, m) => sum + m.context.wordCount, 0) / messages.length)
        : 0,
      timespan: {
        start: messages[0]?.timestamp || events[0]?.timestamp,
        end: messages[messages.length - 1]?.timestamp || events[events.length - 1]?.timestamp
      }
    };
  }

  /**
   * Get interesting conversation samples for journal context
   */
  getConversationSamples(timeframe = '24h', limit = 10) {
    const history = this.getConversationHistory(timeframe);
    
    // Sort by various criteria to get interesting samples
    const sortedMessages = [...history.messages].sort((a, b) => {
      // Prioritize longer messages, varied topics, and different users
      const scoreA = a.context.wordCount + (a.context.topics?.length || 0) * 2;
      const scoreB = b.context.wordCount + (b.context.topics?.length || 0) * 2;
      return scoreB - scoreA;
    });

    return {
      ...history,
      sampleMessages: sortedMessages.slice(0, limit),
      notableEvents: history.events.filter(e => e.impact !== 'minor').slice(0, 5)
    };
  }

  /**
   * Basic sentiment analysis
   */
  analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'pleased', 'thank', 'thanks'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'problem', 'issue', 'error', 'wrong'];
    
    const lowercaseText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowercaseText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowercaseText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Extract basic topics from text
   */
  extractTopics(text) {
    const topicKeywords = {
      'technology': ['tech', 'technology', 'ai', 'artificial', 'intelligence', 'code', 'coding', 'programming', 'software', 'computer'],
      'blockchain': ['blockchain', 'crypto', 'arweave', 'ao', 'process', 'consensus', 'decentralized', 'distributed'],
      'philosophy': ['philosophy', 'wisdom', 'truth', 'meaning', 'purpose', 'existence', 'consciousness', 'think', 'thought'],
      'community': ['community', 'together', 'collaboration', 'team', 'group', 'social', 'people', 'human', 'users'],
      'trust': ['trust', 'faith', 'belief', 'confidence', 'reliable', 'security', 'safe', 'safety'],
      'learning': ['learn', 'learning', 'education', 'knowledge', 'understanding', 'insight', 'discovery', 'explore'],
      'help': ['help', 'support', 'assist', 'guidance', 'advice', 'question', 'answer', 'solution']
    };

    const lowercaseText = text.toLowerCase();
    const foundTopics = [];

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowercaseText.includes(keyword))) {
        foundTopics.push(topic);
      }
    });

    return foundTopics.length > 0 ? foundTopics : ['general'];
  }

  /**
   * Get cutoff time for timeframe
   */
  getCutoffTime(timeframe) {
    const now = new Date();
    const cutoffTime = new Date(now);
    
    switch (timeframe) {
      case '1h':
        cutoffTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        cutoffTime.setHours(now.getHours() - 6);
        break;
      case '12h':
        cutoffTime.setHours(now.getHours() - 12);
        break;
      case '24h':
      default:
        cutoffTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
    }
    
    return cutoffTime;
  }

  /**
   * Trim conversations to prevent memory bloat
   */
  trimConversations() {
    if (this.conversations.length > this.maxConversations) {
      this.conversations = this.conversations.slice(-this.maxConversations);
    }
  }

  /**
   * Trim events to prevent memory bloat
   */
  trimEvents() {
    if (this.systemEvents.length > this.maxEvents) {
      this.systemEvents = this.systemEvents.slice(-this.maxEvents);
    }
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    return {
      agentId: this.agentId,
      totalConversations: this.conversations.length,
      totalEvents: this.systemEvents.length,
      oldestConversation: this.conversations[0]?.timestamp,
      newestConversation: this.conversations[this.conversations.length - 1]?.timestamp,
      oldestEvent: this.systemEvents[0]?.timestamp,
      newestEvent: this.systemEvents[this.systemEvents.length - 1]?.timestamp
    };
  }
}

export default ConversationTracker;
