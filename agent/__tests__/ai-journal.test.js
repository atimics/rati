const AIJournal = require('../services/ai-journal');
const fs = require('fs').promises;
const path = require('path');

// Mock the AI provider
jest.mock('../ai-provider', () => ({
  generateCompletion: jest.fn()
}));

describe('AIJournal', () => {
  let journal;
  const testAgentId = 'test-agent-123';
  const testJournalPath = path.join(__dirname, '../test-journals', `${testAgentId}.journal`);

  beforeEach(() => {
    journal = new AIJournal(testAgentId, {
      journalPath: testJournalPath,
      maxContextLength: 1000
    });
    
    // Clear any existing test journal
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(testJournalPath);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  describe('Message and Event Tracking', () => {
    it('should add messages to history', () => {
      const message = {
        content: 'Hello, how are you?',
        sender: 'user123',
        context: { sessionId: 'session1' }
      };

      journal.addMessage(message);

      expect(journal.messageHistory).toHaveLength(1);
      expect(journal.messageHistory[0]).toMatchObject({
        type: 'message',
        content: message.content,
        sender: message.sender,
        context: message.context
      });
      expect(journal.messageHistory[0]).toHaveProperty('timestamp');
    });

    it('should add system events to history', () => {
      const event = {
        type: 'deployment_complete',
        details: { processId: 'proc123' },
        impact: 'major'
      };

      journal.addSystemEvent(event);

      expect(journal.systemEvents).toHaveLength(1);
      expect(journal.systemEvents[0]).toMatchObject({
        type: 'system_event',
        event: event.type,
        details: event.details,
        impact: event.impact
      });
      expect(journal.systemEvents[0]).toHaveProperty('timestamp');
    });

    it('should trim history when it gets too long', () => {
      // Add many messages to trigger trimming
      for (let i = 0; i < 1005; i++) {
        journal.addMessage({
          content: `Message ${i}`,
          sender: `user${i}`,
          context: {}
        });
      }

      expect(journal.messageHistory.length).toBe(1000);
    });
  });

  describe('Context Building', () => {
    beforeEach(() => {
      // Add some test data
      journal.addMessage({
        content: 'First message',
        sender: 'user1',
        context: {}
      });
      
      journal.addMessage({
        content: 'Second message',
        sender: 'user2',
        context: {}
      });

      journal.addSystemEvent({
        type: 'test_event',
        details: { test: true },
        impact: 'minor'
      });
    });

    it('should get relevant data for timeframe', () => {
      const cutoffTime = new Date(Date.now() - 1000); // 1 second ago
      const relevantData = journal.getRelevantData(cutoffTime);

      expect(relevantData.messages).toHaveLength(2);
      expect(relevantData.events).toHaveLength(1);
    });

    it('should generate activity summary', () => {
      const relevantData = {
        messages: journal.messageHistory,
        events: journal.systemEvents
      };

      const summary = journal.generateActivitySummary(relevantData);

      expect(summary).toMatchObject({
        messageCount: 2,
        eventCount: 1,
        uniqueUsers: 2,
        eventTypes: ['test_event']
      });
      expect(summary.timespan).toHaveProperty('start');
      expect(summary.timespan).toHaveProperty('end');
    });
  });

  describe('Journal Generation', () => {
    beforeEach(() => {
      const { generateCompletion } = require('../ai-provider');
      generateCompletion.mockResolvedValue('This is a test journal entry reflecting on my recent experiences...');
    });

    it('should generate journal entry with activity', async () => {
      // Add some activity
      journal.addMessage({
        content: 'Test message',
        sender: 'user1',
        context: {}
      });

      journal.addSystemEvent({
        type: 'test_event',
        details: {},
        impact: 'minor'
      });

      const entry = await journal.generateJournalEntry('1h');

      expect(entry).toBeTruthy();
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('agentId', testAgentId);
      expect(entry).toHaveProperty('entry');
      expect(entry.entry).toContain('test journal entry');
    });

    it('should return null when no activity to journal about', async () => {
      // No messages or events added
      const entry = await journal.generateJournalEntry('1h');
      expect(entry).toBeNull();
    });

    it('should handle AI generation errors gracefully', async () => {
      const { generateCompletion } = require('../ai-provider');
      generateCompletion.mockRejectedValue(new Error('AI service unavailable'));

      journal.addMessage({
        content: 'Test message',
        sender: 'user1',
        context: {}
      });

      await expect(journal.generateJournalEntry('1h')).rejects.toThrow('AI service unavailable');
    });
  });

  describe('Journal Persistence', () => {
    it('should save journal entry to file', async () => {
      const entry = {
        timestamp: new Date().toISOString(),
        agentId: testAgentId,
        entry: 'Test journal entry content',
        context: {
          messageCount: 5,
          eventCount: 2
        }
      };

      await journal.saveJournalEntry(entry);

      const fileExists = await fs.access(testJournalPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(testJournalPath, 'utf8');
      expect(fileContent).toContain(entry.entry);
      expect(fileContent).toContain(testAgentId);
    });

    it('should read recent journal entries', async () => {
      // Save a test entry first
      const entry = {
        timestamp: new Date().toISOString(),
        agentId: testAgentId,
        entry: 'Test journal entry for reading',
        context: {}
      };

      await journal.saveJournalEntry(entry);

      const entries = await journal.getRecentJournalEntries(1);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(entry);
    });
  });

  describe('Utility Functions', () => {
    it('should parse intervals correctly', () => {
      expect(journal.parseInterval('30m')).toBe(30 * 60 * 1000);
      expect(journal.parseInterval('2h')).toBe(2 * 60 * 60 * 1000);
      expect(journal.parseInterval('1d')).toBe(24 * 60 * 60 * 1000);
      expect(journal.parseInterval('invalid')).toBe(24 * 60 * 60 * 1000); // default
    });

    it('should get correct cutoff times', () => {
      const now = new Date();
      const cutoff1h = journal.getCutoffTime('1h');
      const cutoff24h = journal.getCutoffTime('24h');

      expect(cutoff1h.getTime()).toBeLessThan(now.getTime());
      expect(cutoff24h.getTime()).toBeLessThan(cutoff1h.getTime());
    });
  });
});