/**
 * Matrix Tools for enhanced social engagement
 * Part of Priority 2 new engagement features
 */

import { WorldStateManager } from './WorldStateManager.js';
import fetch from 'node-fetch';
import { URL } from 'url';

/**
 * SendMatrixMessageTool
 * Handles sending messages to Matrix rooms
 */
export class SendMatrixMessageTool {
    constructor(agentProcessId, matrixConfig) {
        this.agentProcessId = agentProcessId;
        this.matrixConfig = matrixConfig; // { homeserver, accessToken, userId }
        this.worldStateManager = new WorldStateManager(agentProcessId);
    }

    /**
     * Send message to Matrix room with action tracking
     */
    async execute(roomId, content, msgtype = 'm.text') {
        const action = 'send_matrix_message';
        const target = roomId;

        try {
            // Pre-flight checks
            if (this.worldStateManager.isActionInCooldown('send_matrix_message', roomId)) {
                this.worldStateManager.add_action_result(
                    action,
                    target,
                    content,
                    null,
                    'failure:rate_limited',
                    new Error('Matrix message action in cooldown')
                );
                return {
                    success: false,
                    reason: 'Action is in cooldown'
                };
            }

            // Check for duplicate content
            if (this.worldStateManager.isDuplicateContent(content)) {
                this.worldStateManager.add_action_result(
                    action,
                    target,
                    content,
                    null,
                    'failure:duplicate_check',
                    new Error('Duplicate content detected')
                );
                return {
                    success: false,
                    reason: 'Content is duplicate of recent message'
                };
            }

            // Send the message
            const result = await this.sendMessage(roomId, content, msgtype);

            // Record successful action
            this.worldStateManager.add_action_result(
                action,
                target,
                content,
                result,
                'success'
            );

            console.log(`💬 Matrix message sent to ${roomId}: ${result.event_id}`);
            return {
                success: true,
                result,
                eventId: result.event_id
            };

        } catch (error) {
            let status = 'failure:api_error';
            if (error.message.includes('rate limit') || error.message.includes('429')) {
                status = 'failure:rate_limited';
            }

            this.worldStateManager.add_action_result(
                action,
                target,
                content,
                null,
                status,
                error
            );

            console.error(`❌ Matrix message failed (${status}):`, error.message);
            return {
                success: false,
                error: error.message,
                status
            };
        }
    }

    /**
     * Send message using Matrix Client-Server API
     */
    async sendMessage(roomId, content, msgtype) {
        const txnId = Date.now() + Math.random().toString(36).substr(2, 9);
        const url = `${this.matrixConfig.homeserver}/_matrix/client/r0/rooms/${roomId}/send/m.room.message/${txnId}`;

        const payload = {
            msgtype,
            body: content
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.matrixConfig.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Matrix API error (${response.status}): ${errorData}`);
        }

        return await response.json();
    }
}

/**
 * ReactToMatrixMessageTool
 * Handles reacting to Matrix messages with emojis
 * Part of Priority 2 new engagement features
 */
export class ReactToMatrixMessageTool {
    constructor(agentProcessId, matrixConfig) {
        this.agentProcessId = agentProcessId;
        this.matrixConfig = matrixConfig;
        this.worldStateManager = new WorldStateManager(agentProcessId);
    }

    /**
     * React to a Matrix message with emoji
     */
    async execute(roomId, eventId, emoji) {
        const action = 'react_to_matrix_message';
        const target = eventId;

        try {
            // Check if already reacted to this message
            if (this.worldStateManager.hasReactedToMessage(eventId)) {
                this.worldStateManager.add_action_result(
                    action,
                    target,
                    emoji,
                    null,
                    'failure:duplicate_check',
                    new Error('Message already reacted to')
                );
                return {
                    success: false,
                    reason: 'Message already reacted to by this agent'
                };
            }

            // Check for rate limiting cooldown
            if (this.worldStateManager.isActionInCooldown('react_to_matrix_message')) {
                this.worldStateManager.add_action_result(
                    action,
                    target,
                    emoji,
                    null,
                    'failure:rate_limited',
                    new Error('Reaction action in cooldown')
                );
                return {
                    success: false,
                    reason: 'Reaction action is in cooldown'
                };
            }

            // Send the reaction
            const result = await this.sendReaction(roomId, eventId, emoji);

            // Record successful action
            this.worldStateManager.add_action_result(
                action,
                target,
                emoji,
                result,
                'success'
            );

            console.log(`😊 Matrix reaction sent: ${emoji} to ${eventId}`);
            return {
                success: true,
                result,
                eventId: result.event_id
            };

        } catch (error) {
            let status = 'failure:api_error';
            if (error.message.includes('rate limit') || error.message.includes('429')) {
                status = 'failure:rate_limited';
            }

            this.worldStateManager.add_action_result(
                action,
                target,
                emoji,
                null,
                status,
                error
            );

            console.error(`❌ Matrix reaction failed (${status}):`, error.message);
            return {
                success: false,
                error: error.message,
                status
            };
        }
    }

    /**
     * Send reaction using Matrix Client-Server API
     */
    async sendReaction(roomId, eventId, emoji) {
        const txnId = Date.now() + Math.random().toString(36).substr(2, 9);
        const url = `${this.matrixConfig.homeserver}/_matrix/client/r0/rooms/${roomId}/send/m.reaction/${txnId}`;

        const payload = {
            'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: eventId,
                key: emoji
            }
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.matrixConfig.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Matrix reaction API error (${response.status}): ${errorData}`);
        }

