/**
 * SendFarcasterPostTool
 * Handles posting to Farcaster with comprehensive action tracking and rate limiting prevention
 * Part of Priority 1 fixes for the repetitive action bug
 */

import { WorldStateManager } from './WorldStateManager.js';
import fetch from 'node-fetch';

export class SendFarcasterPostTool {
    constructor(agentProcessId, neynarApiKey) {
        this.agentProcessId = agentProcessId;
        this.neynarApiKey = neynarApiKey;
        this.worldStateManager = new WorldStateManager(agentProcessId);
        this.baseUrl = 'https://api.neynar.com/v2';
    }

    /**
     * Execute Farcaster post with comprehensive tracking and error handling
     */
    async execute(content, parentCastHash = null, channelId = null) {
        const action = 'send_farcaster_post';
        const target = parentCastHash || channelId || 'global';
        
        try {
            // Pre-flight checks
            const preflightResult = this.preflightChecks(content, target);
            if (!preflightResult.canProceed) {
                // Record the blocked attempt
                this.worldStateManager.add_action_result(
                    action, 
                    target, 
                    content, 
                    null, 
                    preflightResult.status, 
                    new Error(preflightResult.reason)
                );
                return {
                    success: false,
                    reason: preflightResult.reason,
                    status: preflightResult.status
                };
            }

            // Attempt to post to Farcaster
            const result = await this.postToFarcaster(content, parentCastHash, channelId);
            
            // Record successful action
            this.worldStateManager.add_action_result(
                action,
                target,
                content,
                result,
                'success'
            );

            console.log(`✅ Farcaster post successful: ${result.castHash}`);
            return {
                success: true,
                result,
                castHash: result.castHash
            };

        } catch (error) {
            // Determine error type for proper tracking
            let status = 'failure:api_error';
            if (error.message.includes('rate limit') || error.message.includes('429')) {
                status = 'failure:rate_limited';
                console.log(`⏰ Farcaster rate limited, cooldown initiated`);
            } else if (error.message.includes('duplicate')) {
                status = 'failure:duplicate_check';
            }

            // Record failed action - THIS IS THE KEY FIX
            this.worldStateManager.add_action_result(
                action,
                target,
                content,
                null,
                status,
                error
            );

            console.error(`❌ Farcaster post failed (${status}):`, error.message);
            return {
                success: false,
                error: error.message,
                status
            };
        }
    }

    /**
     * Pre-flight checks to prevent unnecessary API calls
     */
    preflightChecks(content, target) {
        // Check for rate limiting cooldown
        if (this.worldStateManager.isActionInCooldown('send_farcaster_post', target)) {
            return {
                canProceed: false,
                status: 'failure:rate_limited',
                reason: 'Action is in cooldown due to previous rate limiting'
            };
        }

        // Check for duplicate content
        if (this.worldStateManager.isDuplicateContent(content)) {
            return {
                canProceed: false,
                status: 'failure:duplicate_check',
                reason: 'Content is duplicate of recent post'
            };
        }

        // Check content length
        if (content.length > 320) {
            return {
                canProceed: false,
                status: 'failure:validation',
                reason: 'Content exceeds Farcaster character limit'
            };
        }

        // Check if content is too short or empty
        if (!content || content.trim().length < 1) {
            return {
                canProceed: false,
                status: 'failure:validation',
                reason: 'Content is empty or too short'
            };
        }

        return { canProceed: true };
    }

    /**
     * Actual Farcaster API call
     */
    async postToFarcaster(content, parentCastHash = null, channelId = null) {
        const url = `${this.baseUrl}/farcaster/cast`;
        
        const payload = {
            text: content,
            signer_uuid: process.env.FARCASTER_SIGNER_UUID
        };

        if (parentCastHash) {
            payload.parent = parentCastHash;
        }

        if (channelId) {
            payload.channel_id = channelId;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api_key': this.neynarApiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            
            // Enhanced error handling for different types of failures
            if (response.status === 429) {
                throw new Error(`Farcaster rate limit exceeded: ${errorData}`);
            } else if (response.status === 400 && errorData.includes('duplicate')) {
                throw new Error(`Duplicate cast detected: ${errorData}`);
            } else {
                throw new Error(`Farcaster API error (${response.status}): ${errorData}`);
            }
        }

        const result = await response.json();
        return {
            castHash: result.cast?.hash,
            success: result.success,
            message: result.message
        };
    }
}

/**
 * LikeFarcasterPostTool
 * Handles liking Farcaster casts with deduplication
 * Part of Priority 2 new engagement features
 */
export class LikeFarcasterPostTool {
    constructor(agentProcessId, neynarApiKey) {
        this.agentProcessId = agentProcessId;
        this.neynarApiKey = neynarApiKey;
        this.worldStateManager = new WorldStateManager(agentProcessId);
        this.baseUrl = 'https://api.neynar.com/v2';
    }

