const fs = require('fs').promises;
const path = require('path');

class SimpleJournal {
  constructor(agentId, config = {}) {
    this.agentId = agentId;
    this.journalPath = config.journalPath || path.join(__dirname, '../journals', `${agentId}.journal`);
    this.messageHistory = [];
    this.systemEvents = [];
    this.maxHistory = 1000;
  }

  addMessage(message) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'message',
      content: message.content,
      sender: message.sender,
      context: message.context || {}
    };
    
    this.messageHistory.push(entry);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistory);
    }
  }

  addSystemEvent(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'system_event',
      event: event.type,
      details: event.details || {},
      impact: event.impact || 'minor'
    };
    
    this.systemEvents.push(entry);
    if (this.systemEvents.length > this.maxHistory) {
      this.systemEvents = this.systemEvents.slice(-this.maxHistory);
    }
  }

  async saveJournalEntry(entry) {
    try {
      const journalsDir = path.dirname(this.journalPath);
      await fs.mkdir(journalsDir, { recursive: true });
      
      const entryData = JSON.stringify(entry, null, 2);
      await fs.appendFile(this.journalPath, entryData + '\n---\n');
      
      console.log(`Journal entry saved for agent ${this.agentId}`);
    } catch (error) {
      console.error('Error saving journal entry:', error);
    }
  }

  async getRecentEntries(count = 5) {
    try {
      const exists = await fs.access(this.journalPath).then(() => true).catch(() => false);
      if (!exists) return [];
      
      const content = await fs.readFile(this.journalPath, 'utf8');
      const entries = content.split('\n---\n')
        .filter(entry => entry.trim())
        .map(entry => {
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null)
        .slice(-count);
      
      return entries;
    } catch (error) {
      console.error('Error reading journal entries:', error);
      return [];
    }
  }

  getActivitySummary() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentMessages = this.messageHistory.filter(
      msg => new Date(msg.timestamp) > dayAgo
    );
    
    const recentEvents = this.systemEvents.filter(
      event => new Date(event.timestamp) > dayAgo
    );

    return {
      messageCount: recentMessages.length,
      eventCount: recentEvents.length,
      uniqueUsers: new Set(recentMessages.map(m => m.sender)).size,
      lastActivity: this.messageHistory.length > 0 ? 
        this.messageHistory[this.messageHistory.length - 1].timestamp : null
    };
  }
}

module.exports = SimpleJournal;