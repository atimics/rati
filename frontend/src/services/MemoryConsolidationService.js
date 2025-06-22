/**
 * Memory Consolidation Service
 * 
 * Provides memory organization, consolidation, and hierarchical structuring:
 * - Groups related memories by topic and time
 * - Creates memory hierarchies with parent-child relationships
 * - Consolidates redundant or similar memories
 * - Manages memory pruning and archival strategies
 */

class MemoryConsolidationService {
  constructor() {
    this.consolidationRules = {
      similarityThreshold: 0.7,
      timeWindowHours: 24,
      maxMemoriesPerTopic: 10,
      consolidationMinCount: 3
    };
  }

  /**
   * Organize memories into hierarchical structure
   * @param {Array} memories - Raw memory entries
   * @returns {Object} Hierarchically organized memory structure
   */
  organizeMemoriesHierarchically(memories) {
    if (!memories || memories.length === 0) return { topics: {}, timeline: {}, clusters: [] };

    // Group by topics
    const topicGroups = this.groupByTopics(memories);
    
    // Group by time periods
    const timelineGroups = this.groupByTimePeriods(memories);
    
    // Create memory clusters based on similarity
    const memoryClusters = this.createMemoryClusters(memories);
    
    // Build hierarchical structure
    const hierarchy = this.buildMemoryHierarchy(topicGroups, timelineGroups, memoryClusters);
    
    return hierarchy;
  }

  /**
   * Group memories by topics with sub-topic analysis
   */
  groupByTopics(memories) {
    const topicGroups = {};
    
    memories.forEach(memory => {
      const topics = memory.insights?.topics || ['general'];
      const primaryTopic = topics[0] || 'general';
      
      if (!topicGroups[primaryTopic]) {
        topicGroups[primaryTopic] = {
          primaryMemories: [],
          subTopics: {},
          totalImportance: 0,
          timeSpan: { start: null, end: null }
        };
      }
      
      topicGroups[primaryTopic].primaryMemories.push(memory);
      topicGroups[primaryTopic].totalImportance += memory.importance || 0;
      
      // Update time span
      const memoryTime = new Date(memory.timestamp);
      if (!topicGroups[primaryTopic].timeSpan.start || memoryTime < topicGroups[primaryTopic].timeSpan.start) {
        topicGroups[primaryTopic].timeSpan.start = memoryTime;
      }
      if (!topicGroups[primaryTopic].timeSpan.end || memoryTime > topicGroups[primaryTopic].timeSpan.end) {
        topicGroups[primaryTopic].timeSpan.end = memoryTime;
      }
      
      // Handle sub-topics
      if (topics.length > 1) {
        topics.slice(1).forEach(subTopic => {
          if (!topicGroups[primaryTopic].subTopics[subTopic]) {
            topicGroups[primaryTopic].subTopics[subTopic] = [];
          }
          topicGroups[primaryTopic].subTopics[subTopic].push(memory);
        });
      }
    });
    
    return topicGroups;
  }