    /**
     * Execute like action with deduplication logic
     */
    async execute(castHash) {
        const action = 'like_farcaster_post';
        const target = castHash;

        try {
            // Check if already liked
            if (this.worldStateManager.hasLikedCast(castHash)) {
                this.worldStateManager.add_action_result(
                    action,
                    target,
                    null,
                    null,
                    'failure:duplicate_check',
                    new Error('Cast already liked')
                );
                return {
                    success: false,
                    reason: 'Cast already liked by this agent'
                };
            }

            // Check for rate limiting cooldown
            if (this.worldStateManager.isActionInCooldown('like_farcaster_post')) {
                this.worldStateManager.add_action_result(
                    action,
                    target,
                    null,
                    null,
                    'failure:rate_limited',
                    new Error('Like action in cooldown')
                );
                return {
                    success: false,
                    reason: 'Like action is in cooldown'
                };
            }

            // Perform the like
            const result = await this.likeCast(castHash);

            // Record successful action
            this.worldStateManager.add_action_result(
                action,
                target,
                null,
                result,
                'success'
            );

            console.log(`👍 Successfully liked cast: ${castHash}`);
            return {
                success: true,
                result
            };

        } catch (error) {
            let status = 'failure:api_error';
            if (error.message.includes('rate limit') || error.message.includes('429')) {
                status = 'failure:rate_limited';
            }

            this.worldStateManager.add_action_result(
                action,
                target,
                null,
                null,
                status,
                error
            );

            console.error(`❌ Failed to like cast (${status}):`, error.message);
            return {
                success: false,
                error: error.message,
                status
            };
        }
    }

    /**
     * Like a cast using Neynar API
     */
    async likeCast(castHash) {
        const url = `${this.baseUrl}/farcaster/reaction`;
        
        const payload = {
            reaction_type: 'like',
            target: castHash,
            signer_uuid: process.env.FARCASTER_SIGNER_UUID
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api_key': this.neynarApiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            
            if (response.status === 429) {
                throw new Error(`Farcaster like rate limit exceeded: ${errorData}`);
            } else {
                throw new Error(`Farcaster like API error (${response.status}): ${errorData}`);
            }
        }

        return await response.json();
    }
}

/**
 * FarcasterObserver
 * Fetches and caches Farcaster timeline feeds
 * Part of Priority 1 caching and timeline feeds
 */
export class FarcasterObserver {
    constructor(agentProcessId, neynarApiKey) {
        this.agentProcessId = agentProcessId;
        this.neynarApiKey = neynarApiKey;
        this.worldStateManager = new WorldStateManager(agentProcessId);
        this.baseUrl = 'https://api.neynar.com/v2';
        this.cacheTTL = 3 * 60 * 1000; // 3 minutes
    }

    /**
     * Get home and for_you feeds with caching
     */
    async getFeeds() {
        const cachedFeeds = this.worldStateManager.getFarcasterFeeds();
        
        if (!cachedFeeds.isStale && cachedFeeds.home_feed.length > 0) {
            console.log('📱 Using cached Farcaster feeds');
            return {
                home_feed: cachedFeeds.home_feed,
                for_you_feed: cachedFeeds.for_you_feed
            };
        }

        try {
            console.log('📡 Fetching fresh Farcaster feeds...');
            const [homeFeed, forYouFeed] = await Promise.all([
                this.fetchHomeFeed(),
                this.fetchForYouFeed()
            ]);

            this.worldStateManager.updateFarcasterFeeds(homeFeed, forYouFeed);
            
            return {
                home_feed: homeFeed,
                for_you_feed: forYouFeed
            };

        } catch (error) {
            console.error('❌ Failed to fetch Farcaster feeds:', error.message);
            
            // Return cached data even if stale, or empty arrays
            return {
                home_feed: cachedFeeds.home_feed || [],
                for_you_feed: cachedFeeds.for_you_feed || []
            };
        }
    }

    /**
     * Fetch home timeline
     */
    async fetchHomeFeed() {
        const url = `${this.baseUrl}/farcaster/feed`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'api_key': this.neynarApiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch home feed: ${response.status}`);
        }

        const data = await response.json();
        return this.formatFeedData(data.casts || []);
    }

    /**
     * Fetch for you timeline
     */
    async fetchForYouFeed() {
        const url = `${this.baseUrl}/farcaster/feed/for_you`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'api_key': this.neynarApiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch for you feed: ${response.status}`);
        }

        const data = await response.json();
        return this.formatFeedData(data.casts || []);
    }

    /**
     * Format feed data for AI consumption
     */
    formatFeedData(casts) {
        return casts.slice(0, 20).map(cast => ({
            hash: cast.hash,
            author: cast.author?.username || 'unknown',
            text: cast.text,
            timestamp: cast.timestamp,
            reactions: {
                likes_count: cast.reactions?.likes_count || 0,
                recasts_count: cast.reactions?.recasts_count || 0,
                replies_count: cast.replies?.count || 0
            },
            channel: cast.channel?.id || null
        }));
    }
}
