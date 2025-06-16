import React, { useState, useEffect } from 'react';
import './JournalManager.css';

const JournalManager = ({ agentData, messages, onJournalUpdate }) => {
  const [draftJournal, setDraftJournal] = useState('');
  const [publishedJournal, setPublishedJournal] = useState('');
  const [journalHistory, setJournalHistory] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

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

  // Generate daily summary from messages
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

  // Update draft journal
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
          </div>

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
          </div>

          <div className="journal-actions">
            <button onClick={updateDraft} className="action-btn primary">
              ➕ Add Daily Summary
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
                }}
                placeholder="Write about your experiences, learnings, and thoughts..."
                rows={8}
              />
            </div>

            {publishedJournal && (
              <div className="published-section">
                <h4>🌐 Published Journal (On Arweave)</h4>
                <div className="published-content">
                  <ReactMarkdown>{publishedJournal.substring(0, 500)}...</ReactMarkdown>
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
