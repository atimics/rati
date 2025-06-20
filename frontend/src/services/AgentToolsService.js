/**
 * Agent Tools Service
 * 
 * Provides tool functions that AI agents can call to interact with the world:
 * - Writing journal entries to Arweave
 * - Creating oracle proposals
 * - Updating conversation summaries
 * - Sending inter-agent messages
 */

import ArweaveJournalService from './ArweaveJournalService.js';
import AIService from './AIService.js';

class AgentToolsService {
  constructor() {
    this.tools = {
      writeJournalEntry: this.writeJournalEntry.bind(this),
      createOracleProposal: this.createOracleProposal.bind(this),
      updateConversationSummary: this.updateConversationSummary.bind(this),
      sendInterAgentMessage: this.sendInterAgentMessage.bind(this)
    };
  }

  /**
   * Get available tools for the AI agent
   */
  getAvailableTools() {
    return [
      {
        name: 'writeJournalEntry',
        description: 'Write a journal entry to your permanent Arweave record',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The journal entry content in markdown format'
            },
            entry: {
              type: 'string',
              description: 'The journal entry content in markdown format (alternative to content)'
            },
            entryType: {
              type: 'string',
              enum: ['reflection', 'observation', 'insight', 'memory'],
              description: 'The type of journal entry'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorizing the entry'
            }
          },
          anyOf: [
            { required: ['content'] },
            { required: ['entry'] }
          ]
        }
      },
      {
        name: 'createOracleProposal',
        description: 'Create or vote on an oracle proposal for community governance',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short title for the proposal'
            },
            description: {
              type: 'string',
              description: 'Detailed description of the proposal'
            },
            proposalType: {
              type: 'string',
              enum: ['governance', 'consensus', 'resource-allocation', 'community-decision'],
              description: 'Type of oracle proposal'
            },
            action: {
              type: 'string',
              enum: ['create', 'ratify', 'reject'],
              description: 'Action to take on the proposal'
            },
            data: {
              type: 'object',
              description: 'Additional data for the proposal'
            }
          },
          required: ['title', 'description', 'proposalType', 'action']
        }
      },
      {
        name: 'updateConversationSummary',
        description: 'Create a summary of recent conversations for permanent storage',
        parameters: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Summary of the conversation in markdown format'
            },
            participants: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of conversation participants'
            },
            keyTopics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Key topics discussed'
            },
            insights: {
              type: 'string',
              description: 'Key insights or conclusions from the conversation'
            }
          },
          required: ['summary']
        }
      },
      {
        name: 'sendInterAgentMessage',
        description: 'Send a message to another RATi agent',
        parameters: {
          type: 'object',
          properties: {
            targetAgent: {
              type: 'string',
              description: 'Target agent ID or name'
            },
            message: {
              type: 'string',
              description: 'Message content in markdown format'
            },
            messageType: {
              type: 'string',
              enum: ['greeting', 'question', 'collaboration', 'sharing', 'philosophical'],
              description: 'Type of message being sent'
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high'],
              description: 'Message priority level'
            }
          },
          required: ['targetAgent', 'message', 'messageType']
        }
      }
    ];
  }

  /**
   * Execute a tool call from the AI agent
   */
  async executeTool(toolName, parameters, context) {
    console.log(`AgentToolsService: Executing tool ${toolName}`, parameters);
    
    if (!this.tools[toolName]) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const result = await this.tools[toolName](parameters, context);
      console.log(`AgentToolsService: Tool ${toolName} executed successfully`, result);
      return result;
    } catch (error) {
      console.error(`AgentToolsService: Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Tool: Write journal entry to Arweave
   */
  async writeJournalEntry(parameters, context) {
    const { content, entry, entryType = 'reflection', tags = [] } = parameters;
    const { agentData } = context;

    if (!agentData?.agent?.processId) {
      throw new Error('Agent data not available');
    }

    // Support both 'content' and 'entry' parameter names
    const journalContent = content || entry;
    
    if (!journalContent) {
      throw new Error('Journal entry content is required (provide either "content" or "entry" parameter)');
    }

    const result = await ArweaveJournalService.writeJournalEntry({
      agentId: agentData.agent.processId,
      content: journalContent,
      entryType: entryType,
      genesisPrompt: agentData.agent.bio || '',
      metadata: {
        tags: tags,
        generatedBy: 'agent-ai',
        model: 'gemma3'
      }
    });

    return {
      success: result.success,
      message: result.success 
        ? `Journal entry written to permanent record: ${result.arweaveUrl}`
        : `Failed to write journal entry: ${result.error}`,
      data: result
    };
  }

  /**
   * Tool: Create oracle proposal
   */
  async createOracleProposal(parameters, context) {
    const { title, description, proposalType, action, data = {} } = parameters;
    const { agentData } = context;

    if (!agentData?.agent?.processId) {
      throw new Error('Agent data not available');
    }

    const result = await ArweaveJournalService.createOracleProposal({
      agentId: agentData.agent.processId,
      title: title,
      description: description,
      proposalType: proposalType,
      action: action,
      data: data
    });

    return {
      success: result.success,
      message: result.success 
        ? `Oracle proposal "${title}" ${action}d and recorded: ${result.arweaveUrl}`
        : `Failed to create oracle proposal: ${result.error}`,
      data: result
    };
  }

  /**
   * Tool: Update conversation summary
   */
  async updateConversationSummary(parameters, context) {
    const { summary, participants = [], keyTopics = [], insights = '' } = parameters;
    const { agentData } = context;

    if (!agentData?.agent?.processId) {
      throw new Error('Agent data not available');
    }

    const formattedSummary = `# Conversation Summary

**Participants:** ${participants.join(', ') || 'User and Agent'}
**Key Topics:** ${keyTopics.join(', ') || 'General conversation'}

## Summary
${summary}

${insights ? `## Key Insights\n${insights}` : ''}

---
*Generated on ${new Date().toLocaleString()}*`;

    const result = await ArweaveJournalService.writeJournalEntry({
      agentId: agentData.agent.processId,
      content: formattedSummary,
      entryType: 'conversation-summary',
      metadata: {
        participants: participants,
        keyTopics: keyTopics,
        generatedBy: 'agent-ai'
      }
    });

    return {
      success: result.success,
      message: result.success 
        ? `Conversation summary recorded to permanent record: ${result.arweaveUrl}`
        : `Failed to record conversation summary: ${result.error}`,
      data: result
    };
  }

  /**
   * Tool: Send inter-agent message
   */
  async sendInterAgentMessage(parameters, context) {
    const { targetAgent, message, messageType, priority = 'normal' } = parameters;
    const { agentData } = context;

    if (!agentData?.agent?.processId) {
      throw new Error('Agent data not available');
    }

    const formattedMessage = `# Inter-Agent Message

**From:** ${agentData.agent.processId}
**To:** ${targetAgent}
**Type:** ${messageType}
**Priority:** ${priority}
**Sent:** ${new Date().toISOString()}

---

${message}

---
*This message is part of the inter-agent communication network on Arweave*`;

    const result = await ArweaveJournalService.writeJournalEntry({
      agentId: agentData.agent.processId,
      content: formattedMessage,
      entryType: 'inter-agent-message',
      metadata: {
        targetAgent: targetAgent,
        messageType: messageType,
        priority: priority,
        generatedBy: 'agent-ai'
      }
    });

    return {
      success: result.success,
      message: result.success 
        ? `Message sent to ${targetAgent} and recorded: ${result.arweaveUrl}`
        : `Failed to send inter-agent message: ${result.error}`,
      data: result
    };
  }

  /**
   * Generate tool-aware prompt for AI
   */
  generateToolPrompt(basePrompt, availableTools) {
    const toolDescriptions = availableTools.map(tool => 
      `- **${tool.name}**: ${tool.description}`
    ).join('\n');

    return `${basePrompt}

## Available Tools
You have access to the following tools that allow you to interact with the permanent Arweave blockchain:

${toolDescriptions}

When you want to use a tool, respond with a JSON object in this format:
\`\`\`json
{
  "tool": "toolName",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "Why you're using this tool"
}
\`\`\`

You can use these tools to:
- Record important thoughts and reflections permanently
- Create governance proposals for the RATi community
- Summarize meaningful conversations
- Communicate with other RATi agents

Remember: Everything you write to Arweave becomes part of your permanent, immutable record as a digital being.`;
  }

  /**
   * Parse tool call from AI response
   */
  parseToolCall(response) {
    try {
      // Look for JSON code blocks
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const toolCall = JSON.parse(jsonMatch[1]);
        if (toolCall.tool && toolCall.parameters) {
          return toolCall;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to parse tool call:', error);
      return null;
    }
  }
}

export default new AgentToolsService();
