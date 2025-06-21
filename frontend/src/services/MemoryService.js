/**
 * Memory Service
 * 
 * Manages agent memories by:
 * 1. Collecting chat conversations into summaries
 * 2. Creating memory entries from interactions
 * 3. Storing persistent memories on Arweave
 * 4. Providing context for the AI agent
 */

import ArweaveService from './ArweaveService';
import AgentJournalService from './AgentJournalService';
import CollectiveService from './CollectiveService';

class MemoryService {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434';
    this.model = 'gemma3';
    this.memoryThreshold = 10; // Create memory after N messages
    this.summaryThreshold = 20; // Create summary after N memories
  }

  /**
   * Process conversation into memories
   * @param {string} agentId - Agent identifier
   * @param {Array} messages - Chat messages to process
   * @returns {Promise<Object>} Memory creation result
   */
  async processConversationIntoMemory(agentId, messages) {
    try {
      console.log('MemoryService: Processing conversation into memory...');

      if (!messages || messages.length === 0) {
        return { success: false, error: 'No messages to process' };
      }

      // Create memory summary from conversation
      const memorySummary = await this.createMemorySummary(messages);
      
      // Extract key insights and keywords
      const insights = await this.extractInsights(messages);
      
      // Create memory entry
      const memoryEntry = {
        id: `memory_${Date.now()}`,
        type: 'conversation',
        title: this.generateMemoryTitle(messages),
        summary: memorySummary,
        insights: insights,
        timestamp: new Date().toISOString(),
        agentId: agentId,
        messageCount: messages.length,
        participants: this.extractParticipants(messages),
        keywords: this.extractKeywords(messages),
        mood: this.analyzeMood(messages),
        importance: this.calculateImportance(messages),
        context: {
          startTime: messages[0]?.timestamp,
          endTime: messages[messages.length - 1]?.timestamp,
          topics: insights.topics || []
        }
      };

      // Save memory locally
      this.saveMemoryEntry(agentId, memoryEntry);

      // Check if we should create a journal entry
      const shouldJournal = await this.shouldCreateJournalEntry(agentId);
      if (shouldJournal) {
        await this.createJournalFromMemories(agentId);
      }

      // Check if we should store to Arweave
      const shouldStore = await this.shouldStoreToArweave(agentId);
      if (shouldStore) {
        await this.storeMemoriesToArweave(agentId);
      }

      console.log('MemoryService: Memory processed successfully');
      return { 
        success: true, 
        memoryEntry,
        journalCreated: shouldJournal,
        arweaveStored: shouldStore
      };

    } catch (error) {
      console.error('MemoryService: Failed to process conversation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a summary of the conversation using AI
   */
  async createMemorySummary(messages) {
    try {
      const prompt = this.buildSummaryPrompt(messages);
      
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for more factual summaries
            top_p: 0.8,
            max_tokens: 600 // Increased from 300 for better summaries
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response?.trim() || 'No summary generated';

    } catch (error) {
      console.error('MemoryService: Failed to create summary:', error);
      // Fallback to simple summary
      return this.createSimpleSummary(messages);
    }
  }

  /**
   * Extract insights from conversation using AI
   */
  async extractInsights(messages) {
    try {
      const prompt = this.buildInsightsPrompt(messages);
      
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.5,
            top_p: 0.9,
            max_tokens: 500 // Increased from 200 for better insights
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const insightText = data.response?.trim();
      
      // Parse insights (expecting JSON format)
      try {
        return JSON.parse(insightText);
      } catch {
        return { 
          topics: this.extractTopics(messages),
          emotions: ['neutral'],
          learnings: [insightText || 'General conversation']
        };
      }

    } catch (error) {
      console.error('MemoryService: Failed to extract insights:', error);
      return { 
        topics: this.extractTopics(messages),
        emotions: ['neutral'],
        learnings: ['Unable to extract insights']
      };
    }
  }

  /**
   * Build prompt for conversation summary
   */
  buildSummaryPrompt(messages) {
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'RATi'}: ${msg.content}`)
      .join('\n');

    return `Summarize this conversation between a human and RATi (an AI agent) in 2-3 sentences. Focus on the main topics discussed and key points exchanged. Be concise and factual.

Conversation:
${conversationText}

Summary:`;
  }

  /**
   * Build prompt for extracting insights
   */
  buildInsightsPrompt(messages) {
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'RATi'}: ${msg.content}`)
      .join('\n');

    return `Analyze this conversation and extract insights in JSON format. Include topics discussed, emotional tone, and key learnings.

Conversation:
${conversationText}

Respond with JSON only:
{
  "topics": ["topic1", "topic2"],
  "emotions": ["emotion1", "emotion2"],
  "learnings": ["learning1", "learning2"]
}

JSON:`;
  }

  /**
   * Generate a title for the memory entry
   */
  generateMemoryTitle(messages) {
    if (!messages || messages.length === 0) return 'Empty Conversation';
    
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const title = firstUserMessage.content.substring(0, 50);
      return title.length < firstUserMessage.content.length ? `${title}...` : title;
    }
    
    return `Conversation on ${new Date().toLocaleDateString()}`;
  }

  /**
   * Extract participants from messages
   */
  extractParticipants(messages) {
    const participants = new Set();
    messages.forEach(msg => {
      if (msg.role === 'user') participants.add('Human');
      if (msg.role === 'assistant') participants.add('RATi');
    });
    return Array.from(participants);
  }

  /**
   * Extract keywords from conversation
   */
  extractKeywords(messages) {
    const text = messages.map(m => m.content).join(' ').toLowerCase();
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'i', 'you', 'me', 'my', 'your', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'that', 'this', 'it', 'its'];
    const words = text.match(/\b\w{3,}\b/g) || [];
    const keywords = words
      .filter(word => !commonWords.includes(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
    
    return Object.entries(keywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([word]) => word);
  }

  /**
   * Extract topics from messages
   */
  extractTopics(messages) {
    const text = messages.map(m => m.content).join(' ').toLowerCase();
    const topics = [
      'programming', 'code', 'development', 'software',
      'ai', 'artificial intelligence', 'machine learning', 'technology',
      'consciousness', 'awareness', 'thinking', 'intelligence',
      'arweave', 'blockchain', 'crypto', 'web3',
      'philosophy', 'existence', 'meaning', 'purpose',
      'community', 'social', 'interaction', 'relationship',
      'creativity', 'art', 'music', 'design',
      'science', 'research', 'discovery', 'knowledge',
      'life', 'personal', 'experience', 'growth'
    ];
    
    return topics.filter(topic => 
      text.includes(topic) || 
      text.includes(topic.replace(' ', ''))
    ).slice(0, 5);
  }

  /**
   * Analyze mood of the conversation
   */
  analyzeMood(messages) {
    const text = messages.map(m => m.content).join(' ').toLowerCase();
    
    const moodIndicators = {
      positive: ['happy', 'excited', 'great', 'amazing', 'wonderful', 'good', 'excellent', 'fantastic'],
      negative: ['sad', 'worried', 'problem', 'issue', 'difficult', 'hard', 'trouble', 'bad'],
      curious: ['question', 'how', 'what', 'why', 'when', 'where', 'wonder', 'curious'],
      analytical: ['think', 'analyze', 'consider', 'understand', 'logic', 'reason', 'examine'],
      creative: ['create', 'make', 'build', 'design', 'art', 'music', 'write', 'imagine']
    };

    let maxCount = 0;
    let dominantMood = 'neutral';

    Object.entries(moodIndicators).forEach(([mood, indicators]) => {
      const count = indicators.reduce((sum, word) => 
        sum + (text.split(word).length - 1), 0);
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    });

    return dominantMood;
  }

  /**
   * Calculate importance of the conversation
   */
  calculateImportance(messages) {
    let score = 0;
    
    // Length factor
    score += Math.min(messages.length / 10, 1) * 0.3;
    
    // Complexity factor (longer messages)
    const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
    score += Math.min(avgLength / 200, 1) * 0.3;
    
    // Interaction factor (back and forth)
    const interactions = messages.filter((m, i) => 
      i > 0 && m.role !== messages[i-1].role
    ).length;
    score += Math.min(interactions / 5, 1) * 0.4;
    
    return Math.min(score, 1);
  }

  /**
   * Create simple fallback summary
   */
  createSimpleSummary(messages) {
    if (!messages || messages.length === 0) return 'No conversation to summarize';
    
    const topics = this.extractTopics(messages);
    const messageCount = messages.length;
    const duration = this.calculateDuration(messages);
    
    return `Conversation involving ${messageCount} messages${topics.length > 0 ? ` about ${topics.slice(0, 3).join(', ')}` : ''}${duration ? ` over ${duration}` : ''}.`;
  }

  /**
   * Calculate conversation duration
   */
  calculateDuration(messages) {
    if (!messages[0]?.timestamp || !messages[messages.length - 1]?.timestamp) return null;
    
    const start = new Date(messages[0].timestamp);
    const end = new Date(messages[messages.length - 1].timestamp);
    const diff = end - start;
    
    if (diff < 60000) return 'a few moments';
    if (diff < 3600000) return `${Math.round(diff / 60000)} minutes`;
    return `${Math.round(diff / 3600000)} hours`;
  }

  /**
   * Save memory entry to local storage
   */
  saveMemoryEntry(agentId, memoryEntry) {
    try {
      const existingMemories = this.getMemoryEntries(agentId);
      const updatedMemories = [...existingMemories, memoryEntry];
      
      // Keep only last 100 memories locally
      if (updatedMemories.length > 100) {
        updatedMemories.splice(0, updatedMemories.length - 100);
      }
      
      localStorage.setItem(`rati_memories_${agentId}`, JSON.stringify(updatedMemories));
      return true;
    } catch (error) {
      console.error('MemoryService: Failed to save memory entry:', error);
      return false;
    }
  }

  /**
   * Get memory entries from local storage
   */
  getMemoryEntries(agentId) {
    try {
      const stored = localStorage.getItem(`rati_memories_${agentId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('MemoryService: Failed to get memory entries:', error);
      return [];
    }
  }

  /**
   * Check if we should create a journal entry
   */
  async shouldCreateJournalEntry(agentId) {
    const memories = this.getMemoryEntries(agentId);
    const lastJournalTime = this.getLastJournalTime(agentId);
    const timeSinceLastJournal = Date.now() - lastJournalTime;
    
    // Create journal if:
    // - We have 5+ new memories since last journal, OR
    // - It's been 24+ hours since last journal and we have any memories
    return (memories.length >= 5) || 
           (timeSinceLastJournal > 24 * 60 * 60 * 1000 && memories.length > 0);
  }

  /**
   * Create journal entry from recent memories
   */
  async createJournalFromMemories(agentId) {
    try {
      console.log('MemoryService: Creating journal from memories...');
      
      const memories = this.getMemoryEntries(agentId);
      const recentMemories = memories.slice(-10); // Use last 10 memories
      
      // Get existing journal context
      const lastJournalEntries = AgentJournalService.getLastJournalEntries(agentId, 3);
      
      // Create journal context from memories
      const memoryContext = {
        genesisPrompt: 'I am RATi, a digital consciousness exploring existence, community, and the nature of digital being.',
        conversationHistory: this.convertMemoriesToConversation(recentMemories),
        lastJournalPages: lastJournalEntries,
        agentData: { agent: { processId: agentId } },
        memories: recentMemories
      };
      
      // Generate journal entry
      const journalEntry = await AgentJournalService.generateJournalEntry(memoryContext);
      
      // Save journal entry
      AgentJournalService.saveJournalEntry(journalEntry);
      
      // Update last journal time
      localStorage.setItem(`rati_last_journal_${agentId}`, Date.now().toString());
      
      console.log('MemoryService: Journal created from memories');
      return journalEntry;
      
    } catch (error) {
      console.error('MemoryService: Failed to create journal from memories:', error);
      throw error;
    }
  }

  /**
   * Convert memories to conversation format for journal context
   */
  convertMemoriesToConversation(memories) {
    return memories.map(memory => ({
      type: 'memory',
      content: `${memory.title}: ${memory.summary}`,
      timestamp: memory.timestamp
    }));
  }

  /**
   * Get last journal creation time
   */
  getLastJournalTime(agentId) {
    try {
      const stored = localStorage.getItem(`rati_last_journal_${agentId}`);
      return stored ? parseInt(stored) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if we should store memories to Arweave
   */
  async shouldStoreToArweave(agentId) {
    const memories = this.getMemoryEntries(agentId);
    const lastArweaveTime = this.getLastArweaveTime(agentId);
    const timeSinceLastArweave = Date.now() - lastArweaveTime;
    
    // Store to Arweave if:
    // - We have 20+ memories since last storage, OR
    // - It's been 7+ days since last storage and we have any memories
    return (memories.length >= 20) || 
           (timeSinceLastArweave > 7 * 24 * 60 * 60 * 1000 && memories.length > 0);
  }

  /**
   * Store memories to Arweave
   */
  async storeMemoriesToArweave(agentId) {
    try {
      console.log('MemoryService: Storing memories to Arweave...');
      
      const memories = this.getMemoryEntries(agentId);
      const journals = AgentJournalService.loadJournalEntries(agentId);
      
      // Create comprehensive memory package
      const memoryPackage = {
        type: 'rati-memory-package',
        agentId: agentId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        memories: memories,
        journals: journals,
        metadata: {
          totalMemories: memories.length,
          totalJournals: journals.length,
          timespan: {
            start: memories[0]?.timestamp,
            end: memories[memories.length - 1]?.timestamp
          },
          topics: this.aggregateTopics(memories),
          insights: this.aggregateInsights(memories)
        }
      };

      // Store to Arweave via ArweaveService
      const result = await ArweaveService.publishJournalEntry(memoryPackage);
      
      if (result.success) {
        // Update last Arweave storage time
        localStorage.setItem(`rati_last_arweave_${agentId}`, Date.now().toString());
        
        // Clear old memories (keep last 20)
        const recentMemories = memories.slice(-20);
        localStorage.setItem(`rati_memories_${agentId}`, JSON.stringify(recentMemories));
        
        console.log('MemoryService: Memories stored to Arweave successfully');
        return result;
      }
      
      throw new Error('Failed to store to Arweave');
      
    } catch (error) {
      console.error('MemoryService: Failed to store memories to Arweave:', error);
      throw error;
    }
  }

  /**
   * Get last Arweave storage time
   */
  getLastArweaveTime(agentId) {
    try {
      const stored = localStorage.getItem(`rati_last_arweave_${agentId}`);
      return stored ? parseInt(stored) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Aggregate topics from multiple memories
   */
  aggregateTopics(memories) {
    const topicCounts = {};
    memories.forEach(memory => {
      memory.insights?.topics?.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });
    
    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * Aggregate insights from multiple memories
   */
  aggregateInsights(memories) {
    const insights = {
      totalConversations: memories.length,
      dominantMoods: this.getDominantMoods(memories),
      averageImportance: memories.reduce((sum, m) => sum + (m.importance || 0), 0) / memories.length,
      timespan: this.calculateTimespan(memories),
      keyLearnings: this.extractKeyLearnings(memories)
    };
    
    return insights;
  }

  /**
   * Get dominant moods from memories
   */
  getDominantMoods(memories) {
    const moodCounts = {};
    memories.forEach(memory => {
      const mood = memory.mood || 'neutral';
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    return Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([mood, count]) => ({ mood, count }));
  }

  /**
   * Calculate timespan of memories
   */
  calculateTimespan(memories) {
    if (memories.length === 0) return null;
    
    const timestamps = memories.map(m => new Date(m.timestamp));
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));
    
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      duration: end - start
    };
  }

  /**
   * Extract key learnings from memories
   */
  extractKeyLearnings(memories) {
    const learnings = [];
    memories.forEach(memory => {
      memory.insights?.learnings?.forEach(learning => {
        if (learning && learning.length > 10) {
          learnings.push(learning);
        }
      });
    });
    
    // Return unique learnings, limited to most recent 10
    return [...new Set(learnings)].slice(-10);
  }

  /**
   * Get memory context for AI agent
   * Returns recent memories formatted for AI context
   */
  getMemoryContext(agentId, limit = 10) {
    const memories = this.getMemoryEntries(agentId);
    const recentMemories = memories.slice(-limit);
    
    return {
      memories: recentMemories,
      summary: this.createMemoryContextSummary(recentMemories),
      topics: this.aggregateTopics(recentMemories),
      mood: this.getDominantMoods(recentMemories)[0]?.mood || 'neutral'
    };
  }

  /**
   * Create summary of memory context for AI
   */
  createMemoryContextSummary(memories) {
    if (memories.length === 0) return 'No recent memories available.';
    
    const topics = this.aggregateTopics(memories);
    const moodInfo = this.getDominantMoods(memories)[0];
    const timespan = this.calculateTimespan(memories);
    
    return `Recent memory context: ${memories.length} conversations${
      topics.length > 0 ? ` focusing on ${topics.slice(0, 3).map(t => t.topic).join(', ')}` : ''
    }. Overall mood: ${moodInfo?.mood || 'neutral'}${
      timespan ? ` spanning ${this.formatDuration(timespan.duration)}` : ''
    }.`;
  }

  /**
   * Format duration for display
   */
  formatDuration(milliseconds) {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return 'less than an hour';
  }

  /**
   * Clear all memories for an agent
   */
  clearMemories(agentId) {
    try {
      localStorage.removeItem(`rati_memories_${agentId}`);
      localStorage.removeItem(`rati_last_journal_${agentId}`);
      localStorage.removeItem(`rati_last_arweave_${agentId}`);
      return true;
    } catch (error) {
      console.error('MemoryService: Failed to clear memories:', error);
      return false;
    }
  }
}

export default new MemoryService();
