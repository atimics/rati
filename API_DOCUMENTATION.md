# RATi API Documentation

This document describes the REST API endpoints provided by the RATi deployment service.

## Base URL

- Development: `http://localhost:3001`
- Production: `https://your-domain.com/api`

## Authentication

Most endpoints require authentication via JWT tokens:

```
Authorization: Bearer <your-jwt-token>
```

## Health Check

### GET /health

Check the health status of the deployment service.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Deployment Endpoints

### POST /deploy/genesis

Deploy a genesis process (the foundational component of an avatar system).

**Request Body:**
```json
{
  "name": "My Genesis",
  "description": "Genesis process for my avatar system",
  "config": {
    "optional": "configuration"
  }
}
```

**Response:**
```json
{
  "success": true,
  "processId": "genesis-process-id",
  "txId": "arweave-transaction-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /deploy/oracle

Deploy an oracle process (provides external data to avatars).

**Request Body:**
```json
{
  "genesisId": "genesis-process-id",
  "name": "My Oracle",
  "config": {
    "optional": "configuration"
  }
}
```

**Response:**
```json
{
  "success": true,
  "processId": "oracle-process-id",
  "txId": "arweave-transaction-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /deploy/agent

Deploy an individual AI agent.

**Request Body:**
```json
{
  "genesisId": "genesis-process-id",
  "oracleId": "oracle-process-id",
  "name": "My Agent",
  "prompt": "Custom agent personality prompt",
  "config": {
    "aiProvider": "openai",
    "model": "gpt-4",
    "optional": "configuration"
  }
}
```

**Response:**
```json
{
  "success": true,
  "processId": "agent-process-id",
  "txId": "arweave-transaction-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /deploy/full

Deploy a complete avatar system (genesis + oracle + agent).

**Request Body:**
```json
{
  "name": "Complete Avatar System",
  "description": "Full deployment of avatar system",
  "agentConfig": {
    "name": "My Agent",
    "prompt": "Agent personality",
    "aiProvider": "openai"
  }
}
```

**Response:**
```json
{
  "success": true,
  "genesisId": "genesis-process-id",
  "oracleId": "oracle-process-id",
  "agentId": "agent-process-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /deploy/reset

Reset all deployments (useful for development).

**Response:**
```json
{
  "success": true,
  "message": "Deployment reset successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Agent Management Endpoints

### GET /agents/:agentId/status

Get the status of a specific agent.

**Response:**
```json
{
  "agentId": "agent-process-id",
  "status": "running|stopped|error",
  "lastActivity": "2024-01-01T00:00:00.000Z",
  "processInfo": {
    "pid": 12345,
    "memory": "50MB",
    "uptime": 3600
  }
}
```

### POST /agents/:agentId/start

Start a stopped agent.

**Response:**
```json
{
  "success": true,
  "agentId": "agent-process-id",
  "status": "running"
}
```

### POST /agents/:agentId/stop

Stop a running agent.

**Response:**
```json
{
  "success": true,
  "agentId": "agent-process-id",
  "status": "stopped"
}
```

### POST /agents/:agentId/message

Send a message to an agent.

**Request Body:**
```json
{
  "content": "Hello, agent!",
  "metadata": {
    "sender": "user-id",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "message-id",
  "response": "Agent's response message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## WebSocket Endpoints

### /ws/agents/:agentId

Real-time WebSocket connection for agent communication.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3001/ws/agents/agent-id');
```

**Message Format:**
```json
{
  "type": "message|status|error",
  "content": "Message content",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "metadata": {}
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common Error Codes

- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Invalid or expired token
- `404`: Not Found - Resource not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error

## Rate Limiting

API endpoints are rate limited to:
- 100 requests per 15-minute window per IP address
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when the rate limit window resets

## Examples

### JavaScript/Node.js

```javascript
// Deploy a complete avatar system
const response = await fetch('http://localhost:3001/deploy/full', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    name: 'My Avatar System',
    description: 'Complete avatar deployment',
    agentConfig: {
      name: 'Assistant',
      prompt: 'You are a helpful AI assistant.',
      aiProvider: 'openai'
    }
  })
});

const result = await response.json();
console.log('Deployment result:', result);
```

### cURL

```bash
# Deploy genesis
curl -X POST http://localhost:3001/deploy/genesis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "My Genesis",
    "description": "Genesis process"
  }'
```

## Journal Management Endpoints

### POST /journal/:agentId/generate

Generate a new journal entry for an agent based on recent activity.

**Parameters:**
- `agentId`: The ID of the agent

**Request Body:**
```json
{
  "timeframe": "24h"
}
```

**Response:**
```json
{
  "success": true,
  "agentId": "agent-process-id",
  "timeframe": "24h",
  "message": "Journal entry generation requested"
}
```

### GET /journal/:agentId/entries

Get recent journal entries for an agent.

**Parameters:**
- `agentId`: The ID of the agent

**Query Parameters:**
- `limit`: Maximum number of entries to return (default: 10)

**Response:**
```json
{
  "success": true,
  "agentId": "agent-process-id",
  "entries": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "agentId": "agent-process-id",
      "entry": "Today was an interesting day filled with meaningful conversations...",
      "context": {
        "messageCount": 15,
        "eventCount": 3,
        "timespan": {
          "start": "2023-12-31T00:00:00.000Z",
          "end": "2024-01-01T00:00:00.000Z"
        }
      }
    }
  ],
  "total": 1
}
```

### GET /journal/:agentId/stats

Get statistics about an agent's journaling activity.

**Parameters:**
- `agentId`: The ID of the agent

**Response:**
```json
{
  "success": true,
  "stats": {
    "agentId": "agent-process-id",
    "totalEntries": 45,
    "entriesThisWeek": 7,
    "entriesThisMonth": 28,
    "averageEntryLength": 350,
    "lastEntryDate": "2024-01-01T00:00:00.000Z",
    "journalStartDate": "2023-12-01T00:00:00.000Z",
    "activityMetrics": {
      "messagesProcessed": 1250,
      "systemEvents": 156,
      "uniqueInteractions": 89
    }
  }
}
```

### PUT /journal/:agentId/config

Update journal configuration for an agent.

**Parameters:**
- `agentId`: The ID of the agent

**Request Body:**
```json
{
  "enabled": true,
  "interval": "24h",
  "maxContextLength": 8000,
  "journalPrompt": "Custom journal prompt for this agent..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Journal configuration updated",
  "config": {
    "agentId": "agent-process-id",
    "enabled": true,
    "interval": "24h",
    "maxContextLength": 8000,
    "journalPrompt": "Custom journal prompt for this agent...",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /journal/:agentId/export

Export journal entries for backup or analysis.

**Parameters:**
- `agentId`: The ID of the agent

**Query Parameters:**
- `format`: Export format (`json` or `text`, default: `json`)
- `startDate`: Start date for filtering (ISO 8601 format)
- `endDate`: End date for filtering (ISO 8601 format)

**Response (JSON format):**
```json
{
  "agentId": "agent-process-id",
  "exportDate": "2024-01-01T00:00:00.000Z",
  "format": "json",
  "filters": {
    "startDate": "2023-12-01T00:00:00.000Z",
    "endDate": "2024-01-01T00:00:00.000Z"
  },
  "entries": [...]
}
```

**Response (Text format):**
```
Agent Journal Export
Agent ID: agent-process-id
Export Date: 2024-01-01T00:00:00.000Z

Entry 1 - 2024-01-01T00:00:00.000Z
Today was an interesting day...

Entry 2 - 2023-12-31T00:00:00.000Z
Reflecting on yesterday's conversations...
```

## Journal Features

### Automatic Journal Generation
- Agents automatically generate journal entries based on configured intervals
- Default interval is 24 hours, but can be customized per agent
- Journal entries are generated using AI based on recent activity

### Activity Tracking
- **Message History**: All conversations and interactions are tracked
- **System Events**: Deployment events, errors, and status changes are logged
- **Context Preservation**: Relevant context is maintained for journal generation

### Intelligent Summarization
- Long activity logs are automatically chunked and summarized
- AI generates coherent journal entries from activity summaries
- Context length is managed to prevent token limit issues

### Journal Persistence
- Journal entries are saved to persistent storage
- Entries include metadata about the time period and activity levels
- Full export functionality for backup and analysis

### Customization
- Custom journal prompts can be set per agent
- Journaling intervals are configurable
- Context length limits can be adjusted based on needs