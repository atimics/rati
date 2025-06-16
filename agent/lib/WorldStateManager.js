/**
 * WorldStateManager
 * Manages the agent's understanding of the world state and action history
 * Part of Priority 1 fixes for the repetitive action bug
 */

import fs from 'fs';
import path from 'path';

export class WorldStateManager {
    constructor(agentProcessId) {
        this.agentProcessId = agentProcessId;
        this.statePath = path.join(process.cwd(), 'data', `world-state-${agentProcessId}.json`);
        this.actionHistoryLength = parseInt(process.env.AI_ACTION_HISTORY_LENGTH || '20'); // Increased from 2
        this.initializeState();
    }

    initializeState() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.statePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Initialize state if it doesn't exist
        if (!fs.existsSync(this.statePath)) {
            this.saveState({
                action_history: [],
                bot_activity_context: {
                    last_cast: null,
                    last_matrix_message: null,
                    last_action_timestamp: null
                },
                farcaster_feeds: {
                    home_feed: [],
                    for_you_feed: [],
                    last_cache_update: null
                },
                processed_messages: new Set(),
                duplicate_prevention: {
                    recent_content_hashes: [],
                    cooldown_actions: new Map()
                }
            });
        }
    }

    loadState() {
        try {
            const data = fs.readFileSync(this.statePath, 'utf-8');
            const state = JSON.parse(data);
            
            // Convert serialized Set and Map back to proper objects
            if (state.processed_messages && Array.isArray(state.processed_messages)) {
                state.processed_messages = new Set(state.processed_messages);
            } else {
                state.processed_messages = new Set();
            }
            
            if (state.duplicate_prevention?.cooldown_actions && Array.isArray(state.duplicate_prevention.cooldown_actions)) {
                state.duplicate_prevention.cooldown_actions = new Map(state.duplicate_prevention.cooldown_actions);
            } else if (!state.duplicate_prevention) {
                state.duplicate_prevention = {
                    recent_content_hashes: [],
                    cooldown_actions: new Map()
                };
            }
            
            return state;
        } catch (error) {
            console.error('Error loading world state:', error.message);
            this.initializeState();
            return this.loadState();
        }
    }

    saveState(state) {
        try {
            // Convert Set and Map to serializable formats
            const serializableState = {
                ...state,
                processed_messages: Array.from(state.processed_messages || []),
                duplicate_prevention: {
                    ...state.duplicate_prevention,
                    cooldown_actions: Array.from(state.duplicate_prevention?.cooldown_actions || [])
                }
            };
            
            fs.writeFileSync(this.statePath, JSON.stringify(serializableState, null, 2));
        } catch (error) {
            console.error('Error saving world state:', error.message);
        }
    }

    /**
     * Add action result to history with comprehensive tracking
     * This is the core fix for the repetitive action bug
     */
    add_action_result(action, target, data, result, status = 'success', error = null) {
        const state = this.loadState();
        
        const actionEntry = {
            timestamp: Date.now(),
            action,
            target,
            data: data?.substring(0, 200) || null, // Truncate for storage
            result,
            status, // success, failure:rate_limited, failure:duplicate_check, failure:api_error
            error: error?.message || null,
            sequence: state.action_history.length + 1
        };

        // Add to action history
        state.action_history.push(actionEntry);
        
        // Maintain history length limit
        if (state.action_history.length > this.actionHistoryLength) {
            state.action_history.shift();
        }

        // Update bot activity context for successful actions
        if (status === 'success') {
            if (action === 'send_farcaster_post') {
                state.bot_activity_context.last_cast = {
                    content: data,
                    timestamp: Date.now(),
                    target,
                    result
                };
            } else if (action === 'send_matrix_message') {
                state.bot_activity_context.last_matrix_message = {
                    content: data,
                    timestamp: Date.now(),
                    target,
                    result
                };
            }
            
            state.bot_activity_context.last_action_timestamp = Date.now();
        }

        // Add to cooldown if rate limited
        if (status === 'failure:rate_limited') {
            const cooldownKey = `${action}_${target || 'global'}`;
            const cooldownUntil = Date.now() + (15 * 60 * 1000); // 15 minutes
            state.duplicate_prevention.cooldown_actions.set(cooldownKey, cooldownUntil);
        }

        this.saveState(state);
        console.log(`📝 Action recorded: ${action} -> ${status}`);
        
        return actionEntry;
    }

    /**
     * Check if action is in cooldown (for rate limiting prevention)
     */
    isActionInCooldown(action, target = null) {
        const state = this.loadState();
        const cooldownKey = `${action}_${target || 'global'}`;
        const cooldownUntil = state.duplicate_prevention.cooldown_actions.get(cooldownKey);
        
        if (cooldownUntil && Date.now() < cooldownUntil) {
            const remainingMinutes = Math.ceil((cooldownUntil - Date.now()) / (60 * 1000));
            console.log(`⏰ Action ${action} in cooldown for ${remainingMinutes} more minutes`);
            return true;
        }
        
        // Clean up expired cooldowns
        if (cooldownUntil && Date.now() >= cooldownUntil) {
            state.duplicate_prevention.cooldown_actions.delete(cooldownKey);
            this.saveState(state);
        }
        
        return false;
    }

    /**
     * Check for duplicate content to prevent repetitive posts
     */
    isDuplicateContent(content) {
        const state = this.loadState();
        const contentHash = this.generateContentHash(content);
        
        // Check against recent content hashes
        if (state.duplicate_prevention.recent_content_hashes.includes(contentHash)) {
            console.log('🔄 Duplicate content detected, skipping action');
            return true;
        }
        
        // Add to recent content hashes
        state.duplicate_prevention.recent_content_hashes.push(contentHash);
        
        // Maintain a reasonable limit (last 50 pieces of content)
        if (state.duplicate_prevention.recent_content_hashes.length > 50) {
            state.duplicate_prevention.recent_content_hashes.shift();
        }
        
        this.saveState(state);
        return false;
    }

    /**
     * Generate a simple hash for content deduplication
     */
    generateContentHash(content) {
        let hash = 0;
        const str = content.toLowerCase().replace(/\s+/g, '').trim();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Get recent action history for AI context
     */
    getRecentActionHistory(limit = 10) {
        const state = this.loadState();
        return state.action_history.slice(-limit);
    }

    /**
     * Get bot activity context for AI prompt
     */
    getBotActivityContext() {
        const state = this.loadState();
        return state.bot_activity_context;
    }

    /**
     * Update Farcaster feeds cache
     */
    updateFarcasterFeeds(homeFeed, forYouFeed) {
        const state = this.loadState();
        state.farcaster_feeds = {
            home_feed: homeFeed || [],
            for_you_feed: forYouFeed || [],
            last_cache_update: Date.now()
        };
        this.saveState(state);
    }

    /**
     * Get cached Farcaster feeds
     */
    getFarcasterFeeds() {
        const state = this.loadState();
        const cacheAge = Date.now() - (state.farcaster_feeds.last_cache_update || 0);
        const isStale = cacheAge > (3 * 60 * 1000); // 3 minutes TTL
        
        return {
            ...state.farcaster_feeds,
            isStale
        };
    }

    /**
     * Check if a cast has been liked
     */
    hasLikedCast(castHash) {
        const state = this.loadState();
        return state.action_history.some(action => 
            action.action === 'like_farcaster_post' && 
            action.target === castHash && 
            action.status === 'success'
        );
    }

    /**
     * Check if a Matrix message has been reacted to
     */
    hasReactedToMessage(eventId) {
        const state = this.loadState();
        return state.action_history.some(action => 
            action.action === 'react_to_matrix_message' && 
            action.target === eventId && 
            action.status === 'success'
        );
    }

    /**
     * Mark message as processed
     */
    markMessageProcessed(messageId) {
        const state = this.loadState();
        state.processed_messages.add(messageId);
        
        // Prevent memory bloat by limiting processed messages
        if (state.processed_messages.size > 1000) {
            const messageArray = Array.from(state.processed_messages);
            state.processed_messages = new Set(messageArray.slice(-800));
        }
        
        this.saveState(state);
    }

    /**
     * Check if message has been processed
     */
    isMessageProcessed(messageId) {
        const state = this.loadState();
        return state.processed_messages.has(messageId);
    }

    /**
     * Get comprehensive state for AI payload
     */
    getAIPayload() {
        const recentActions = this.getRecentActionHistory();
        const botContext = this.getBotActivityContext();
        const farcasterFeeds = this.getFarcasterFeeds();
        
        return {
            action_history: recentActions,
            bot_activity_context: botContext,
            farcaster_feeds: farcasterFeeds.isStale ? null : {
                home_feed: farcasterFeeds.home_feed.slice(0, 10), // Limit for prompt size
                for_you_feed: farcasterFeeds.for_you_feed.slice(0, 10)
            },
            current_timestamp: Date.now(),
            agent_process_id: this.agentProcessId
        };
    }
}
