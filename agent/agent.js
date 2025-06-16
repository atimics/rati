import 'dotenv/config';
import { createDataItemSigner, message, dryrun } from '@permaweb/aoconnect';
import OpenAI from 'openai';
import fs from 'fs';
import Arweave from 'arweave';

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

    // 2. Consult the LLM Brain with personality and recent memories
    const decision = await getLLMDecision(newMessages, agentState.memoryChain);
    console.log(`Decision: ${decision.action}`);

    // 3. Execute the decision
    let actionResult = null;
    if (decision.action === "SEND_MESSAGE" && decision.target && decision.data) {
      console.log(`Sending message to ${decision.target.substring(0, 12)}...`);
      actionResult = await sendMessage(decision.target, decision.data);
    } else if (decision.action === "PROPOSE" && decision.data) {
      console.log(`Creating proposal: ${decision.data.substring(0, 50)}...`);
      actionResult = await createProposal(decision.data);
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
  const prompt = `
    ${agentState.personality}

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
    const model = getAvailableModel();
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

main().catch(console.error);