  /**
   * Group memories by time periods (day, week, month)
   */
  groupByTimePeriods(memories) {
    const timeGroups = {
      daily: {},
      weekly: {},
      monthly: {}
    };
    
    memories.forEach(memory => {
      const date = new Date(memory.timestamp);
      
      // Daily grouping
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!timeGroups.daily[dayKey]) {
        timeGroups.daily[dayKey] = [];
      }
      timeGroups.daily[dayKey].push(memory);
      
      // Weekly grouping
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!timeGroups.weekly[weekKey]) {
        timeGroups.weekly[weekKey] = [];
      }
      timeGroups.weekly[weekKey].push(memory);
      
      // Monthly grouping
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!timeGroups.monthly[monthKey]) {
        timeGroups.monthly[monthKey] = [];
      }
      timeGroups.monthly[monthKey].push(memory);
    });
    
    return timeGroups;
  }

  /**
   * Create memory clusters based on content similarity
   */
  createMemoryClusters(memories) {
    const clusters = [];
    const processedMemories = new Set();
    
    memories.forEach((memory, index) => {
      if (processedMemories.has(memory.id)) return;
      
      const cluster = {
        id: `cluster_${Date.now()}_${index}`,
        centerMemory: memory,
        relatedMemories: [],
        topics: memory.insights?.topics || [],
        averageImportance: memory.importance || 0,
        timeSpan: {
          start: new Date(memory.timestamp),
          end: new Date(memory.timestamp)
        }
      };
      
      // Find similar memories
      memories.forEach(otherMemory => {
        if (otherMemory.id === memory.id || processedMemories.has(otherMemory.id)) return;
        
        const similarity = this.calculateMemorySimilarity(memory, otherMemory);
        if (similarity >= this.consolidationRules.similarityThreshold) {
          cluster.relatedMemories.push(otherMemory);
          processedMemories.add(otherMemory.id);
          
          // Update cluster metadata
          cluster.averageImportance = (cluster.averageImportance + (otherMemory.importance || 0)) / 2;
          
          const otherTime = new Date(otherMemory.timestamp);
          if (otherTime < cluster.timeSpan.start) cluster.timeSpan.start = otherTime;
          if (otherTime > cluster.timeSpan.end) cluster.timeSpan.end = otherTime;
          
          // Merge topics
          (otherMemory.insights?.topics || []).forEach(topic => {
            if (!cluster.topics.includes(topic)) {
              cluster.topics.push(topic);
            }
          });
        }
      });
      
      processedMemories.add(memory.id);
      
      // Only add clusters with multiple memories or high importance
      if (cluster.relatedMemories.length > 0 || cluster.averageImportance > 0.7) {
        clusters.push(cluster);
      }
    });
    
    return clusters.sort((a, b) => b.averageImportance - a.averageImportance);
  }

  /**
   * Calculate similarity between two memories
   */
  calculateMemorySimilarity(memory1, memory2) {
    let similarity = 0;
    
    // Topic overlap
    const topics1 = memory1.insights?.topics || [];
    const topics2 = memory2.insights?.topics || [];
    const topicOverlap = topics1.filter(t => topics2.includes(t)).length;
    const topicSimilarity = topicOverlap / Math.max(topics1.length, topics2.length, 1);
    similarity += topicSimilarity * 0.4;
    
    // Keyword overlap
    const keywords1 = memory1.keywords || [];
    const keywords2 = memory2.keywords || [];
    const keywordOverlap = keywords1.filter(k => keywords2.includes(k)).length;
    const keywordSimilarity = keywordOverlap / Math.max(keywords1.length, keywords2.length, 1);
    similarity += keywordSimilarity * 0.3;
    
    // Mood similarity
    if (memory1.mood === memory2.mood) {
      similarity += 0.1;
    }
    
    // Temporal proximity (memories close in time are more likely to be related)
    const time1 = new Date(memory1.timestamp).getTime();
    const time2 = new Date(memory2.timestamp).getTime();
    const timeDiff = Math.abs(time1 - time2);
    const hoursApart = timeDiff / (1000 * 60 * 60);
    const temporalSimilarity = Math.max(0, 1 - (hoursApart / this.consolidationRules.timeWindowHours));
    similarity += temporalSimilarity * 0.2;
    
    return Math.min(similarity, 1.0);
  }

  /**
   * Build comprehensive memory hierarchy
   */
  buildMemoryHierarchy(topicGroups, timelineGroups, memoryClusters) {
    return {
      topics: this.enhanceTopicGroups(topicGroups),
      timeline: this.enhanceTimelineGroups(timelineGroups),
      clusters: memoryClusters,
      summary: this.generateHierarchySummary(topicGroups, timelineGroups, memoryClusters)
    };
  }

  /**
   * Enhance topic groups with additional metadata
   */
  enhanceTopicGroups(topicGroups) {
    const enhanced = {};
    
    Object.entries(topicGroups).forEach(([topic, group]) => {
      enhanced[topic] = {
        ...group,
        averageImportance: group.totalImportance / group.primaryMemories.length,
        memoryCount: group.primaryMemories.length,
        subTopicCount: Object.keys(group.subTopics).length,
        dominantMood: this.calculateDominantMood(group.primaryMemories),
        keyInsights: this.extractTopicInsights(group.primaryMemories)
      };
    });
    
    return enhanced;
  }

  /**
   * Enhance timeline groups with trend analysis
   */
  enhanceTimelineGroups(timelineGroups) {
    const enhanced = {
      daily: {},
      weekly: {},
      monthly: {},
      trends: this.analyzeTrends(timelineGroups)
    };
    
    ['daily', 'weekly', 'monthly'].forEach(period => {
      Object.entries(timelineGroups[period]).forEach(([timeKey, memories]) => {
        enhanced[period][timeKey] = {
          memories,
          count: memories.length,
          averageImportance: memories.reduce((sum, m) => sum + (m.importance || 0), 0) / memories.length,
          dominantTopics: this.extractDominantTopics(memories),
          moodDistribution: this.calculateMoodDistribution(memories)
        };
      });
    });
    
    return enhanced;
  }

  /**
   * Generate comprehensive hierarchy summary
   */
  generateHierarchySummary(topicGroups, timelineGroups, memoryClusters) {
    const totalMemories = Object.values(topicGroups).reduce((sum, group) => sum + group.primaryMemories.length, 0);
    const topTopics = Object.entries(topicGroups)
      .sort(([,a], [,b]) => b.totalImportance - a.totalImportance)
      .slice(0, 5)
      .map(([topic]) => topic);
    
    const recentActivity = this.analyzeRecentActivity(timelineGroups);
    const clusterInsights = this.analyzeClusterInsights(memoryClusters);
    
    return {
      totalMemories,
      totalTopics: Object.keys(topicGroups).length,
      totalClusters: memoryClusters.length,
      topTopics,
      recentActivity,
      clusterInsights,
      memoryDensity: this.calculateMemoryDensity(timelineGroups)
    };
  }

  /**
   * Consolidate redundant memories
   */
  consolidateRedundantMemories(memories) {
    const consolidated = [];
    const redundantGroups = [];
    const processedIds = new Set();
    
    memories.forEach(memory => {
      if (processedIds.has(memory.id)) return;
      
      const similarMemories = memories.filter(other => 
        other.id !== memory.id && 
        !processedIds.has(other.id) &&
        this.calculateMemorySimilarity(memory, other) >= 0.8
      );
      
      if (similarMemories.length >= this.consolidationRules.consolidationMinCount - 1) {
        // Create consolidated memory
        const consolidatedMemory = this.createConsolidatedMemory(memory, similarMemories);
        consolidated.push(consolidatedMemory);
        
        redundantGroups.push({
          consolidatedId: consolidatedMemory.id,
          originalIds: [memory.id, ...similarMemories.map(m => m.id)]
        });
        
        // Mark as processed
        processedIds.add(memory.id);
        similarMemories.forEach(sm => processedIds.add(sm.id));
      } else {
        // Keep original memory
        consolidated.push(memory);
        processedIds.add(memory.id);
      }
    });
    
    return {
      consolidatedMemories: consolidated,
      redundantGroups,
      reductionRate: (memories.length - consolidated.length) / memories.length
    };
  }

  /**
   * Create a consolidated memory from similar memories
   */
  createConsolidatedMemory(primaryMemory, similarMemories) {
    const allMemories = [primaryMemory, ...similarMemories];
    
    // Merge insights
    const allTopics = [...new Set(allMemories.flatMap(m => m.insights?.topics || []))];
    const allEmotions = [...new Set(allMemories.flatMap(m => m.insights?.emotions || []))];
    const allLearnings = [...new Set(allMemories.flatMap(m => m.insights?.learnings || []))];
    
    // Calculate consolidated metrics
    const averageImportance = allMemories.reduce((sum, m) => sum + (m.importance || 0), 0) / allMemories.length;
    const totalMessageCount = allMemories.reduce((sum, m) => sum + (m.messageCount || 0), 0);
    
    return {
      id: `consolidated_${Date.now()}_${primaryMemory.id}`,
      type: 'consolidated',
      title: `Consolidated: ${primaryMemory.title}`,
      summary: this.createConsolidatedSummary(allMemories),
      insights: {
        topics: allTopics,
        emotions: allEmotions,
        learnings: allLearnings
      },
      timestamp: primaryMemory.timestamp, // Keep earliest timestamp
      agentId: primaryMemory.agentId,
      messageCount: totalMessageCount,
      participants: [...new Set(allMemories.flatMap(m => m.participants || []))],
      keywords: [...new Set(allMemories.flatMap(m => m.keywords || []))],
      mood: this.calculateDominantMood(allMemories),
      importance: averageImportance,
      consolidatedFrom: allMemories.map(m => ({
        id: m.id,
        title: m.title,
        timestamp: m.timestamp
      })),
      context: {
        startTime: Math.min(...allMemories.map(m => new Date(m.context?.startTime || m.timestamp).getTime())),
        endTime: Math.max(...allMemories.map(m => new Date(m.context?.endTime || m.timestamp).getTime())),
        topics: allTopics
      }
    };
  }

  /**
   * Create summary for consolidated memory
   */
  createConsolidatedSummary(memories) {
    const themes = this.extractCommonThemes(memories);
    const duration = this.calculateTotalDuration(memories);
    const participantCount = new Set(memories.flatMap(m => m.participants || [])).size;
    
    return `Consolidated memory from ${memories.length} related conversations ${
      themes.length > 0 ? `about ${themes.slice(0, 2).join(' and ')} ` : ''
    }involving ${participantCount} participants${
      duration ? ` over ${duration}` : ''
    }. Key themes include ${themes.slice(0, 3).join(', ')}.`;
  }

  // Helper methods for analysis and calculation
  
  calculateDominantMood(memories) {
    const moodCounts = {};
    memories.forEach(memory => {
      const mood = memory.mood || 'neutral';
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    return Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
  }

  extractTopicInsights(memories) {
    const insights = [];
    const topicFrequency = {};
    
    memories.forEach(memory => {
      (memory.insights?.topics || []).forEach(topic => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      });
    });
    
    Object.entries(topicFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([topic, count]) => {
        insights.push(`${topic} discussed in ${count} conversations`);
      });
    
    return insights;
  }

  extractDominantTopics(memories) {
    const topicCounts = {};
    memories.forEach(memory => {
      (memory.insights?.topics || []).forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });
    
    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);
  }

  calculateMoodDistribution(memories) {
    const distribution = {};
    memories.forEach(memory => {
      const mood = memory.mood || 'neutral';
      distribution[mood] = (distribution[mood] || 0) + 1;
    });
    
    const total = memories.length;
    Object.keys(distribution).forEach(mood => {
      distribution[mood] = distribution[mood] / total;
    });
    
    return distribution;
  }

  analyzeTrends(timelineGroups) {
    // Simple trend analysis - could be enhanced
    const dailyEntries = Object.entries(timelineGroups.daily)
      .sort(([a], [b]) => a.localeCompare(b));
    
    if (dailyEntries.length < 2) return { trend: 'insufficient_data' };
    
    const recent = dailyEntries.slice(-7); // Last 7 days
    const avgRecent = recent.reduce((sum, [, memories]) => sum + memories.length, 0) / recent.length;
    
    const previous = dailyEntries.slice(-14, -7); // Previous 7 days
    const avgPrevious = previous.length > 0 ? 
      previous.reduce((sum, [, memories]) => sum + memories.length, 0) / previous.length : 0;
    
    const trendDirection = avgRecent > avgPrevious ? 'increasing' : 
                          avgRecent < avgPrevious ? 'decreasing' : 'stable';
    
    return {
      trend: trendDirection,
      recentAverage: avgRecent,
      previousAverage: avgPrevious,
      changePercent: avgPrevious > 0 ? ((avgRecent - avgPrevious) / avgPrevious) * 100 : 0
    };
  }

  analyzeRecentActivity(timelineGroups) {
    const recent = Object.entries(timelineGroups.daily)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7);
    
    const totalRecent = recent.reduce((sum, [, memories]) => sum + memories.length, 0);
    const avgImportance = recent.reduce((sum, [, memories]) => {
      const dayAvg = memories.reduce((s, m) => s + (m.importance || 0), 0) / memories.length;
      return sum + dayAvg;
    }, 0) / recent.length;
    
    return {
      memoriesLast7Days: totalRecent,
      averageImportance: avgImportance,
      mostActiveDay: recent.sort(([,a], [,b]) => b.length - a.length)[0]?.[0]
    };
  }

  analyzeClusterInsights(clusters) {
    if (clusters.length === 0) return { insights: [] };
    
    const insights = [];
    
    // Find largest clusters
    const largestCluster = clusters.sort((a, b) => b.relatedMemories.length - a.relatedMemories.length)[0];
    if (largestCluster && largestCluster.relatedMemories.length > 2) {
      insights.push(`Largest conversation cluster contains ${largestCluster.relatedMemories.length + 1} related memories about ${largestCluster.topics.slice(0, 2).join(' and ')}`);
    }
    
    // Find high-importance clusters
    const importantClusters = clusters.filter(c => c.averageImportance > 0.7);
    if (importantClusters.length > 0) {
      insights.push(`${importantClusters.length} memory clusters marked as high importance`);
    }
    
    return { insights };
  }

  calculateMemoryDensity(timelineGroups) {
    const totalDays = Object.keys(timelineGroups.daily).length;
    const totalMemories = Object.values(timelineGroups.daily)
      .reduce((sum, memories) => sum + memories.length, 0);
    
    return totalDays > 0 ? totalMemories / totalDays : 0;
  }

  extractCommonThemes(memories) {
    const themes = {};
    memories.forEach(memory => {
      (memory.insights?.topics || []).forEach(topic => {
        themes[topic] = (themes[topic] || 0) + 1;
      });
    });
    
    return Object.entries(themes)
      .sort(([,a], [,b]) => b - a)
      .map(([theme]) => theme);
  }

  calculateTotalDuration(memories) {
    const times = memories.map(m => new Date(m.timestamp).getTime());
    const start = Math.min(...times);
    const end = Math.max(...times);
    const diffHours = (end - start) / (1000 * 60 * 60);
    
    if (diffHours < 24) return `${Math.round(diffHours)} hours`;
    if (diffHours < 24 * 7) return `${Math.round(diffHours / 24)} days`;
    return `${Math.round(diffHours / (24 * 7))} weeks`;
  }
}

export default MemoryConsolidationService;
