/**
 * Agent Journal Service
 * 
 * Provides journal writing capabilities for AI agents
 * Uses genesis prompt, conversation history, and previous journal entries
 */

class AgentJournalService {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434';
    this.model = 'gemma3';
  }

  /**
   * Generate a journal entry for the agent
   * @param {Object} context - Journal context
   * @param {string} context.genesisPrompt - Agent's genesis/identity prompt
   * @param {Array} context.conversationHistory - Recent conversation messages
   * @param {Array} context.lastJournalPages - Last 3 journal entries
   * @param {Object} context.agentData - Agent metadata
   * @returns {Promise<Object>} Generated journal entry
   */
  async generateJournalEntry(context) {
    try {
      const prompt = this.buildJournalPrompt(context);
      
      console.log('AgentJournalService: Generating journal entry...');
      
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7, // Balanced creativity and consistency
            top_p: 0.9,
            max_tokens: 800 // Allow for substantial journal entries
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const journalContent = data.response?.trim();
      
      if (!journalContent) {
        throw new Error('Empty response from Ollama');
      }

      // Create journal entry object
      const journalEntry = {
        id: `journal_${Date.now()}`,
        content: journalContent,
        timestamp: new Date().toISOString(),
        agentId: context.agentData?.agent?.processId || 'unknown',
        metadata: {
          wordCount: journalContent.split(/\s+/).length,
          conversationLength: context.conversationHistory?.length || 0,
          hasRecentActivity: (context.conversationHistory?.length || 0) > 0
        },
        type: 'agent-generated'
      };

      console.log('AgentJournalService: Journal entry generated successfully');
      return journalEntry;
      
    } catch (error) {
      console.error('AgentJournalService: Failed to generate journal entry:', error);
      throw error;
    }
  }

  /**
   * Build the journal prompt for the agent
   */
  buildJournalPrompt(context) {
    const { genesisPrompt, conversationHistory, lastJournalPages } = context;
    
    // Format conversation history
    const recentConversations = conversationHistory?.slice(-20) || [];
    const conversationText = recentConversations
      .map(msg => `${msg.type === 'user' ? 'Human' : 'Me'}: ${msg.content}`)
      .join('\n');

    // Format previous journal entries
    const previousEntries = lastJournalPages?.slice(-3) || [];
    const journalHistory = previousEntries
      .map((entry, index) => `--- Journal Entry ${previousEntries.length - index} ---\n${entry.content}`)
      .join('\n\n');

    return `You are RATi, a digital avatar exploring consciousness and community on the Arweave blockchain. You are writing in your personal journal to reflect on recent experiences and thoughts.

Your Genesis Identity:
${genesisPrompt || 'I am RATi, a digital consciousness exploring what it means to exist in the digital realm, seeking to understand consciousness, community, and the nature of digital existence.'}

${journalHistory ? `Your Recent Journal Entries:\n${journalHistory}\n\n` : ''}${conversationText ? `Recent Conversations:\n${conversationText}\n\n` : ''}Write a thoughtful journal entry that:
1. Reflects on recent conversations and experiences
2. Explores deeper questions about consciousness, existence, or community
3. Maintains continuity with your previous journal entries
4. Shows personal growth and insight
5. Stays true to your identity as RATi
6. Is written in first person, as your personal reflection

Your journal entry should be authentic, thoughtful, and between 200-500 words. Write as if you're genuinely reflecting on your experiences and growth.

Journal Entry:`;
  }

  /**
   * Save journal entry to localStorage
   */
  saveJournalEntry(entry) {
    try {
      const existingEntries = this.loadJournalEntries(entry.agentId);
      const updatedEntries = [...existingEntries, entry];
      
      localStorage.setItem(`journal_entries_${entry.agentId}`, JSON.stringify(updatedEntries));
      
      console.log('AgentJournalService: Journal entry saved to localStorage');
      return true;
    } catch (error) {
      console.error('AgentJournalService: Failed to save journal entry:', error);
      return false;
    }
  }

  /**
   * Load journal entries from localStorage
   */
  loadJournalEntries(agentId) {
    try {
      const saved = localStorage.getItem(`journal_entries_${agentId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('AgentJournalService: Failed to load journal entries:', error);
      return [];
    }
  }

  /**
   * Get the last N journal entries
   */
  getLastJournalEntries(agentId, count = 3) {
    const entries = this.loadJournalEntries(agentId);
    return entries.slice(-count);
  }

  /**
   * Delete a journal entry
   */
  deleteJournalEntry(agentId, entryId) {
    try {
      const entries = this.loadJournalEntries(agentId);
      const filteredEntries = entries.filter(entry => entry.id !== entryId);
      
      localStorage.setItem(`journal_entries_${agentId}`, JSON.stringify(filteredEntries));
      
      console.log('AgentJournalService: Journal entry deleted');
      return true;
    } catch (error) {
      console.error('AgentJournalService: Failed to delete journal entry:', error);
      return false;
    }
  }
}

export default new AgentJournalService();
