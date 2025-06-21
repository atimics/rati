import React from 'react';
import './MemoryInsightPanel.css';

/**
 * Memory Insight Panel Component
 * 
 * Displays memory insights and context in a more user-friendly way
 */
const MemoryInsightPanel = ({ memoryEntries, isVisible, onToggle }) => {
  if (!memoryEntries || memoryEntries.length === 0) return null;

  // Calculate insights from memories
  const insights = calculateMemoryInsights(memoryEntries);

  return (
    <div className={`memory-insight-panel ${isVisible ? 'visible' : 'collapsed'}`}>
      <div className="panel-header" onClick={onToggle}>
        <h3>🧠 Memory Insights</h3>
        <span className="toggle-icon">{isVisible ? '▼' : '▶'}</span>
      </div>
      
      {isVisible && (
        <div className="panel-content">
          {/* Memory Statistics */}
          <div className="memory-stats">
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-number">{memoryEntries.length}</span>
                <span className="stat-label">Total Memories</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{insights.conversationCount}</span>
                <span className="stat-label">Conversations</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{insights.totalMessages}</span>
                <span className="stat-label">Messages</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{insights.timespan}</span>
                <span className="stat-label">Active Period</span>
              </div>
            </div>
          </div>

          {/* Top Topics */}
          {insights.topics.length > 0 && (
            <div className="insight-section">
              <h4>📚 Main Topics</h4>
              <div className="topic-tags">
                {insights.topics.slice(0, 8).map((topic, index) => (
                  <span key={index} className="topic-tag">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mood Overview */}
          {insights.dominantMood && (
            <div className="insight-section">
              <h4>🎭 Conversation Mood</h4>
              <div className="mood-indicator">
                <span className={`mood-badge ${insights.dominantMood}`}>
                  {getMoodEmoji(insights.dominantMood)} {insights.dominantMood}
                </span>
                <p>{getMoodDescription(insights.dominantMood)}</p>
              </div>
            </div>
          )}

          {/* Recent Activity Summary */}
          <div className="insight-section">
            <h4>⚡ Recent Activity</h4>
            <div className="activity-summary">
              <p>{insights.activitySummary}</p>
            </div>
          </div>

          {/* Memory Actions */}
          <div className="memory-actions">
            <button 
              className="action-btn export-btn"
              onClick={() => exportMemories(memoryEntries)}
              title="Export memories as JSON"
            >
              📤 Export
            </button>
            <button 
              className="action-btn insight-btn"
              onClick={() => generateDetailedInsights(memoryEntries)}
              title="Generate detailed insights"
            >
              🔍 Analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
const calculateMemoryInsights = (memories) => {
  if (!memories.length) return {};

  const conversations = memories.filter(m => m.type === 'conversation');
  const totalMessages = conversations.reduce((sum, conv) => {
    return sum + (Array.isArray(conv.content) ? conv.content.length : 0);
  }, 0);

  // Extract all topics
  const allTopics = memories.flatMap(m => m.keywords || []);
  const topicCounts = {};
  allTopics.forEach(topic => {
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  
  const topTopics = Object.entries(topicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([topic]) => topic);

  // Analyze moods
  const moods = memories.map(m => m.mood).filter(Boolean);
  const moodCounts = {};
  moods.forEach(mood => {
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });
  
  const dominantMood = Object.entries(moodCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0];

  // Calculate timespan
  const timestamps = memories.map(m => new Date(m.timestamp)).sort();
  const timespan = timestamps.length > 1 
    ? formatTimespan(timestamps[timestamps.length - 1] - timestamps[0])
    : 'Recent';

  // Activity summary
  const activitySummary = generateActivitySummary(memories, totalMessages);

  return {
    conversationCount: conversations.length,
    totalMessages,
    topics: topTopics,
    dominantMood,
    timespan,
    activitySummary
  };
};

const getMoodEmoji = (mood) => {
  const emojiMap = {
    positive: '😊',
    analytical: '🤔',
    curious: '🤓',
    thoughtful: '💭',
    concerned: '😟',
    neutral: '😐'
  };
  return emojiMap[mood] || '😐';
};

const getMoodDescription = (mood) => {
  const descriptions = {
    positive: 'Conversations have been upbeat and encouraging',
    analytical: 'Deep thinking and problem-solving discussions',
    curious: 'Lots of questions and exploration of new ideas',
    thoughtful: 'Reflective and contemplative exchanges',
    concerned: 'Some worry or uncertainty in discussions',
    neutral: 'Balanced and matter-of-fact conversations'
  };
  return descriptions[mood] || 'Mixed emotional tone in conversations';
};

const formatTimespan = (milliseconds) => {
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return 'Recent';
};

const generateActivitySummary = (memories, totalMessages) => {
  const conversationCount = memories.filter(m => m.type === 'conversation').length;
  const thoughtCount = memories.filter(m => m.type === 'thought').length;
  
  if (conversationCount > thoughtCount) {
    return `Active discussion period with ${totalMessages} messages across ${conversationCount} conversations.`;
  } else if (thoughtCount > 0) {
    return `Reflective period with ${thoughtCount} thoughts and ${conversationCount} conversations.`;
  } else {
    return `${totalMessages} messages exchanged in recent interactions.`;
  }
};

const exportMemories = (memories) => {
  const dataStr = JSON.stringify(memories, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `rati-memories-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

const generateDetailedInsights = async (memories) => {
  console.log('Generating detailed insights for', memories.length, 'memories...');
  // This could trigger a more detailed AI analysis
  alert('Detailed insights generation would be implemented here, using AI to analyze patterns and generate comprehensive reports.');
};

export default MemoryInsightPanel;
