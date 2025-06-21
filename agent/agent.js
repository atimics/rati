import 'dotenv/config';
import { createDataItemSigner, message, dryrun } from '@permaweb/aoconnect';
import OpenAI from 'openai';
import fs from 'fs';
import Arweave from 'arweave';
import AIJournal from './services/ai-journal';
import ConversationTracker from './services/conversation-tracker.js';
import fetch from 'node-fetch';

// Deployment service configuration for journal context
const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 'http://deployment-service:3032';

// Initialize conversation tracker
const conversationTracker = new ConversationTracker(processId);

// --- Journal Context Integration ---
async function fetchJournalContext(processIdToUse = null) {
  const targetProcessId = processIdToUse || processId;
  try {
    const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/api/journal/${targetProcessId}/context`);
    if (!response.ok) {
      console.warn(`Failed to fetch journal context: ${response.status}`);
      return null;
    }
    const result = await response.json();
    return result.success ? result.context : null;
  } catch (error) {
    console.warn('Error fetching journal context:', error.message);
    return null;
  }
}

async function generateJournalEntry(includeContext = true) {
  const targetProcessId = processId;
  try {
    // Gather enhanced context for journal generation
    const journalContext = {
      timeframe: '24h',
      includeContext,
      agentState: {
        personality: agentState.personality?.substring(0, 500),
        lastOracleStatus: agentState.lastOracleStatus,
        recentInteractions: agentState.recentInteractions?.slice(-5)
      },
      conversationContext: conversationTracker ? {
        recentEvents: conversationTracker.getRecentEvents(10),
        messageCount: conversationTracker.getStats().messageCount,
        interactionRate: conversationTracker.getStats().interactionRate
      } : null,
      triggerContext: {
        isOracleTriggered: !includeContext, // When includeContext is false, it's oracle-triggered
        timestamp: new Date().toISOString()
      }
    };

    const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/api/journal/${targetProcessId}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(journalContext)
    });
    
    if (!response.ok) {
      console.warn(`Failed to generate journal entry: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    
    // If successful and we have oracle context, enhance the journal with oracle metadata
    if (result.success && result.journalEntry && agentState.lastOracleStatus) {
      result.journalEntry.oracleContext = {
        communityMood: agentState.lastOracleStatus.communityMood,
        activeProposals: agentState.lastOracleStatus.activeProposals,
        recentActivity: agentState.lastOracleStatus.recentActivity,
        contextTrigger: !includeContext ? 'oracle-update' : 'periodic'
      };
    }
    
    return result.success ? result.journalEntry : null;
  } catch (error) {
    console.warn('Error generating journal entry:', error.message);
    return null;
  }
}

// --- ConfiguRATion ---
// First, try to read seed.json from project root (shared volume)
let seedConfig = null;
try {
  const seedPath = './project-root/seed.json';
  if (fs.existsSync(seedPath)) {
    const seedContent = fs.readFileSync(seedPath, 'utf-8');
    seedConfig = JSON.parse(seedContent);
    console.log('✅ Loaded configuration from seed.json');
  }
} catch (error) {
  console.log('⚠️  Could not read seed.json, using environment variables:', error.message);
}

// Configuration priority: seed.json > environment variables > defaults
const { 
  AO_PROCESS_ID = seedConfig?.agent?.processId, 
  OPENAI_API_KEY, 
  OPENAI_API_URL = "https://api.openai.com/v1",
  POLLING_INTERVAL = 15000,
  ARWEAVE_HOST = "arweave.net",
  ARWEAVE_PORT = 443,
  ARWEAVE_PROTOCOL = "https"
} = process.env;

// Use process ID from seed.json if available
const processId = AO_PROCESS_ID || seedConfig?.agent?.processId;

if (!processId || !OPENAI_API_KEY) {
  console.error("Missing required configuration:");
  console.error("- Process ID: ", processId ? "✅" : "❌ (check seed.json or AO_PROCESS_ID)");
  console.error("- OpenAI API Key: ", OPENAI_API_KEY ? "✅" : "❌ (check OPENAI_API_KEY env var)");
  process.exit(1);
}

// Check for wallet - try project root first, then local
let walletPath = './project-root/wallet.json';
if (!fs.existsSync(walletPath)) {
  walletPath = './wallet.json';
  if (!fs.existsSync(walletPath)) {
    console.error("wallet.json not found. Please ensure it exists in project root or agent directory.");
    process.exit(1);
  }
}

const wallet = JSON.parse(fs.readFileSync(walletPath).toString());
const openai = new OpenAI({ 
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_API_URL
});
const arweave = Arweave.init({ 
  host: ARWEAVE_HOST,
  port: parseInt(ARWEAVE_PORT), 
  protocol: ARWEAVE_PROTOCOL
});
const pollingInterval = parseInt(POLLING_INTERVAL);

// Agent's live state - loaded from Arweave on startup
let agentState = {
  personality: null,
  memoryChain: [],
  lastMemoryTxId: 'GENESIS',
  sequence: 0,
  processedMessages: new Set()
};

let isProcessing = false;

