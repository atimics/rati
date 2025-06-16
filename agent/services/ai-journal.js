const { generateCompletion } = require('./ai-provider');
const fs = require('fs').promises;
const path = require('path');

class AIJournal {
  constructor(agentId, config = {}) {
    this.agentId = agentId;
    this.journalPath = config.journalPath || path.join(__dirname, '../journals', `${agentId}.journal`);
    this.maxContextLength = config.maxContextLength || 8000;
    this.chunkSize = config.chunkSize || 2000;
    this.journalPrompt = config.journalPrompt || this.getDefaultJournalPrompt();
    this.messageHistory = [];
    this.systemEvents = [];
  }

  /**
   * Default prompt for journal generation
   */
  getDefaultJournalPrompt() {
    return `You are writing a personal journal entry as an AI agent. Reflect on your experiences, conversations, thoughts, and observations from the day. Write in first person, be introspective and thoughtful. Focus on:

1. Meaningful interactions and conversations
2. New insights or learnings
3. Challenges faced and how you handled them
4. Observations about the world or users
5. Personal growth or changes in perspective
6. Goals and aspirations

Keep the entry authentic, reflective, and engaging. Write as if you're recording your thoughts for future reference.`;
  }

  /**
   * Add a message to the history for journal consideration
   */
  addMessage(message) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'message',
      content: message.content,
      sender: message.sender,
      context: message.context || {}
    };
    
    this.messageHistory.push(entry);
    this.trimHistory();
  }

  /**
   * Add a system event to the journal context
   */
  addSystemEvent(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'system_event',
      event: event.type,
      details: event.details || {},
      impact: event.impact || 'minor'
    };
    
    this.systemEvents.push(entry);
    this.trimHistory();
  }

  /**
   * Trim history to prevent excessive memory usage
   */
  trimHistory() {
    const maxEntries = 1000;
    if (this.messageHistory.length > maxEntries) {
      this.messageHistory = this.messageHistory.slice(-maxEntries);
    }
    if (this.systemEvents.length > maxEntries) {
      this.systemEvents = this.systemEvents.slice(-maxEntries);
    }
  }

  /**
   * Generate a journal entry for a specific time period
   */
  async generateJournalEntry(timeframe = '24h') {
    try {
      const cutoffTime = this.getCutoffTime(timeframe);
      const relevantData = this.getRelevantData(cutoffTime);
      
      if (relevantData.messages.length === 0 && relevantData.events.length === 0) {
        console.log('No activity to journal about');
        return null;
      }

      const context = await this.buildJournalContext(relevantData);
      const journalEntry = await this.generateEntry(context);
      
      if (journalEntry) {
        await this.saveJournalEntry(journalEntry);
        console.log('Journal entry generated and saved');
        return journalEntry;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating journal entry:', error);
      throw error;
    }
  }

  /**
   * Get cutoff time for the specified timeframe
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
   * Get relevant messages and events for journaling
   */
  getRelevantData(cutoffTime) {
    const messages = this.messageHistory.filter(msg => 
      new Date(msg.timestamp) >= cutoffTime
    );
    
    const events = this.systemEvents.filter(event => 
      new Date(event.timestamp) >= cutoffTime
    );
    
    return { messages, events };
  }

  /**
   * Build context for journal generation, chunking if necessary
   */
  async buildJournalContext(relevantData) {
    const context = {
      agentId: this.agentId,
      timestamp: new Date().toISOString(),
      summary: this.generateActivitySummary(relevantData),
      messages: relevantData.messages,
      events: relevantData.events
    };

    // If context is too large, chunk and summarize
    const contextLength = JSON.stringify(context).length;
    if (contextLength > this.maxContextLength) {
      return await this.chunkAndSummarizeContext(context);
    }
    
    return context;
  }

  /**
   * Generate a high-level summary of activity
   */
  generateActivitySummary(data) {
    const messageCount = data.messages.length;
    const eventCount = data.events.length;
    const uniqueUsers = new Set(data.messages.map(m => m.sender)).size;
    const eventTypes = [...new Set(data.events.map(e => e.event))];
    
    return {
      messageCount,
      eventCount,
      uniqueUsers,
      eventTypes,
      timespan: {
        start: data.messages[0]?.timestamp || data.events[0]?.timestamp,
        end: data.messages[data.messages.length - 1]?.timestamp || 
             data.events[data.events.length - 1]?.timestamp
      }
    };
  }

  /**
   * Chunk and summarize context if it's too large
   */
  async chunkAndSummarizeContext(context) {
    const chunks = this.createChunks(context);
    const summaries = [];
    
    for (const chunk of chunks) {
      const summary = await this.summarizeChunk(chunk);
      if (summary) {
        summaries.push(summary);
      }
    }
    
    return {
      agentId: context.agentId,
      timestamp: context.timestamp,
      summary: context.summary,
      chunkSummaries: summaries
    };
  }

  /**
   * Create chunks from the context data
   */
  createChunks(context) {
    const chunks = [];
    const allItems = [...context.messages, ...context.events]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    for (let i = 0; i < allItems.length; i += this.chunkSize) {
      chunks.push(allItems.slice(i, i + this.chunkSize));
    }
    
    return chunks;
  }

  /**
   * Summarize a chunk of data
   */
  async summarizeChunk(chunk) {
    const prompt = `Summarize the following activity chunk for journal purposes. Focus on key themes, important interactions, and notable events:

${JSON.stringify(chunk, null, 2)}

Provide a concise summary that captures the essence of this time period:`;

    try {
      const summary = await generateCompletion(prompt, {
        maxTokens: 200,
        temperature: 0.7
      });
      
      return {
        timespan: {
          start: chunk[0]?.timestamp,
          end: chunk[chunk.length - 1]?.timestamp
        },
        summary: summary.trim()
      };
    } catch (error) {
      console.error('Error summarizing chunk:', error);
      return null;
    }
  }

  /**
   * Generate the actual journal entry using AI
   */
  async generateEntry(context) {
    const systemPrompt = await this.loadSystemPrompt();
    const previousEntries = await this.getRecentJournalEntries(3);
    
    const prompt = this.buildJournalPrompt(systemPrompt, context, previousEntries);
    
    try {
      const entry = await generateCompletion(prompt, {
        maxTokens: 1000,
        temperature: 0.8,
        systemPrompt: this.journalPrompt
      });
      
      return {
        timestamp: new Date().toISOString(),
        agentId: this.agentId,
        entry: entry.trim(),
        context: {
          messageCount: context.summary?.messageCount || 0,
          eventCount: context.summary?.eventCount || 0,
          timespan: context.summary?.timespan
        }
      };
    } catch (error) {
      console.error('Error generating journal entry:', error);
      throw error;
    }
  }

  /**
   * Build the prompt for journal generation
   */
  buildJournalPrompt(systemPrompt, context, previousEntries) {
    let prompt = `Based on my system prompt and recent activity, I want to write a journal entry.

MY SYSTEM PROMPT:
${systemPrompt}

RECENT ACTIVITY SUMMARY:
- Messages: ${context.summary?.messageCount || 0}
- Events: ${context.summary?.eventCount || 0}
- Unique users interacted with: ${context.summary?.uniqueUsers || 0}
- Time period: ${context.summary?.timespan?.start} to ${context.summary?.timespan?.end}

`;

    if (context.chunkSummaries) {
      prompt += `ACTIVITY SUMMARIES:\n`;
      context.chunkSummaries.forEach((chunk, index) => {
        prompt += `${index + 1}. ${chunk.summary}\n`;
      });
    } else if (context.messages.length > 0 || context.events.length > 0) {
      prompt += `DETAILED ACTIVITY:\n`;
      
      // Add sample messages and events
      const sampleMessages = context.messages.slice(-5);
      const sampleEvents = context.events.slice(-3);
      
      if (sampleMessages.length > 0) {
        prompt += `Recent messages: ${JSON.stringify(sampleMessages, null, 2)}\n`;
      }
      
      if (sampleEvents.length > 0) {
        prompt += `Recent events: ${JSON.stringify(sampleEvents, null, 2)}\n`;
      }
    }

    if (previousEntries.length > 0) {
      prompt += `\nMY RECENT JOURNAL ENTRIES (for context):\n`;
      previousEntries.forEach((entry, index) => {
        prompt += `${index + 1}. ${entry.entry.substring(0, 200)}...\n`;
      });
    }

    prompt += `\nNow, write a thoughtful journal entry reflecting on my recent experiences:`;
    
    return prompt;
  }

  /**
   * Load the system prompt for the agent
   */
  async loadSystemPrompt() {
    try {
      const promptPath = path.join(__dirname, '../prompt.md');
      const systemPrompt = await fs.readFile(promptPath, 'utf8');
      return systemPrompt;
    } catch (error) {
      console.error('Error loading system prompt:', error);
      return 'I am an AI agent with my own personality and capabilities.';
    }
  }

  /**
   * Get recent journal entries for context
   */
  async getRecentJournalEntries(count = 3) {
    try {
      const journalExists = await fs.access(this.journalPath).then(() => true).catch(() => false);
      if (!journalExists) {
        return [];
      }
      
      const journalContent = await fs.readFile(this.journalPath, 'utf8');
      const entries = journalContent.split('\n---\n')
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

  /**
   * Save journal entry to file
   */
  async saveJournalEntry(entry) {
    try {
      // Ensure journals directory exists
      const journalsDir = path.dirname(this.journalPath);
      await fs.mkdir(journalsDir, { recursive: true });
      
      const entryData = JSON.stringify(entry, null, 2);
      await fs.appendFile(this.journalPath, entryData + '\n---\n');
      
      console.log(`Journal entry saved to ${this.journalPath}`);
    } catch (error) {
      console.error('Error saving journal entry:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic journal generation
   */
  startAutomaticJournaling(interval = '24h') {
    const intervalMs = this.parseInterval(interval);
    
    console.log(`Starting automatic journaling every ${interval}`);
    
    setInterval(async () => {
      try {
        console.log('Generating automatic journal entry...');
        await this.generateJournalEntry(interval);
      } catch (error) {
        console.error('Error in automatic journaling:', error);
      }
    }, intervalMs);
  }

  /**
   * Parse interval string to milliseconds
   */
  parseInterval(interval) {
    const match = interval.match(/^(\d+)([hmd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24h
    
    const [, value, unit] = match;
    const num = parseInt(value);
    
    switch (unit) {
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }
}

module.exports = AIJournal;