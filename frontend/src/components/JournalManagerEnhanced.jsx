import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './JournalManager.css';

const JournalManager = ({ agentData, messages, onJournalUpdate }) => {
  const [draftJournal, setDraftJournal] = useState('');
  const [publishedJournal, setPublishedJournal] = useState('');
  const [journalHistory, setJournalHistory] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [contextData, setContextData] = useState(null);
  const [generatedEntry, setGeneratedEntry] = useState(null);
  const [showContext, setShowContext] = useState(false);

  // Load journal data from localStorage
  useEffect(() => {
    if (agentData?.agent?.processId) {
      const saved = localStorage.getItem(`journal_${agentData.agent.processId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setDraftJournal(data.draft || '');
        setPublishedJournal(data.published || '');
        setJournalHistory(data.history || []);
      }
    }
  }, [agentData]);

  // Load context data when component mounts
  useEffect(() => {
    if (agentData?.agent?.processId && showJournal) {
      fetchContextData();
    }
  }, [agentData, showJournal]);

  // Save journal data to localStorage
  const saveToLocalStorage = (draft, published, history) => {
    if (agentData?.agent?.processId) {
      localStorage.setItem(`journal_${agentData.agent.processId}`, JSON.stringify({
        draft,
        published,
        history,
        lastUpdated: new Date().toISOString()
      }));
    }
  };

  // Fetch context data for display
  const fetchContextData = async () => {
    if (!agentData?.agent?.processId) return;
    
    try {
      const response = await fetch(`http://localhost:3032/api/journal/${agentData.agent.processId}/context`);
      if (!response.ok) throw new Error('Failed to fetch context');
      
      const result = await response.json();
      if (result.success) {
        setContextData(result.context);
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
    }
  };

  // Generate AI journal entry using the enhanced backend
  const generateAIJournal = async () => {
    if (!agentData?.agent?.processId) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch(`http://localhost:3032/api/journal/${agentData.agent.processId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeframe: '24h',
          includeContext: true
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate journal entry');
      
      const result = await response.json();
      if (result.success && result.journalEntry) {
        setGeneratedEntry(result.journalEntry);
        setContextData(result.context);
        
        // Add to draft with proper formatting
        const newDraft = draftJournal + 
          (draftJournal ? '\n\n---\n\n' : '') +
          `## 🤖 AI Generated Entry - ${new Date().toLocaleDateString()}\n\n` +
          result.journalEntry.content + '\n\n' +
          `*Generated with ${result.journalEntry.metadata?.wordCount || 0} words, mood: ${result.journalEntry.metadata?.mood || 'reflective'}*`;
        
        setDraftJournal(newDraft);
        saveToLocalStorage(newDraft, publishedJournal, journalHistory);
        onJournalUpdate(newDraft, publishedJournal);
      }
    } catch (error) {
      console.error('Failed to generate AI journal:', error);
      alert('Failed to generate journal entry. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate daily summary from messages (legacy function, kept for compatibility)
  const generateDailySummary = () => {
    const today = new Date().toDateString();
    const todayMessages = messages.filter(msg => 
      new Date(msg.timestamp).toDateString() === today
    );

    if (todayMessages.length === 0) return '';

    const userMessages = todayMessages.filter(m => m.type === 'user');
    const agentMessages = todayMessages.filter(m => m.type === 'agent');

    // Extract key topics and themes
    const topics = userMessages.map(msg => {
      const words = msg.content.toLowerCase().split(/\s+/);
      return words.filter(word => word.length > 4 && !['would', 'could', 'should', 'might', 'think', 'about', 'right', 'there', 'where', 'their'].includes(word));
    }).flat();

    const topicCounts = {};
    topics.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    const keyTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    const summary = `## ${today}\n\n` +
      `**Interaction Summary:**\n` +
      `- ${userMessages.length} user messages, ${agentMessages.length} agent responses\n` +
      `- Key topics discussed: ${keyTopics.join(', ')}\n\n` +
      `**Notable Exchanges:**\n${userMessages.slice(0, 3).map((msg, i) => 
        `${i + 1}. User: "${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}"`
      ).join('\n')}\n\n` +
      `**Agent Insights:**\n${agentMessages.slice(-2).map((msg) => 
        `- ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
      ).join('\n')}\n\n`;

    return summary;
  };

  // Update draft journal with daily summary
  const updateDraft = () => {
    const dailySummary = generateDailySummary();
    const updatedDraft = draftJournal + '\n\n' + dailySummary;
    setDraftJournal(updatedDraft);
    saveToLocalStorage(updatedDraft, publishedJournal, journalHistory);
    onJournalUpdate(updatedDraft, publishedJournal);
  };

  // Publish to Arweave (simulated - would need actual Arweave integration)
  const publishToArweave = async () => {
    setIsPublishing(true);
    try {
      // Create journal entry with hash chain
      const journalEntry = {
        timestamp: new Date().toISOString(),
        processId: agentData.agent.processId,
        content: draftJournal,
        previousHash: journalHistory.length > 0 ? journalHistory[journalHistory.length - 1].hash : null,
        messageCount: messages.length
      };

      // Generate hash (simplified - would use proper crypto hash)
      const hash = btoa(JSON.stringify(journalEntry)).substring(0, 16);
      journalEntry.hash = hash;

      // Simulate Arweave upload (would use actual Arweave client)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const txId = `journal_${Date.now()}_${hash}`;
      journalEntry.txId = txId;

      // Update state
      const newHistory = [...journalHistory, journalEntry];
      const newPublished = publishedJournal + '\n\n' + draftJournal;
      
      setJournalHistory(newHistory);
      setPublishedJournal(newPublished);
      setDraftJournal(''); // Clear draft after publishing
      
      saveToLocalStorage('', newPublished, newHistory);
      onJournalUpdate('', newPublished);
      
      console.log('Journal published to Arweave:', txId);
    } catch (error) {
      console.error('Failed to publish journal:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  // Clear all data
  const clearAll = () => {
    if (confirm('Are you sure you want to clear all journal data? This cannot be undone.')) {
      setDraftJournal('');
      setPublishedJournal('');
      setJournalHistory([]);
      setContextData(null);
      setGeneratedEntry(null);
      localStorage.removeItem(`journal_${agentData.agent.processId}`);
      onJournalUpdate('', '');
    }
  };

  if (!agentData?.agent) return null;

  return (
    <div className="journal-manager">
      <button 
        className="journal-toggle"
        onClick={() => setShowJournal(!showJournal)}
      >
        📖 Journal {journalHistory.length > 0 && `(${journalHistory.length})`}
      </button>

      {showJournal && (
        <div className="journal-panel">
          <div className="journal-header">
            <h3>🧠 Agent Memory Journal</h3>
            <span className="process-id">Process: {agentData.agent.processId.slice(0, 8)}...</span>
            <button 
              className="context-toggle"
              onClick={() => setShowContext(!showContext)}
            >
              {showContext ? '🔽' : '▶️'} Context
            </button>
          </div>

          {showContext && contextData && (
            <div className="context-panel">
              <h4>🌟 Agent Context</h4>
              
              {contextData.seed && (
                <div className="context-section">
                  <h5>🌱 Genesis Seed</h5>
                  <div className="context-content">
                    <pre>{JSON.stringify(contextData.seed, null, 2)}</pre>
                  </div>
                </div>
              )}

              {contextData.oracleScrolls && (
                <div className="context-section">
                  <h5>📜 Oracle Scrolls</h5>
                  {Object.entries(contextData.oracleScrolls).map(([name, content]) => (
                    <div key={name} className="scroll-content">
                      <h6>{name}</h6>
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  ))}
                </div>
              )}

              {contextData.recentActivity && (
                <div className="context-section">
                  <h5>⚡ Recent Activity</h5>
                  <div className="activity-stats">
                    <div>Messages: {contextData.recentActivity.messageCount}</div>
                    <div>Interactions: {contextData.recentActivity.interactions}</div>
                    <div>Topics: {contextData.recentActivity.topics.join(', ')}</div>
                    <div>Last Active: {new Date(contextData.recentActivity.lastActiveTime).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="journal-stats">
            <div className="stat">
              <span className="stat-label">Chat Messages</span>
              <span className="stat-value">{messages.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Published Entries</span>
              <span className="stat-value">{journalHistory.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Draft Length</span>
              <span className="stat-value">{draftJournal.length} chars</span>
            </div>
            {generatedEntry && (
              <div className="stat">
                <span className="stat-label">Last Generated</span>
                <span className="stat-value">{generatedEntry.metadata?.wordCount || 0} words</span>
              </div>
            )}
          </div>

          <div className="journal-actions">
            <button 
              onClick={generateAIJournal} 
              disabled={isGenerating}
              className="action-btn ai-generate"
            >
              {isGenerating ? '🤖 Generating...' : '🤖 AI Journal Entry'}
            </button>
            <button onClick={updateDraft} className="action-btn primary">
              ➕ Daily Summary
            </button>
            <button 
              onClick={publishToArweave} 
              disabled={!draftJournal.trim() || isPublishing}
              className="action-btn publish"
            >
              {isPublishing ? '📤 Publishing...' : '🌐 Publish to Arweave'}
            </button>
            <button onClick={clearAll} className="action-btn danger">
              🗑️ Clear All
            </button>
          </div>

          <div className="journal-content">
            <div className="draft-section">
              <h4>📝 Draft Journal</h4>
              <textarea
                value={draftJournal}
                onChange={(e) => {
                  setDraftJournal(e.target.value);
                  saveToLocalStorage(e.target.value, publishedJournal, journalHistory);
                  onJournalUpdate(e.target.value, publishedJournal);
                }}
                placeholder="Your agent's thoughts, experiences, and reflections will appear here. Use the AI Journal Entry button to generate deep, contextual reflections based on the oracle scrolls and recent activity."
                rows={12}
              />
            </div>

            {generatedEntry && (
              <div className="generated-section">
                <h4>🤖 Latest AI Generated Entry</h4>
                <div className="generated-content">
                  <ReactMarkdown>{generatedEntry.content}</ReactMarkdown>
                  {generatedEntry.metadata && (
                    <div className="entry-metadata">
                      <small>
                        Generated: {new Date(generatedEntry.metadata.generatedAt).toLocaleString()} | 
                        Words: {generatedEntry.metadata.wordCount} | 
                        Mood: {generatedEntry.metadata.mood} | 
                        Topics: {generatedEntry.metadata.topics.join(', ')}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            )}

            {publishedJournal && (
              <div className="published-section">
                <h4>🌐 Published Journal (On Arweave)</h4>
                <div className="published-content">
                  <ReactMarkdown>{publishedJournal.substring(0, 1000)}...</ReactMarkdown>
                </div>
              </div>
            )}

            {journalHistory.length > 0 && (
              <div className="history-section">
                <h4>📚 Publication History</h4>
                {journalHistory.slice(-3).map((entry) => (
                  <div key={entry.hash} className="history-entry">
                    <div className="entry-header">
                      <span className="entry-date">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                      <span className="entry-hash">#{entry.hash}</span>
                    </div>
                    <div className="entry-info">
                      TxID: {entry.txId} • {entry.messageCount} messages
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalManager;