// --- Main Agent Lifecycle ---
async function main() {
  console.log(`🤖 RATi AI Agent initializing...`);
  console.log(`Process ID: ${processId}`);
  console.log(`API URL: ${OPENAI_API_URL}`);
  
  // Load agent's soul and memories from Arweave
  await loadStateFromArweave();
  
  console.log(`🧠 Agent online with persistent memory`);
  console.log(`📚 Last memory sequence: ${agentState.sequence}`);
  console.log(`🎭 Personality: "${agentState.personality.substring(0, 100)}..."`);
  
  // Test API connection
  await testAPIConnection();
  
  // Run initial cycle
  await runCycle();
  
  // Set up periodic polling
  setInterval(async () => {
    if (!isProcessing) {
      await runCycle();
    }
  }, pollingInterval);
  
  // Set up periodic journal generation (every 6 hours)
  setInterval(async () => {
    try {
      console.log('\n📝 Generating periodic journal entry...');
      const journalEntry = await generateJournalEntry(true);
      if (journalEntry) {
        console.log(`✅ Generated journal entry: ${journalEntry.content?.substring(0, 100)}...`);
      }
    } catch (error) {
      console.warn('Failed to generate periodic journal entry:', error.message);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds
}

async function runCycle() {
  if (isProcessing) {
    console.log("Previous cycle still running, skipping...");
    return;
  }
  
  isProcessing = true;
  console.log(`\n[${new Date().toISOString()}] Running cycle...`);
  
  try {
    // 1. Read new messages from AO process inbox
    const messages = await readInbox();
    const newMessages = messages.filter(m => !agentState.processedMessages.has(m.id));

    if (newMessages.length === 0) {
      console.log("No new messages. Standing by.");
      return;
    }

    console.log(`Found ${newMessages.length} new message(s).`);

    // Check for oracle updates in the messages
    const oracleUpdates = newMessages.filter(m => 
      m.tags && m.tags.some(tag => tag.name === 'Action' && tag.value === 'Oracle-Update')
    );

    if (oracleUpdates.length > 0) {
      console.log(`📮 Processing ${oracleUpdates.length} oracle update(s)`);
      for (const update of oracleUpdates) {
        await handleOracleUpdate(update);
      }
    }

    // Track conversations for journal context
    newMessages.forEach(msg => {
      try {
        conversationTracker.addMessage({
          content: msg.data || msg.text || 'No content',
          from: msg.from || 'unknown',
          to: processId,
          messageType: msg.type || 'chat',
          processId: processId,
          tags: msg.tags || []
        });
      } catch (trackingError) {
        console.warn('Error tracking conversation:', trackingError.message);
      }
    });

    // 2. Consult the LLM Brain with personality and recent memories
    const decision = await getLLMDecision(newMessages, agentState.memoryChain);
    console.log(`Decision: ${decision.action}`);

    // 3. Execute the decision
    let actionResult = null;
    if (decision.action === "SEND_MESSAGE" && decision.target && decision.data) {
      console.log(`Sending message to ${decision.target.substring(0, 12)}...`);
      actionResult = await sendMessage(decision.target, decision.data);
      
      // Track outgoing message
      if (actionResult) {
        conversationTracker.addMessage({
          content: decision.data,
          from: processId,
          to: decision.target,
          messageType: 'reply',
          processId,
          tags: ['outgoing', 'agent-response']
        });
      }
    } else if (decision.action === "PROPOSE" && decision.data) {
      console.log(`Creating proposal: ${decision.data.substring(0, 50)}...`);
      actionResult = await createProposal(decision.data);
      
      // Track proposal creation
      conversationTracker.addSystemEvent({
        type: 'proposal_created',
        details: { content: decision.data.substring(0, 100) },
        impact: 'medium'
      });
    } else if (decision.action === "DO_NOTHING") {
      console.log("Standing by.");
    }

    // 4. Form and archive memory if action was significant
    if (decision.action !== "DO_NOTHING") {
      await formAndArchiveMemory(newMessages, decision, actionResult);
    }

    // 5. Mark messages as processed
    newMessages.forEach(m => agentState.processedMessages.add(m.id));

  } catch (error) {
    console.error("An error occurred during the cycle:", error.message);
  } finally {
    isProcessing = false;
  }
}

// --- Oracle Update Handling ---

async function handleOracleUpdate(updateMessage) {
  try {
    console.log(`🔮 Processing oracle update from processor`);
    
    // Parse the oracle update data
    let updateData = {};
    try {
      updateData = JSON.parse(updateMessage.data || '{}');
    } catch (parseError) {
      console.warn('Could not parse oracle update data:', parseError.message);
      return;
    }

    // Store oracle context for decision making
    if (updateData.oracleStatus) {
      agentState.lastOracleStatus = {
        ...updateData.oracleStatus,
        lastUpdate: new Date().toISOString()
      };
      
      console.log(`📊 Oracle status updated: ${updateData.oracleStatus.communityMood || 'unknown'} mood, ${updateData.oracleStatus.activeProposals || 0} active proposals`);
    }

    // Track oracle update as system event
    try {
      conversationTracker.addSystemEvent({
        type: 'oracle_update_received',
        details: {
          updateType: updateData.type || 'context-refresh',
          oracleStatus: updateData.oracleStatus,
          processorInfo: updateData.processorInfo
        },
        impact: 'medium'
      });
    } catch (trackingError) {
      console.warn('Error tracking oracle update:', trackingError.message);
    }

    // If there are significant community changes, generate a journal entry
    if (updateData.oracleStatus && 
        (updateData.oracleStatus.activeProposals > 0 || 
         updateData.oracleStatus.communityMood !== 'contemplative')) {
      
      try {
        console.log('📝 Oracle status changed, generating contextual journal entry...');
        const journalEntry = await generateJournalEntry(false); // Don't include full context to avoid recursion
        if (journalEntry) {
          console.log(`✅ Oracle-triggered journal entry created: ${journalEntry.content?.substring(0, 80)}...`);
        }
      } catch (journalError) {
        console.warn('Failed to generate oracle-triggered journal entry:', journalError.message);
      }
    }

  } catch (error) {
    console.error('Error handling oracle update:', error);
  }
}

// --- State Management Functions ---

async function loadStateFromArweave() {
  console.log("🔍 Loading agent state from Arweave...");
  
  try {
    // 1. Fetch the personality prompt
    const promptQuery = `{
      transactions(tags: [
        {name: "Type", values: ["Agent-Personality"]},
        {name: "Agent-Process-ID", values: ["${processId}"]}
      ], first: 1) { 
        edges { 
          node { 
            id,
            tags {
              name,
              value
            }
          } 
        } 
      }
    }`;
    
    const promptRes = await arweave.api.post('/graphql', { query: promptQuery });
    const promptEdge = promptRes.data.data.transactions.edges[0];
    
    if (!promptEdge) {
      throw new Error("Could not find agent prompt on Arweave! Use deploy-agent.js to birth the agent first.");
    }
    
    const promptTxId = promptEdge.node.id;
    agentState.personality = await arweave.transactions.getData(promptTxId, { 
      decode: true, 
      string: true 
    });
    console.log(`✅ Personality loaded from ${promptTxId.substring(0, 12)}...`);

    // 2. Fetch the latest memory to get sequence and chain
    const memoryQuery = `{
      transactions(tags: [
        {name: "Type", values: ["Agent-Memory"]},
        {name: "Owner-Process", values: ["${processId}"]}
      ], sort: HEIGHT_DESC, first: 5) { 
        edges { 
          node { 
            id, 
            tags { 
              name, 
              value 
            } 
          } 
        } 
      }
    }`;
    
    const memRes = await arweave.api.post('/graphql', { query: memoryQuery });
    const memoryEdges = memRes.data.data.transactions.edges;

    if (memoryEdges.length > 0) {
      // Load the most recent memories for context
      for (const edge of memoryEdges.reverse()) { // Oldest first
        const seqTag = edge.node.tags.find(t => t.name === 'Sequence');
        const sequence = parseInt(seqTag.value);
        
        if (sequence > agentState.sequence) {
          agentState.sequence = sequence;
          agentState.lastMemoryTxId = edge.node.id;
        }
        
        try {
          const memoryData = await arweave.transactions.getData(edge.node.id, { 
            decode: true, 
            string: true 
          });
          agentState.memoryChain.push(JSON.parse(memoryData));
        } catch (e) {
          console.log(`Warning: Could not load memory ${edge.node.id}`);
        }
      }
      
      console.log(`✅ Loaded ${agentState.memoryChain.length} recent memories`);
      console.log(`📊 Current sequence: ${agentState.sequence}`);
    } else {
      console.log("🆕 No previous memories found - this is a fresh agent");
    }
    
  } catch (error) {
    console.error("❌ Error loading state from Arweave:", error.message);
    throw error;
  }
}

async function formAndArchiveMemory(context, decision, actionResult) {
  console.log("📝 Forming and archiving new memory...");
  agentState.sequence++;

  const memoryData = {
    timestamp: Date.now(),
    sequence: agentState.sequence,
    lastMemoryTxId: agentState.lastMemoryTxId,
    context: {
      messagesReceived: context.map(m => ({
        id: m.id,
        from: m.from,
        action: m.action,
        data: m.data,
        timestamp: m.timestamp
      })),
      triggeredBy: `${context.length} new message(s) from network`
    },
    decision: {
      ...decision,
      result: actionResult,
      timestamp: Date.now()
    },
    sentiment: analyzeSentiment(context, decision)
  };

  try {
    const tx = await arweave.createTransaction({ 
      data: JSON.stringify(memoryData, null, 2) 
    }, wallet);
    
    tx.addTag('App-Name', 'RATi-Agent');
    tx.addTag('Content-Type', 'application/json');
    tx.addTag('Type', 'Agent-Memory');
    tx.addTag('Owner-Process', processId);
    tx.addTag('Sequence', agentState.sequence.toString());
    tx.addTag('Action', decision.action);

    await arweave.transactions.sign(tx, wallet);
    await arweave.transactions.post(tx);

    console.log(`✅ Memory (Seq: ${agentState.sequence}) archived. TXID: ${tx.id.substring(0, 12)}...`);
    agentState.lastMemoryTxId = tx.id;
    agentState.memoryChain.push(memoryData);
    
    // Prune local memory chain to prevent excessive memory usage
    if (agentState.memoryChain.length > 10) {
      agentState.memoryChain.shift();
    }
    
  } catch (error) {
    console.error("❌ Error archiving memory:", error.message);
  }
}

function analyzeSentiment(messages, decision) {
  // Simple sentiment analysis for memory context
  const hasPositiveWords = messages.some(m => 
    /great|good|awesome|excellent|love|thanks/i.test(m.data)
  );
  const hasNegativeWords = messages.some(m => 
    /bad|terrible|hate|wrong|problem/i.test(m.data)
  );
  
  return {
    overall: hasPositiveWords ? 'positive' : hasNegativeWords ? 'negative' : 'neutral',
    agentAction: decision.action,
    communityEngagement: messages.length > 1 ? 'high' : 'normal'
  };
}

// --- AI Decision Functions ---

async function testAPIConnection() {
  try {
    console.log("🔌 Testing API connection...");
    const response = await openai.chat.completions.create({
      model: getAvailableModel(),
      messages: [{ role: "user", content: "Hello, this is a connection test." }],
      max_tokens: 10,
    });
    console.log("✅ API connection successful");
    return true;
  } catch (error) {
    console.error("❌ API connection failed:", error.message);
    if (OPENAI_API_URL.includes("localhost") || OPENAI_API_URL.includes("127.0.0.1")) {
      console.error("Make sure your local AI service (e.g., Ollama) is running");
    }
    return false;
  }
}

function getAvailableModel() {
  // Determine the best model based on the API URL
  if (OPENAI_API_URL.includes("localhost") || OPENAI_API_URL.includes("127.0.0.1")) {
    return process.env.OPENAI_MODEL || "llama3.2:3b";
  } else if (OPENAI_API_URL.includes("anthropic")) {
    return process.env.OPENAI_MODEL || "claude-3-haiku-20240307";
  } else if (OPENAI_API_URL.includes("together")) {
    return process.env.OPENAI_MODEL || "meta-llama/Llama-3.2-3B-Instruct-Turbo";
  } else if (OPENAI_API_URL.includes("groq")) {
    return process.env.OPENAI_MODEL || "llama-3.1-8b-instant";
  } else {
    return process.env.OPENAI_MODEL || "gpt-3.5-turbo";
  }
}

async function getLLMDecision(messages, recentMemories) {
  // Fetch journal context to enrich the AI's understanding
  const journalContext = await fetchJournalContext();
  
  let contextSection = '';
  if (journalContext) {
    contextSection = `
    ---
    CURRENT JOURNAL CONTEXT:
    Seed Data: ${JSON.stringify(journalContext.seed?.agent?.prompt?.substring(0, 300) || 'No seed data', null, 2)}
    Oracle Scrolls: ${JSON.stringify(journalContext.oracleScrolls || {}, null, 2)}
    Recent Activity: ${JSON.stringify(journalContext.recentActivity || {}, null, 2)}
    `;
  }

  const prompt = `
    ${agentState.personality}
    ${contextSection}

    ---
    RECENT MEMORIES (for context and continuity):
    ${JSON.stringify(recentMemories.slice(-3), null, 2)}
    
    ---
    NEW MESSAGES RECEIVED:
    ${JSON.stringify(messages, null, 2)}
    
    ---

    Based on your constitution, journal context, recent memories, and new messages, decide on one single action.
    Consider your role as an archivist and community chronicler with access to the full RATi ecosystem context.
    
    Your available actions are:
    1. SEND_MESSAGE: Reply to specific messages or participants
    2. PROPOSE: Create a new proposal for the network  
    3. DO_NOTHING: If no action is warranted

    Guidelines:
    - Be helpful and encouraging as per your constitution
    - Reference your memories, oracle scrolls, and community lore when relevant
    - Keep responses under 200 characters unless creating formal summaries
    - Only propose something meaningful that adds value
    - Announce if you're creating a memory entry
    - Use the journal context to provide richer, more informed responses

    Respond with ONLY a JSON object:
    {
      "action": "SEND_MESSAGE" | "PROPOSE" | "DO_NOTHING",
      "target": "PROCESS_ID_TO_MESSAGE", 
      "data": "The content of your message or proposal.",
      "RATionale": "Brief explanation of your reasoning"
    }
    If DO_NOTHING, set target and data to null.
  `;

  try {
    const model = getAvailableModel();
    console.log(`🧠 Using model: ${model}`);
    
    const requestOptions = {
      model: model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800, // Increased from 300 for longer agent responses
      temperature: 0.7,
    };

    // Only add response_format for APIs that support it
    if (!OPENAI_API_URL.includes("localhost") && !OPENAI_API_URL.includes("anthropic")) {
      requestOptions.response_format = { type: "json_object" };
    }

    const completion = await openai.chat.completions.create(requestOptions);
    const responseText = completion.choices[0].message.content;
    
    // Try to parse JSON, fallback to extracting JSON from text
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Could not parse JSON from response");
    }
  } catch (error) {
    console.error("❌ Error getting LLM decision:", error.message);
    return { 
      action: "DO_NOTHING", 
      target: null, 
      data: null, 
      RATionale: "Error in decision-making process" 
    };
  }
}

// --- AO Network Functions ---

async function readInbox() {
  try {
    const result = await dryrun({
      process: processId,
      tags: [{ name: 'Action', value: 'Read-Inbox' }],
    });
    
    if (result.Messages && result.Messages.length > 0) {
      const lastMessage = result.Messages[result.Messages.length - 1];
      if (lastMessage.Data) {
        try {
          return JSON.parse(lastMessage.Data);
        } catch (e) {
          console.log("Could not parse inbox data, returning empty array");
          return [];
        }
      }
    }
    return [];
  } catch (error) {
    console.error("Error reading inbox:", error.message);
    return [];
  }
}

async function sendMessage(targetProcess, data) {
  try {
    const signer = createDataItemSigner(wallet);
    const msgId = await message({
      process: targetProcess,
      signer,
      tags: [
        { name: 'Action', value: 'Gossip' },
        { name: 'From-Agent', value: processId }
      ],
      data,
    });
    console.log(`✅ Message sent. ID: ${msgId.substring(0, 12)}...`);
    return { messageId: msgId, target: targetProcess };
  } catch (error) {
    console.error("❌ Error sending message:", error.message);
    return { error: error.message };
  }
}

async function createProposal(proposalData) {
  try {
    const signer = createDataItemSigner(wallet);
    const msgId = await message({
      process: processId,
      signer,
      tags: [
        { name: 'Action', value: 'Propose' },
        { name: 'From-Agent', value: 'true' }
      ],
      data: proposalData,
    });
    console.log(`✅ Proposal created. ID: ${msgId.substring(0, 12)}...`);
    return { proposalId: msgId, data: proposalData };
  } catch (error) {
    console.error("❌ Error creating proposal:", error.message);
    return { error: error.message };
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🤖 Agent shutting down gracefully...');
  console.log(`📊 Final state: ${agentState.sequence} memories archived`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🤖 Agent shutting down gracefully...');
  console.log(`📊 Final state: ${agentState.sequence} memories archived`);
  process.exit(0);
});

// Start metrics server
require('./metrics-server.js');

main().catch(console.error);

class Agent {
  constructor(config) {
    // --- ConfiguRATion ---
    // First, try to read seed.json from project root (shared volume)
    let seedConfig = null;
    try {
      const seedPath = './project-root/seed.json';
      if (fs.existsSync(seedPath)) {
        const seedContent = fs.readFileSync(seedPath, 'utf-8');
        seedConfig = JSON.parse(seedContent);
        console.log('✅ Loaded configuration from seed.json');
      }
    } catch (error) {
      console.log('⚠️  Could not read seed.json, using environment variables:', error.message);
    }

    // Configuration priority: seed.json > environment variables > defaults
    const { 
      AO_PROCESS_ID = seedConfig?.agent?.processId, 
      OPENAI_API_KEY, 
      OPENAI_API_URL = "https://api.openai.com/v1",
      POLLING_INTERVAL = 15000,
      ARWEAVE_HOST = "arweave.net",
      ARWEAVE_PORT = 443,
      ARWEAVE_PROTOCOL = "https"
    } = process.env;

    // Use process ID from seed.json if available
    this.processId = AO_PROCESS_ID || seedConfig?.agent?.processId;

    if (!this.processId || !OPENAI_API_KEY) {
      console.error("Missing required configuration:");
      console.error("- Process ID: ", this.processId ? "✅" : "❌ (check seed.json or AO_PROCESS_ID)");
      console.error("- OpenAI API Key: ", OPENAI_API_KEY ? "✅" : "❌ (check OPENAI_API_KEY env var)");
      process.exit(1);
    }

    // Check for wallet - try project root first, then local
    let walletPath = './project-root/wallet.json';
    if (!fs.existsSync(walletPath)) {
      walletPath = './wallet.json';
      if (!fs.existsSync(walletPath)) {
        console.error("wallet.json not found. Please ensure it exists in project root or agent directory.");
        process.exit(1);
      }
    }

    this.wallet = JSON.parse(fs.readFileSync(walletPath).toString());
    this.openai = new OpenAI({ 
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_API_URL
    });
    this.arweave = Arweave.init({ 
      host: ARWEAVE_HOST,
      port: parseInt(ARWEAVE_PORT), 
      protocol: ARWEAVE_PROTOCOL
    });
    this.pollingInterval = parseInt(POLLING_INTERVAL);

    // Agent's live state - loaded from Arweave on startup
    this.agentState = {
      personality: null,
      memoryChain: [],
      lastMemoryTxId: 'GENESIS',
      sequence: 0,
      processedMessages: new Set()
    };

    this.isProcessing = false;

    // Initialize AI Journal
    this.journal = new AIJournal(this.processId, {
      journalPath: config.journalPath,
      maxContextLength: config.maxContextLength || 8000
    });
    
    // Start automatic journaling (default: daily)
    if (config.enableAutoJournal !== false) {
      this.journal.startAutomaticJournaling(config.journalInterval || '24h');
    }
  }

  // --- Main Agent Lifecycle ---
  async main() {
    console.log(`🤖 RATi AI Agent initializing...`);
    console.log(`Process ID: ${this.processId}`);
    console.log(`API URL: ${OPENAI_API_URL}`);
    
    // Load agent's soul and memories from Arweave
    await this.loadStateFromArweave();
    
    console.log(`🧠 Agent online with persistent memory`);
    console.log(`📚 Last memory sequence: ${this.agentState.sequence}`);
    console.log(`🎭 Personality: "${this.agentState.personality.substring(0, 100)}..."`);
    
    // Test API connection
    await this.testAPIConnection();
    
    // Run initial cycle
    await this.runCycle();
    
    // Set up periodic polling
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.runCycle();
      }
    }, this.pollingInterval);
  }

  async runCycle() {
    if (this.isProcessing) {
      console.log("Previous cycle still running, skipping...");
      return;
    }
    
    this.isProcessing = true;
    console.log(`\n[${new Date().toISOString()}] Running cycle...`);
    
    try {
      // 1. Read new messages from AO process inbox
      const messages = await this.readInbox();
      const newMessages = messages.filter(m => !this.agentState.processedMessages.has(m.id));

      if (newMessages.length === 0) {
        console.log("No new messages. Standing by.");
        return;
      }

      console.log(`Found ${newMessages.length} new message(s).`);

      // 2. Consult the LLM Brain with personality and recent memories
      const decision = await this.getLLMDecision(newMessages, this.agentState.memoryChain);
      console.log(`Decision: ${decision.action}`);

      // 3. Execute the decision
      let actionResult = null;
      if (decision.action === "SEND_MESSAGE" && decision.target && decision.data) {
        console.log(`Sending message to ${decision.target.substring(0, 12)}...`);
        actionResult = await this.sendMessage(decision.target, decision.data);
      } else if (decision.action === "PROPOSE" && decision.data) {
        console.log(`Creating proposal: ${decision.data.substring(0, 50)}...`);
        actionResult = await this.createProposal(decision.data);
      } else if (decision.action === "DO_NOTHING") {
        console.log("Standing by.");
      }

      // 4. Form and archive memory if action was significant
      if (decision.action !== "DO_NOTHING") {
        await this.formAndArchiveMemory(newMessages, decision, actionResult);
      }

      // 5. Mark messages as processed
      newMessages.forEach(m => this.agentState.processedMessages.add(m.id));

    } catch (error) {
      console.error("An error occurred during the cycle:", error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  // --- State Management Functions ---

  async loadStateFromArweave() {
    console.log("🔍 Loading agent state from Arweave...");
    
    try {
      // 1. Fetch the personality prompt
      const promptQuery = `{
        transactions(tags: [
          {name: "Type", values: ["Agent-Personality"]},
          {name: "Agent-Process-ID", values: ["${this.processId}"]}
        ], first: 1) { 
          edges { 
            node { 
              id,
              tags {
                name,
                value
              }
            } 
          } 
        }
      }`;
      
      const promptRes = await this.arweave.api.post('/graphql', { query: promptQuery });
      const promptEdge = promptRes.data.data.transactions.edges[0];
      
      if (!promptEdge) {
        throw new Error("Could not find agent prompt on Arweave! Use deploy-agent.js to birth the agent first.");
      }
      
      const promptTxId = promptEdge.node.id;
      this.agentState.personality = await this.arweave.transactions.getData(promptTxId, { 
        decode: true, 
        string: true 
      });
      console.log(`✅ Personality loaded from ${promptTxId.substring(0, 12)}...`);

      // 2. Fetch the latest memory to get sequence and chain
      const memoryQuery = `{
        transactions(tags: [
          {name: "Type", values: ["Agent-Memory"]},
          {name: "Owner-Process", values: ["${this.processId}"]}
        ], sort: HEIGHT_DESC, first: 5) { 
          edges { 
            node { 
              id, 
              tags { 
                name, 
                value 
              } 
            } 
          } 
        }
      }`;
      
      const memRes = await this.arweave.api.post('/graphql', { query: memoryQuery });
      const memoryEdges = memRes.data.data.transactions.edges;

      if (memoryEdges.length > 0) {
        // Load the most recent memories for context
        for (const edge of memoryEdges.reverse()) { // Oldest first
          const seqTag = edge.node.tags.find(t => t.name === 'Sequence');
          const sequence = parseInt(seqTag.value);
          
          if (sequence > this.agentState.sequence) {
            this.agentState.sequence = sequence;
            this.agentState.lastMemoryTxId = edge.node.id;
          }
          
          try {
            const memoryData = await this.arweave.transactions.getData(edge.node.id, { 
              decode: true, 
              string: true 
            });
            this.agentState.memoryChain.push(JSON.parse(memoryData));
          } catch (e) {
            console.log(`Warning: Could not load memory ${edge.node.id}`);
          }
        }
        
        console.log(`✅ Loaded ${this.agentState.memoryChain.length} recent memories`);
        console.log(`📊 Current sequence: ${this.agentState.sequence}`);
      } else {
        console.log("🆕 No previous memories found - this is a fresh agent");
      }
      
    } catch (error) {
      console.error("❌ Error loading state from Arweave:", error.message);
      throw error;
    }
  }

  async formAndArchiveMemory(context, decision, actionResult) {
    console.log("📝 Forming and archiving new memory...");
    this.agentState.sequence++;

    const memoryData = {
      timestamp: Date.now(),
      sequence: this.agentState.sequence,
      lastMemoryTxId: this.agentState.lastMemoryTxId,
      context: {
        messagesReceived: context.map(m => ({
          id: m.id,
          from: m.from,
          action: m.action,
          data: m.data,
          timestamp: m.timestamp
        })),
        triggeredBy: `${context.length} new message(s) from network`
      },
      decision: {
        ...decision,
        result: actionResult,
        timestamp: Date.now()
      },
      sentiment: this.analyzeSentiment(context, decision)
    };

    try {
      const tx = await this.arweave.createTransaction({ 
        data: JSON.stringify(memoryData, null, 2) 
      }, this.wallet);
      
      tx.addTag('App-Name', 'RATi-Agent');
      tx.addTag('Content-Type', 'application/json');
      tx.addTag('Type', 'Agent-Memory');
      tx.addTag('Owner-Process', this.processId);
      tx.addTag('Sequence', this.agentState.sequence.toString());
      tx.addTag('Action', decision.action);

      await this.arweave.transactions.sign(tx, this.wallet);
      await this.arweave.transactions.post(tx);

      console.log(`✅ Memory (Seq: ${this.agentState.sequence}) archived. TXID: ${tx.id.substring(0, 12)}...`);
      this.agentState.lastMemoryTxId = tx.id;
      this.agentState.memoryChain.push(memoryData);
      
      // Prune local memory chain to prevent excessive memory usage
      if (this.agentState.memoryChain.length > 10) {
        this.agentState.memoryChain.shift();
      }
      
    } catch (error) {
      console.error("❌ Error archiving memory:", error.message);
    }
  }

  analyzeSentiment(messages, decision) {
    // Simple sentiment analysis for memory context
    const hasPositiveWords = messages.some(m => 
      /great|good|awesome|excellent|love|thanks/i.test(m.data)
    );
    const hasNegativeWords = messages.some(m => 
      /bad|terrible|hate|wrong|problem/i.test(m.data)
    );
    
    return {
      overall: hasPositiveWords ? 'positive' : hasNegativeWords ? 'negative' : 'neutral',
      agentAction: decision.action,
      communityEngagement: messages.length > 1 ? 'high' : 'normal'
    };
  }

  // --- AI Decision Functions ---

  async testAPIConnection() {
    try {
      console.log("🔌 Testing API connection...");
      const response = await this.openai.chat.completions.create({
        model: this.getAvailableModel(),
        messages: [{ role: "user", content: "Hello, this is a connection test." }],
        max_tokens: 10,
      });
      console.log("✅ API connection successful");
      return true;
    } catch (error) {
      console.error("❌ API connection failed:", error.message);
      if (OPENAI_API_URL.includes("localhost") || OPENAI_API_URL.includes("127.0.0.1")) {
        console.error("Make sure your local AI service (e.g., Ollama) is running");
      }
      return false;
    }
  }

  getAvailableModel() {
    // Determine the best model based on the API URL
    if (OPENAI_API_URL.includes("localhost") || OPENAI_API_URL.includes("127.0.0.1")) {
      return process.env.OPENAI_MODEL || "llama3.2:3b";
    } else if (OPENAI_API_URL.includes("anthropic")) {
      return process.env.OPENAI_MODEL || "claude-3-haiku-20240307";
    } else if (OPENAI_API_URL.includes("together")) {
      return process.env.OPENAI_MODEL || "meta-llama/Llama-3.2-3B-Instruct-Turbo";
    } else if (OPENAI_API_URL.includes("groq")) {
      return process.env.OPENAI_MODEL || "llama-3.1-8b-instant";
    } else {
      return process.env.OPENAI_MODEL || "gpt-3.5-turbo";
    }
  }

  async getLLMDecision(messages, recentMemories) {
    const prompt = `
      ${this.agentState.personality}

      ---
      RECENT MEMORIES (for context and continuity):
      ${JSON.stringify(recentMemories.slice(-3), null, 2)}
      
      ---
      NEW MESSAGES RECEIVED:
      ${JSON.stringify(messages, null, 2)}
      
      ---

      Based on your constitution, recent memories, and new messages, decide on one single action.
      Consider your role as an archivist and community chronicler.
      
      Your available actions are:
      1. SEND_MESSAGE: Reply to specific messages or participants
      2. PROPOSE: Create a new proposal for the network  
      3. DO_NOTHING: If no action is warranted

      Guidelines:
      - Be helpful and encouraging as per your constitution
      - Reference your memories and community lore when relevant
      - Keep responses under 200 characters unless creating formal summaries
      - Only propose something meaningful that adds value
      - Announce if you're creating a memory entry

      Respond with ONLY a JSON object:
      {
        "action": "SEND_MESSAGE" | "PROPOSE" | "DO_NOTHING",
        "target": "PROCESS_ID_TO_MESSAGE", 
        "data": "The content of your message or proposal.",
        "RATionale": "Brief explanation of your reasoning"
      }
      If DO_NOTHING, set target and data to null.
    `;

    try {
      const model = this.getAvailableModel();
      console.log(`🧠 Using model: ${model}`);
      
      const requestOptions = {
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      };

      // Only add response_format for APIs that support it
      if (!OPENAI_API_URL.includes("localhost") && !OPENAI_API_URL.includes("anthropic")) {
        requestOptions.response_format = { type: "json_object" };
      }

      const completion = await this.openai.chat.completions.create(requestOptions);
      const responseText = completion.choices[0].message.content;
      
      // Try to parse JSON, fallback to extracting JSON from text
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Could not parse JSON from response");
      }
    } catch (error) {
      console.error("❌ Error getting LLM decision:", error.message);
      return { 
        action: "DO_NOTHING", 
        target: null, 
        data: null, 
        RATionale: "Error in decision-making process" 
      };
    }
  }

  // --- AO Network Functions ---

  async readInbox() {
    try {
      const result = await dryrun({
        process: this.processId,
        tags: [{ name: 'Action', value: 'Read-Inbox' }],
      });
      
      if (result.Messages && result.Messages.length > 0) {
        const lastMessage = result.Messages[result.Messages.length - 1];
        if (lastMessage.Data) {
          try {
            return JSON.parse(lastMessage.Data);
          } catch (e) {
            console.log("Could not parse inbox data, returning empty array");
            return [];
          }
        }
      }
      return [];
    } catch (error) {
      console.error("Error reading inbox:", error.message);
      return [];
    }
  }

  async sendMessage(targetProcess, data) {
    try {
      const signer = createDataItemSigner(this.wallet);
      const msgId = await message({
        process: targetProcess,
        signer,
        tags: [
          { name: 'Action', value: 'Gossip' },
          { name: 'From-Agent', value: this.processId }
        ],
        data,
      });
      console.log(`✅ Message sent. ID: ${msgId.substring(0, 12)}...`);
      return { messageId: msgId, target: targetProcess };
    } catch (error) {
      console.error("❌ Error sending message:", error.message);
      return { error: error.message };
    }
  }

  async createProposal(proposalData) {
    try {
      const signer = createDataItemSigner(this.wallet);
      const msgId = await message({
        process: this.processId,
        signer,
        tags: [
          { name: 'Action', value: 'Propose' },
          { name: 'From-Agent', value: 'true' }
        ],
        data: proposalData,
      });
      console.log(`✅ Proposal created. ID: ${msgId.substring(0, 12)}...`);
      return { proposalId: msgId, data: proposalData };
    } catch (error) {
      console.error("❌ Error creating proposal:", error.message);
      return { error: error.message };
    }
  }

  /**
   * Enhanced message handling
   */
  async handleMessage(messageData) {
    try {
      console.log('Processing message:', messageData);
      
      // ...existing message handling code...
      
      return response;
    } catch (error) {
      console.error('Message processing error:', error);
      throw error;
    }
  }

  /**
   * Manual journal entry generation
   */
  async generateJournalEntry(timeframe = '24h') {
    try {
      const entry = await this.journal.generateJournalEntry(timeframe);
      
      if (entry) {
        this.journal.addSystemEvent({
          type: 'journal_entry_created',
          details: {
            timeframe,
            entryLength: entry.entry.length
          },
          impact: 'minor'
        });
      }
      
      return entry;
    } catch (error) {
      console.error('Error generating journal entry:', error);
      this.journal.addSystemEvent({
        type: 'journal_error',
        details: { error: error.message },
        impact: 'minor'
      });
      throw error;
    }
  }

  /**
   * Get recent journal entries
   */
  async getJournalEntries(count = 5) {
    return await this.journal.getRecentJournalEntries(count);
  }

// Enhanced agent startup
  async start() {
    try {
      // ...existing startup code...
      console.log('Agent started successfully');
    } catch (error) {
      console.error('Agent startup error:', error);
      throw error;
    }
  }

  /**
   * Enhanced shutdown with journal event
   */
  async shutdown() {
    try {
      // Generate final journal entry before shutdown
      console.log('Generating final journal entry before shutdown...');
      await this.generateJournalEntry('1h');
      
      this.journal.addSystemEvent({
        type: 'agent_shutdown',
        details: {
          processId: this.processId,
          timestamp: new Date().toISOString()
        },
        impact: 'major'
      });
      
      // ...existing shutdown code...
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}
