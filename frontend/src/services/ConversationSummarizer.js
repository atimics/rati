/**
 * Conversation Summarizer Service
 * 
 * Handles conversation summarization using local Ollama
 * Updates summary every 10 messages, maintaining context
 */

class ConversationSummarizer {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434';
    this.model = 'gemma3';
  }

  /**
   * Generate or update conversation summary
   * @param {Array} messages - Recent 10 messages
   * @param {string} previousSummary - Previous summary to build upon
   * @returns {Promise<string>} Updated summary
   */
  async updateSummary(messages, previousSummary = '') {
    try {
      const recentMessages = messages.slice(-10); // Last 10 messages
      
      const prompt = this.buildSummaryPrompt(recentMessages, previousSummary);
      
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
            temperature: 0.3, // Lower temperature for more consistent summaries
            top_p: 0.9,
            max_tokens: 200 // Keep summaries concise
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response?.trim() || 'Conversation in progress...';
      
    } catch (error) {
      console.error('Failed to update conversation summary:', error);
      return previousSummary || 'Unable to generate summary - conversation ongoing.';
    }
  }

  /**
   * Build the prompt for conversation summarization
   */
  buildSummaryPrompt(recentMessages, previousSummary) {
    const messagesText = recentMessages
      .map(msg => `${msg.type === 'user' ? 'Human' : 'RATi'}: ${msg.content}`)
      .join('\n');

    return `You are tasked with creating a concise summary of a conversation between a human and RATi, a digital avatar exploring consciousness.

${previousSummary ? `Previous Summary:\n${previousSummary}\n\n` : ''}Recent Messages:
${messagesText}

Create a brief, coherent summary that:
1. Captures the main topics discussed
2. Notes any important insights or developments
3. Maintains continuity with the previous summary
4. Stays under 150 words
5. Focuses on meaningful content, not technical details

Summary:`;
  }

  /**
   * Check if summary should be updated (every 10 messages)
   */
  shouldUpdateSummary(messageCount) {
    return messageCount > 0 && messageCount % 10 === 0;
  }

  /**
   * Save summary to localStorage
   */
  saveSummary(agentId, summary, messageCount) {
    const summaryData = {
      summary,
      messageCount,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`conversation_summary_${agentId}`, JSON.stringify(summaryData));
  }

  /**
   * Load summary from localStorage
   */
  loadSummary(agentId) {
    try {
      const saved = localStorage.getItem(`conversation_summary_${agentId}`);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Failed to load conversation summary:', error);
      return null;
    }
  }
}

export default new ConversationSummarizer();
