/**
 * PayloadBuilder
 * Builds comprehensive AI payload with world state and bot activity context
 * Part of Priority 1 fixes for exposing bot's own recent activity
 */

import { WorldStateManager } from './WorldStateManager.js';
import { FarcasterObserver } from './FarcasterTools.js';

export class PayloadBuilder {
    constructor(agentProcessId, personality, recentMemories, integrationConfigs = {}) {
        this.agentProcessId = agentProcessId;
        this.personality = personality;
        this.recentMemories = recentMemories;
        this.worldStateManager = new WorldStateManager(agentProcessId);
        this.integrationConfigs = integrationConfigs;
    }

    /**
     * Build comprehensive AI payload with all context
     */
    async buildPayload(newMessages) {
        // Get world state data
        const worldState = this.worldStateManager.getAIPayload();
        const botActivityContext = this.worldStateManager.getBotActivityContext();
        
        // Get fresh Farcaster feeds if configured
        let farcasterFeeds = null;
        if (this.integrationConfigs.farcaster?.apiKey) {
            const observer = new FarcasterObserver(
                this.agentProcessId, 
                this.integrationConfigs.farcaster.apiKey
            );
            
            try {
                farcasterFeeds = await observer.getFeeds();
            } catch (error) {
                console.log('⚠️ Failed to fetch Farcaster feeds:', error.message);
            }
        }

        return {
            agent_identity: {
                process_id: this.agentProcessId,
                personality: this.personality,
                current_timestamp: Date.now()
            },
            
            // PRIORITY 1 FIX: Bot's own recent activity context
            bot_activity_context: {
                last_cast: botActivityContext.last_cast,
                last_matrix_message: botActivityContext.last_matrix_message,
                last_action_timestamp: botActivityContext.last_action_timestamp,
                recent_actions_summary: this.summarizeRecentActions(worldState.action_history)
            },

            // PRIORITY 1 FIX: Comprehensive action history
            action_history: worldState.action_history.map(action => ({
                timestamp: action.timestamp,
                action: action.action,
                target: action.target,
                data_preview: action.data?.substring(0, 100),
                status: action.status,
                error: action.error,
                minutes_ago: Math.floor((Date.now() - action.timestamp) / (60 * 1000))
            })),

            memory_context: {
                recent_memories: this.recentMemories.slice(-5),
                memory_count: this.recentMemories.length
            },

            new_messages: newMessages.map(msg => ({
                id: msg.id,
                type: msg.type || 'ao_message',
                from: msg.from,
                action: msg.action,
                data: msg.data,
                timestamp: msg.timestamp,
                platform: this.detectMessagePlatform(msg)
            })),

            // PRIORITY 1 FIX: Social media feeds for context
            social_context: {
                farcaster_feeds: farcasterFeeds ? {
                    home_feed: farcasterFeeds.home_feed.slice(0, 5),
                    for_you_feed: farcasterFeeds.for_you_feed.slice(0, 5),
                    last_updated: Date.now()
                } : null,
                trending_topics: this.extractTrendingTopics(farcasterFeeds)
            },

            // System constraints and guidelines
            system_constraints: {
                max_response_length: 600, // Increased from 200 for longer responses
                available_actions: this.getAvailableActions(),
                cooldown_actions: this.getCooldownActions(),
                recent_content_hashes: worldState.duplicate_prevention?.recent_content_hashes?.length || 0
            }
        };
    }

    /**
     * Summarize recent actions for AI context
     */
    summarizeRecentActions(actionHistory) {
        if (!actionHistory || actionHistory.length === 0) {
            return "No recent actions recorded.";
        }

        const recentActions = actionHistory.slice(-5);
        const actionSummary = recentActions.map(action => {
            const minutesAgo = Math.floor((Date.now() - action.timestamp) / (60 * 1000));
            return `${action.action} (${action.status}) ${minutesAgo}m ago`;
        });

        return actionSummary.join('; ');
    }

    /**
     * Detect which platform a message came from
     */
    detectMessagePlatform(message) {
        if (message.type === 'matrix_message') {
            return 'matrix';
        } else if (message.type === 'farcaster_mention') {
            return 'farcaster';
        } else if (message.from && message.action) {
            return 'ao';
        }
        return 'unknown';
    }

