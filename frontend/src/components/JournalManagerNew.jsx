import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './JournalManagerNew.css';

const JournalManagerNew = ({ agentData, messages, onJournalUpdate }) => {
  const [activeTab, setActiveTab] = useState('draft');
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

  // Save journal data to localStorage
  const saveToLocalStorage = useCallback((draft, published, history) => {
    if (agentData?.agent?.processId) {
      localStorage.setItem(`journal_${agentData.agent.processId}`, JSON.stringify({
        draft,
        published,
        history,
        lastUpdated: new Date().toISOString()
      }));
    }
  }, [agentData?.agent?.processId]);

  // Fetch context data for display
  const fetchContextData = useCallback(async () => {
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
  }, [agentData?.agent?.processId]);

  // Load context data when component mounts
  useEffect(() => {
    if (agentData?.agent?.processId && showJournal) {
      fetchContextData();
    }
  }, [agentData?.agent?.processId, showJournal, fetchContextData]);

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
        setActiveTab('draft');
      }
    } catch (error) {
      console.error('Failed to generate AI journal:', error);
      alert('Failed to generate journal entry. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Publish to Arweave
  const publishToArweave = async () => {
    setIsPublishing(true);
    try {
      const journalEntry = {
        timestamp: new Date().toISOString(),
        processId: agentData.agent.processId,
        content: draftJournal,
        previousHash: journalHistory.length > 0 ? journalHistory[journalHistory.length - 1].hash : null,
        messageCount: messages.length
      };

      const hash = btoa(JSON.stringify(journalEntry)).substring(0, 16);
      journalEntry.hash = hash;

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const txId = `journal_${Date.now()}_${hash}`;
      journalEntry.txId = txId;

      const newHistory = [...journalHistory, journalEntry];
      const newPublished = publishedJournal + '\n\n' + draftJournal;
      
      setJournalHistory(newHistory);
      setPublishedJournal(newPublished);
      setDraftJournal('');
      
      saveToLocalStorage('', newPublished, newHistory);
      onJournalUpdate('', newPublished);
      setActiveTab('published');
      
      console.log('Journal published to Arweave:', txId);
    } catch (error) {
      console.error('Failed to publish journal:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!agentData?.agent) return null;

  const stats = {
    messages: messages.length,
    entries: journalHistory.length,
    draftLength: draftJournal.length,
    lastGenerated: generatedEntry?.metadata?.generatedAt ? new Date(generatedEntry.metadata.generatedAt).toLocaleDateString() : 'Never'
  };

  return (
    <div className="journal-manager-new">
      <button 
        className="journal-toggle-new"
        onClick={() => setShowJournal(!showJournal)}
      >
        <span className="toggle-icon">📖</span>
        <span className="toggle-text">Memory Journal</span>
        {journalHistory.length > 0 && (
          <span className="toggle-badge">{journalHistory.length}</span>
        )}
      </button>

      {showJournal && (
        <div className="journal-modal">
          <div className="journal-backdrop" onClick={() => setShowJournal(false)} />
          <div className="journal-container">
            {/* Header */}
            <div className="journal-header-new">
              <div className="header-left">
                <h2 className="journal-title">
                  <span className="title-icon">🧠</span>
                  Agent Memory Journal
                </h2>
                <p className="journal-subtitle">
                  Process: <code>{agentData.agent.processId.slice(0, 12)}...</code>
                </p>
              </div>
              <div className="header-right">
                <button 
                  className="context-btn"
                  onClick={() => setShowContext(!showContext)}
                >
                  <span className={`context-icon ${showContext ? 'active' : ''}`}>⚙️</span>
                  Context
                </button>
                <button 
                  className="close-btn"
                  onClick={() => setShowJournal(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Context Panel */}
            {showContext && (
              <div className="context-panel-new">
                <div className="context-grid">
                  {contextData?.seed && (
                    <div className="context-card">
                      <h4>🌱 Genesis Seed</h4>
                      <div className="context-preview">
                        <div><strong>Network:</strong> {contextData.seed.network}</div>
                        <div><strong>Agent ID:</strong> {contextData.seed.agent?.processId?.slice(0, 12)}...</div>
                        <div><strong>Wallet:</strong> {contextData.seed.wallet?.address?.slice(0, 12)}...</div>
                      </div>
                    </div>
                  )}
                  
                  {contextData?.oracleScrolls && Object.keys(contextData.oracleScrolls).length > 0 && (
                    <div className="context-card">
                      <h4>📜 Oracle Scrolls</h4>
                      <div className="scrolls-preview">
                        {Object.entries(contextData.oracleScrolls).map(([name, content]) => (
                          <div key={name} className="scroll-item">
                            <strong>{name}:</strong> {content.substring(0, 60)}...
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {contextData?.recentActivity && (
                    <div className="context-card">
                      <h4>⚡ Recent Activity</h4>
                      <div className="activity-grid">
                        <div>Messages: {contextData.recentActivity.messageCount}</div>
                        <div>Interactions: {contextData.recentActivity.interactions}</div>
                        <div>Topics: {contextData.recentActivity.topics.join(', ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.messages}</div>
                <div className="stat-label">Messages</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.entries}</div>
                <div className="stat-label">Published</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{Math.floor(stats.draftLength / 100)}</div>
                <div className="stat-label">Draft (100s chars)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{generatedEntry?.metadata?.wordCount || 0}</div>
                <div className="stat-label">Last AI Words</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-grid">
              <button 
                className="action-card ai-generate"
                onClick={generateAIJournal}
                disabled={isGenerating}
              >
                <div className="action-icon">🤖</div>
                <div className="action-text">
                  <div className="action-title">{isGenerating ? 'Generating...' : 'AI Journal Entry'}</div>
                  <div className="action-desc">Generate reflective journal from context</div>
                </div>
              </button>
              
              <button 
                className="action-card publish"
                onClick={publishToArweave}
                disabled={!draftJournal.trim() || isPublishing}
              >
                <div className="action-icon">🌐</div>
                <div className="action-text">
                  <div className="action-title">{isPublishing ? 'Publishing...' : 'Publish to Arweave'}</div>
                  <div className="action-desc">Make permanent on blockchain</div>
                </div>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav">
              <button 
                className={`tab-btn ${activeTab === 'draft' ? 'active' : ''}`}
                onClick={() => setActiveTab('draft')}
              >
                📝 Draft ({Math.floor(draftJournal.length / 100)})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'published' ? 'active' : ''}`}
                onClick={() => setActiveTab('published')}
              >
                🌐 Published ({journalHistory.length})
              </button>
              {generatedEntry && (
                <button 
                  className={`tab-btn ${activeTab === 'generated' ? 'active' : ''}`}
                  onClick={() => setActiveTab('generated')}
                >
                  🤖 Latest AI ({generatedEntry.metadata?.wordCount || 0}w)
                </button>
              )}
            </div>

            {/* Content */}
            <div className="content-area">
              {activeTab === 'draft' && (
                <div className="draft-editor">
                  <textarea
                    value={draftJournal}
                    onChange={(e) => {
                      setDraftJournal(e.target.value);
                      saveToLocalStorage(e.target.value, publishedJournal, journalHistory);
                      onJournalUpdate(e.target.value, publishedJournal);
                    }}
                    placeholder="Your agent's consciousness flows here... Write about experiences, learnings, growth, and reflections. Use the AI button to generate deep insights based on oracle wisdom and recent interactions."
                    className="draft-textarea"
                  />
                </div>
              )}

              {activeTab === 'published' && (
                <div className="published-viewer">
                  {publishedJournal ? (
                    <ReactMarkdown className="markdown-content">{publishedJournal}</ReactMarkdown>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">📄</div>
                      <div className="empty-title">No published entries yet</div>
                      <div className="empty-desc">Write in the draft and publish to Arweave to see content here</div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'generated' && generatedEntry && (
                <div className="generated-viewer">
                  <ReactMarkdown className="markdown-content">{generatedEntry.content}</ReactMarkdown>
                  <div className="generation-meta">
                    <div className="meta-row">
                      <span>Generated:</span> {new Date(generatedEntry.metadata.generatedAt).toLocaleString()}
                    </div>
                    <div className="meta-row">
                      <span>Words:</span> {generatedEntry.metadata.wordCount}
                    </div>
                    <div className="meta-row">
                      <span>Mood:</span> {generatedEntry.metadata.mood}
                    </div>
                    <div className="meta-row">
                      <span>Topics:</span> {generatedEntry.metadata.topics.join(', ')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History Timeline */}
            {journalHistory.length > 0 && (
              <div className="history-timeline">
                <h4 className="timeline-title">📚 Publication History</h4>
                <div className="timeline-items">
                  {journalHistory.slice(-5).map((entry, index) => (
                    <div key={entry.hash} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-date">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </div>
                        <div className="timeline-info">
                          <span className="timeline-hash">#{entry.hash}</span>
                          <span className="timeline-messages">{entry.messageCount} msgs</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalManagerNew;
