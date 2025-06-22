/**
 * Agent Memory Integration Service
 * 
 * Provides enhanced memory integration for the AI agent with:
 * - Semantic memory retrieval
 * - Context-aware memory weaving
 * - Fallback mechanisms for reliable operation
 * - Memory consolidation and organization
 */

class AgentMemoryService {
  constructor() {
    this.memoryCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get semantically relevant memories for current context
   * @param {Array} currentMessages - Current conversation context
   * @param {Array} allMemories - All available agent memories
   * @param {Object} options - Configuration options
   */
  async getRelevantMemoryContext(currentMessages, allMemories, options = {}) {
    const {
      maxMemories = 5,
      minRelevanceScore = 0.1,
      includeRecent = true,
      preferHighImportance = true
    } = options;

    try {
      // Extract context from current messages
      const currentContext = this.extractMessageContext(currentMessages);
      
      // Find semantically relevant memories
      const relevantMemories = this.findSemanticMatches(currentContext, allMemories, {
        maxResults: maxMemories * 2, // Get more candidates for better filtering
        minScore: minRelevanceScore
      });

      // Apply additional filtering and ranking
      const rankedMemories = this.rankMemoriesByContext(relevantMemories, currentContext, {
        preferRecent: includeRecent,
        preferImportant: preferHighImportance
      });

      // Build enhanced context string for AI
      const memoryContext = this.buildMemoryContextForAI(rankedMemories.slice(0, maxMemories));

      return {
        memories: rankedMemories.slice(0, maxMemories),
        contextString: memoryContext,
        relevanceScores: rankedMemories.map(m => m.relevanceScore),
        totalMemoriesConsidered: allMemories.length
      };

    } catch (error) {
      console.error('AgentMemoryService: Failed to get relevant context:', error);
      return this.getFallbackMemoryContext(allMemories, maxMemories);
    }
  }

  /**
   * Extract meaningful context from messages
   */
  extractMessageContext(messages) {
    if (!messages || messages.length === 0) return {};

    const allText = messages.map(m => m.content || m.data || '').join(' ');
    
    return {
      text: allText,
      keywords: this.extractKeywords(allText),
      topics: this.extractTopics(allText),
      entities: this.extractEntities(allText),
      sentiment: this.analyzeSentiment(allText),
      urgency: this.detectUrgency(messages),
      messageTypes: this.categorizeMessages(messages)
    };
  }

  /**
   * Find semantic matches using multiple scoring methods
   */
  findSemanticMatches(context, memories, options = {}) {
    const { maxResults = 10, minScore = 0.1 } = options;
    
    const scoredMemories = memories.map(memory => {
      let relevanceScore = 0;
      
      // Keyword overlap scoring (weighted by TF-IDF-like approach)
      const keywordScore = this.calculateKeywordScore(context.keywords, memory.keywords || []);
      relevanceScore += keywordScore * 0.3;
      
      // Topic similarity scoring
      const topicScore = this.calculateTopicScore(context.topics, memory.insights?.topics || []);
      relevanceScore += topicScore * 0.4;
      
      // Entity recognition scoring
      const entityScore = this.calculateEntityScore(context.entities, memory);
      relevanceScore += entityScore * 0.2;
      
      // Recency bonus (recent memories get slight boost)
      const recencyScore = this.calculateRecencyScore(memory.timestamp);
      relevanceScore += recencyScore * 0.1;
      
      return {
        ...memory,
        relevanceScore: Math.min(relevanceScore, 1.0) // Cap at 1.0
      };
    });

    return scoredMemories
      .filter(m => m.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Advanced keyword scoring with frequency weighting
   */
  calculateKeywordScore(contextKeywords, memoryKeywords) {
    if (!contextKeywords.length || !memoryKeywords.length) return 0;
    
    let matches = 0;
    let totalWeight = 0;
    
    contextKeywords.forEach(keyword => {
      memoryKeywords.forEach(memKeyword => {
        const similarity = this.calculateStringSimilarity(keyword, memKeyword);
        if (similarity > 0.7) { // High similarity threshold
          matches++;
          totalWeight += similarity;
        }
      });
    });
    
    return matches > 0 ? totalWeight / Math.max(contextKeywords.length, memoryKeywords.length) : 0;
  }

  /**
   * Topic-based scoring with semantic understanding
   */
  calculateTopicScore(contextTopics, memoryTopics) {
    if (!contextTopics.length || !memoryTopics.length) return 0;
    
    // Direct topic matches
    const directMatches = contextTopics.filter(ct => 
      memoryTopics.some(mt => mt.toLowerCase().includes(ct.toLowerCase()) || 
                              ct.toLowerCase().includes(mt.toLowerCase()))
    );
    
    // Related topic scoring (e.g., 'programming' relates to 'development')
    const relatedTopics = this.findRelatedTopics(contextTopics, memoryTopics);
    
    return (directMatches.length * 0.8 + relatedTopics.length * 0.2) / contextTopics.length;
  }

  /**
   * Rank memories by multiple contextual factors
   */
  rankMemoriesByContext(memories, context, options = {}) {
    const { preferRecent = true, preferImportant = true } = options;
    
    return memories.map(memory => {
      let finalScore = memory.relevanceScore;
      
      // Importance boost
      if (preferImportant && memory.importance) {
        finalScore += memory.importance * 0.2;
      }
      
      // Recency boost
      if (preferRecent) {
        const recencyBoost = this.calculateRecencyScore(memory.timestamp);
        finalScore += recencyBoost * 0.1;
      }
      
      // Mood relevance (similar moods get boost)
      if (context.sentiment && memory.mood) {
        const moodSimilarity = this.calculateMoodSimilarity(context.sentiment, memory.mood);
        finalScore += moodSimilarity * 0.1;
      }
      
      return {
        ...memory,
        finalScore: Math.min(finalScore, 1.0)
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Build enhanced memory context string for AI consumption
   */
  buildMemoryContextForAI(memories) {
    if (!memories.length) return 'No relevant memories found.';
    
    let contextString = '🧠 RELEVANT MEMORY CONTEXT:\n\n';
    
    memories.forEach((memory, index) => {
      contextString += `${index + 1}. [${memory.mood || 'neutral'}] ${memory.title}\n`;
      contextString += `   📝 ${memory.summary}\n`;
      
      if (memory.insights?.learnings?.length > 0) {
        contextString += `   💡 Key Learning: ${memory.insights.learnings[0]}\n`;
      }
      
      if (memory.keywords?.length > 0) {
        contextString += `   🏷️  Keywords: ${memory.keywords.slice(0, 3).join(', ')}\n`;
      }
      
      contextString += `   📊 Relevance: ${Math.round(memory.relevanceScore * 100)}%\n\n`;
    });
    
    // Add synthesis
    const dominantTopics = this.extractDominantTopics(memories);
    const overallMood = this.calculateOverallMood(memories);
    
    contextString += '🔍 MEMORY SYNTHESIS:\n';
    contextString += `- Primary discussion themes: ${dominantTopics.join(', ')}\n`;
    contextString += `- Overall conversational tone: ${overallMood}\n`;
    contextString += `- Total relevant memories: ${memories.length}\n`;
    
    return contextString;
  }

  /**
   * Fallback memory context when advanced processing fails
   */
  getFallbackMemoryContext(allMemories, maxMemories = 5) {
    console.warn('AgentMemoryService: Using fallback memory context');
    
    // Just get the most recent high-importance memories
    const fallbackMemories = allMemories
      .sort((a, b) => {
        const importanceA = a.importance || 0;
        const importanceB = b.importance || 0;
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        
        // Sort by importance first, then by recency
        if (importanceA !== importanceB) {
          return importanceB - importanceA;
        }
        return timeB - timeA;
      })
      .slice(0, maxMemories);
    
    return {
      memories: fallbackMemories,
      contextString: this.buildSimpleMemoryContext(fallbackMemories),
      relevanceScores: fallbackMemories.map(() => 0.5), // Neutral relevance
      totalMemoriesConsidered: allMemories.length
    };
  }

  /**
   * Simple memory context for fallback scenarios
   */
  buildSimpleMemoryContext(memories) {
    if (!memories.length) return 'No recent memories available.';
    
    let context = 'RECENT MEMORIES:\n';
    memories.forEach((memory, index) => {
      context += `${index + 1}. ${memory.title}: ${memory.summary}\n`;
    });
    
    return context;
  }

  // Helper methods for context extraction and scoring
  
  extractKeywords(text) {
    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'way', 'she', 'may', 'say']);
    
    return words
      .filter(word => !commonWords.has(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
  }

  extractTopics(text) {
    const topicKeywords = {
      'technology': ['code', 'programming', 'software', 'development', 'ai', 'algorithm'],
      'consciousness': ['awareness', 'thinking', 'consciousness', 'mind', 'intelligence'],
      'blockchain': ['arweave', 'blockchain', 'crypto', 'web3', 'decentralized'],
      'philosophy': ['philosophy', 'existence', 'meaning', 'purpose', 'ethics'],
      'community': ['community', 'social', 'interaction', 'collaboration', 'together'],
      'creativity': ['creative', 'art', 'design', 'music', 'imagination'],
      'learning': ['learn', 'education', 'knowledge', 'study', 'understand']
    };
    
    const lowerText = text.toLowerCase();
    const detectedTopics = [];
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (matches > 0) {
        detectedTopics.push({ topic, strength: matches });
      }
    });
    
    return detectedTopics
      .sort((a, b) => b.strength - a.strength)
      .map(t => t.topic);
  }

  extractEntities(text) {
    // Simple entity extraction - could be enhanced with NLP libraries
    const entities = {
      people: text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [],
      urls: text.match(/https?:\/\/[^\s]+/g) || [],
      mentions: text.match(/@\w+/g) || [],
      hashtags: text.match(/#\w+/g) || []
    };
    
    return entities;
  }

  analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'excited'];
    const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'angry', 'frustrated', 'disappointed'];
    
    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  detectUrgency(messages) {
    const urgentPatterns = ['urgent', 'asap', 'immediately', 'quickly', 'emergency', '!!!'];
    const text = messages.map(m => m.content || m.data || '').join(' ').toLowerCase();
    
    return urgentPatterns.some(pattern => text.includes(pattern));
  }

  categorizeMessages(messages) {
    return messages.map(message => {
      const content = (message.content || message.data || '').toLowerCase();
      
      if (content.includes('?')) return 'question';
      if (content.length > 200) return 'detailed';
      if (content.match(/\b(propose|suggest|recommend)\b/)) return 'proposal';
      return 'general';
    });
  }

  calculateStringSimilarity(str1, str2) {
    // Simple Levenshtein distance based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  findRelatedTopics(contextTopics, memoryTopics) {
    const topicRelations = {
      'technology': ['programming', 'ai', 'software', 'development'],
      'consciousness': ['intelligence', 'awareness', 'mind'],
      'blockchain': ['crypto', 'web3', 'arweave'],
      'philosophy': ['ethics', 'meaning', 'existence'],
      'community': ['social', 'collaboration', 'interaction']
    };
    
    const related = [];
    contextTopics.forEach(ctopic => {
      memoryTopics.forEach(mtopic => {
        Object.entries(topicRelations).forEach(([main, related_topics]) => {
          if ((related_topics.includes(ctopic) && related_topics.includes(mtopic)) ||
              (ctopic === main && related_topics.includes(mtopic)) ||
              (mtopic === main && related_topics.includes(ctopic))) {
            related.push({ context: ctopic, memory: mtopic });
          }
        });
      });
    });
    
    return related;
  }

  calculateRecencyScore(timestamp) {
    const now = Date.now();
    const memoryTime = new Date(timestamp).getTime();
    const daysSince = (now - memoryTime) / (1000 * 60 * 60 * 24);
    
    // Exponential decay: recent memories get higher scores
    return Math.exp(-daysSince / 7); // Half-life of about 5 days
  }

  calculateMoodSimilarity(sentiment, mood) {
    const moodMap = {
      'positive': ['positive', 'happy', 'excited', 'joyful'],
      'negative': ['negative', 'sad', 'concerned', 'worried'],
      'neutral': ['neutral', 'analytical', 'thoughtful']
    };
    
    const sentimentMoods = moodMap[sentiment] || [];
    return sentimentMoods.includes(mood) ? 1.0 : 0.0;
  }

  extractDominantTopics(memories) {
    const topicCounts = {};
    
    memories.forEach(memory => {
      memory.insights?.topics?.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });
    
    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);
  }

  calculateOverallMood(memories) {
    const moodCounts = {};
    
    memories.forEach(memory => {
      const mood = memory.mood || 'neutral';
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    return Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
  }
}

export default AgentMemoryService;