    /**
     * Extract trending topics from social feeds
     */
    extractTrendingTopics(farcasterFeeds) {
        if (!farcasterFeeds) return [];

        const allCasts = [
            ...farcasterFeeds.home_feed,
            ...farcasterFeeds.for_you_feed
        ];

        // Simple keyword extraction (could be enhanced with NLP)
        const keywords = {};
        allCasts.forEach(cast => {
            const words = cast.text?.toLowerCase().match(/\b\w{4,}\b/g) || [];
            words.forEach(word => {
                keywords[word] = (keywords[word] || 0) + 1;
            });
        });

        // Return top trending keywords
        return Object.entries(keywords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word, count]) => ({ word, mentions: count }));
    }

    /**
     * Get available actions based on integrations and cooldowns
     */
    getAvailableActions() {
        const actions = ['SEND_MESSAGE', 'PROPOSE', 'DO_NOTHING'];

        if (this.integrationConfigs.farcaster?.apiKey) {
            if (!this.worldStateManager.isActionInCooldown('send_farcaster_post')) {
                actions.push('SEND_FARCASTER_POST');
            }
            if (!this.worldStateManager.isActionInCooldown('like_farcaster_post')) {
                actions.push('LIKE_FARCASTER_POST');
            }
        }

        if (this.integrationConfigs.matrix?.accessToken) {
            if (!this.worldStateManager.isActionInCooldown('send_matrix_message')) {
                actions.push('SEND_MATRIX_MESSAGE');
            }
            if (!this.worldStateManager.isActionInCooldown('react_to_matrix_message')) {
                actions.push('REACT_TO_MATRIX_MESSAGE');
            }
        }

        return actions;
    }

    /**
     * Get actions currently in cooldown
     */
    getCooldownActions() {
        const cooldowns = [];
        const testActions = [
            'send_farcaster_post',
            'like_farcaster_post', 
            'send_matrix_message',
            'react_to_matrix_message'
        ];

        testActions.forEach(action => {
            if (this.worldStateManager.isActionInCooldown(action)) {
                cooldowns.push(action);
            }
        });

        return cooldowns;
    }

    /**
     * Format the payload for the AI prompt
     */
    formatForPrompt(payload) {
        return `
AGENT CONTEXT:
- Process ID: ${payload.agent_identity.process_id}
- Current Time: ${new Date(payload.agent_identity.current_timestamp).toISOString()}

BOT ACTIVITY CONTEXT (Your Recent Actions):
- Last Farcaster Post: ${payload.bot_activity_context.last_cast ? 
    `"${payload.bot_activity_context.last_cast.content.substring(0, 50)}..." ${Math.floor((Date.now() - payload.bot_activity_context.last_cast.timestamp) / (60 * 1000))}m ago` : 
    'None'}
- Last Matrix Message: ${payload.bot_activity_context.last_matrix_message ? 
    `"${payload.bot_activity_context.last_matrix_message.content.substring(0, 50)}..." ${Math.floor((Date.now() - payload.bot_activity_context.last_matrix_message.timestamp) / (60 * 1000))}m ago` : 
    'None'}
- Recent Actions: ${payload.bot_activity_context.recent_actions_summary}

ACTION HISTORY (Last ${payload.action_history.length} actions):
${payload.action_history.map(action => 
    `- ${action.action} -> ${action.status} (${action.minutes_ago}m ago)${action.error ? ` [${action.error}]` : ''}`
).join('\n')}

NEW MESSAGES (${payload.new_messages.length} total):
${payload.new_messages.map(msg => 
    `- [${msg.platform}] ${msg.from}: ${msg.data?.substring(0, 100) || 'No content'}`
).join('\n')}

MEMORY CONTEXT:
- Recent Memories: ${payload.memory_context.memory_count} total
${payload.memory_context.recent_memories.map(mem => 
    `- Seq ${mem.sequence}: ${mem.decision?.action} (${mem.decision?.RATionale})`
).join('\n')}

SOCIAL CONTEXT:
${payload.social_context.farcaster_feeds ? `
- Farcaster Activity: ${payload.social_context.farcaster_feeds.home_feed.length} home feed items
- Trending: ${payload.social_context.trending_topics.slice(0, 3).map(t => t.word).join(', ')}
` : '- No Farcaster integration active'}

SYSTEM CONSTRAINTS:
- Available Actions: ${payload.system_constraints.available_actions.join(', ')}
- Actions in Cooldown: ${payload.system_constraints.cooldown_actions.join(', ') || 'None'}
- Duplicate Prevention: ${payload.system_constraints.recent_content_hashes} recent content hashes tracked

IMPORTANT GUIDELINES:
1. Review your BOT ACTIVITY CONTEXT before generating new content to avoid repetition
2. Check ACTION HISTORY for any recent failures or rate limiting
3. Do not attempt actions that are in cooldown
4. Keep responses under ${payload.system_constraints.max_response_length} characters unless creating formal summaries
5. Reference your recent activities and memories when making decisions
`;
    }
}