        return await response.json();
    }
}

/**
 * MatrixObserver
 * Observes Matrix rooms for new messages and events
 */
export class MatrixObserver {
    constructor(agentProcessId, matrixConfig) {
        this.agentProcessId = agentProcessId;
        this.matrixConfig = matrixConfig;
        this.worldStateManager = new WorldStateManager(agentProcessId);
        this.lastSyncToken = null;
    }

    /**
     * Get new messages from Matrix rooms
     */
    async getNewMessages(roomIds = []) {
        try {
            const syncResult = await this.sync();
            const newMessages = [];

            if (syncResult.rooms?.join) {
                for (const [roomId, roomData] of Object.entries(syncResult.rooms.join)) {
                    if (roomIds.length === 0 || roomIds.includes(roomId)) {
                        const roomMessages = this.extractMessages(roomId, roomData);
                        newMessages.push(...roomMessages);
                    }
                }
            }

            return newMessages.filter(msg => 
                !this.worldStateManager.isMessageProcessed(msg.event_id)
            );

        } catch (error) {
            console.error('❌ Failed to get Matrix messages:', error.message);
            return [];
        }
    }

    /**
     * Sync with Matrix homeserver
     */
    async sync() {
        const url = new URL(`${this.matrixConfig.homeserver}/_matrix/client/r0/sync`);
        
        if (this.lastSyncToken) {
            url.searchParams.set('since', this.lastSyncToken);
        }
        url.searchParams.set('timeout', '10000');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.matrixConfig.accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Matrix sync failed (${response.status}): ${await response.text()}`);
        }

        const syncData = await response.json();
        this.lastSyncToken = syncData.next_batch;

        return syncData;
    }

    /**
     * Extract messages from room data
     */
    extractMessages(roomId, roomData) {
        const messages = [];

        if (roomData.timeline?.events) {
            for (const event of roomData.timeline.events) {
                if (event.type === 'm.room.message' && 
                    event.sender !== this.matrixConfig.userId) {
                    
                    messages.push({
                        event_id: event.event_id,
                        room_id: roomId,
                        sender: event.sender,
                        content: event.content?.body || '',
                        msgtype: event.content?.msgtype || 'm.text',
                        timestamp: event.origin_server_ts,
                        type: 'matrix_message'
                    });
                }
            }
        }

        return messages;
    }

    /**
     * Mark messages as processed
     */
    markMessagesProcessed(messageIds) {
        messageIds.forEach(id => {
            this.worldStateManager.markMessageProcessed(id);
        });
    }
}
