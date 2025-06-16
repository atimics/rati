import React, { useState, useEffect } from 'react';
import './JournalViewer.css';

const JournalViewer = ({ agentId }) => {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (agentId) {
      fetchJournalEntries();
      fetchJournalStats();
    }
  }, [agentId]);

  const fetchJournalEntries = async (limit = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/journal/${agentId}/entries?limit=${limit}`);
      const data = await response.json();
      
      if (data.success) {
        setEntries(data.entries);
      } else {
        setError(data.error || 'Failed to fetch journal entries');
      }
    } catch (err) {
      setError('Network error while fetching journal entries');
      console.error('Error fetching journal entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJournalStats = async () => {
    try {
      const response = await fetch(`/api/journal/${agentId}/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching journal stats:', err);
    }
  };

  const generateJournalEntry = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/journal/${agentId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timeframe: selectedTimeframe }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh entries after generation
        setTimeout(() => {
          fetchJournalEntries();
          fetchJournalStats();
        }, 2000); // Give time for entry to be generated
      } else {
        setError(data.error || 'Failed to generate journal entry');
      }
    } catch (err) {
      setError('Network error while generating journal entry');
      console.error('Error generating journal entry:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportJournal = async (format = 'json') => {
    try {
      const response = await fetch(`/api/journal/${agentId}/export?format=${format}`);
      
      if (format === 'json') {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-${agentId}-journal.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-${agentId}-journal.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Failed to export journal');
      console.error('Error exporting journal:', err);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatEntryPreview = (entry, maxLength = 200) => {
    if (entry.length <= maxLength) return entry;
    return entry.substring(0, maxLength) + '...';
  };

  if (!agentId) {
    return (
      <div className="journal-viewer">
        <div className="no-agent">
          <p>Select an agent to view their journal entries</p>
        </div>
      </div>
    );
  }

  return (
    <div className="journal-viewer">
      <div className="journal-header">
        <h2>Agent Journal: {agentId}</h2>
        
        {stats && (
          <div className="journal-stats">
            <div className="stat-item">
              <span className="stat-label">Total Entries:</span>
              <span className="stat-value">{stats.totalEntries}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">This Week:</span>
              <span className="stat-value">{stats.entriesThisWeek}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg Length:</span>
              <span className="stat-value">{stats.averageEntryLength} chars</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Messages Processed:</span>
              <span className="stat-value">{stats.activityMetrics?.messagesProcessed || 0}</span>
            </div>
          </div>
        )}
      </div>

      <div className="journal-controls">
        <div className="generate-section">
          <select 
            value={selectedTimeframe} 
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            disabled={isGenerating}
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="12h">Last 12 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          
          <button 
            onClick={generateJournalEntry}
            disabled={isGenerating}
            className="generate-btn"
          >
            {isGenerating ? 'Generating...' : 'Generate Entry'}
          </button>
        </div>

        <div className="export-section">
          <button onClick={() => exportJournal('json')} className="export-btn">
            Export JSON
          </button>
          <button onClick={() => exportJournal('text')} className="export-btn">
            Export Text
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="journal-entries">
        {loading ? (
          <div className="loading">Loading journal entries...</div>
        ) : entries.length === 0 ? (
          <div className="no-entries">
            <p>No journal entries found. Generate your first entry!</p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <div key={index} className="journal-entry">
              <div className="entry-header">
                <span className="entry-timestamp">
                  {formatTimestamp(entry.timestamp)}
                </span>
                {entry.context && (
                  <div className="entry-context">
                    <span className="context-item">
                      Messages: {entry.context.messageCount || 0}
                    </span>
                    <span className="context-item">
                      Events: {entry.context.eventCount || 0}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="entry-content">
                <p>{formatEntryPreview(entry.entry)}</p>
                
                {entry.entry.length > 200 && (
                  <button 
                    className="expand-btn"
                    onClick={() => {
                      // Toggle full entry display
                      const entryEl = document.querySelector(`.entry-content p`);
                      if (entryEl.textContent.endsWith('...')) {
                        entryEl.textContent = entry.entry;
                      } else {
                        entryEl.textContent = formatEntryPreview(entry.entry);
                      }
                    }}
                  >
                    Read More
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="journal-pagination">
        <button 
          onClick={() => fetchJournalEntries(entries.length + 10)}
          disabled={loading}
          className="load-more-btn"
        >
          Load More Entries
        </button>
      </div>
    </div>
  );
};

export default JournalViewer;