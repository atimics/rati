import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL || "https://api.openai.com/v1"
});

/**
 * Generate a completion using the configured AI provider
 */
export async function generateCompletion(prompt, options = {}) {
  const {
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt = null,
    model = getDefaultModel()
  } = options;

  try {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating completion:', error);
    throw error;
  }
}

/**
 * Get the default model based on the API URL
 */
export function getDefaultModel() {
  const apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1";
  
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    return process.env.OPENAI_MODEL || "llama3.2:3b";
  } else if (apiUrl.includes("anthropic")) {
    return "claude-3-sonnet-20240229";
  } else {
    return "gpt-4";
  }
}

/**
 * Generate a streaming completion
 */
export async function generateStreamingCompletion(prompt, options = {}) {
  const {
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt = null,
    model = getDefaultModel(),
    onChunk = null
  } = options;

  try {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const stream = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true
    });

    let fullResponse = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      
      if (onChunk && content) {
        onChunk(content);
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('Error generating streaming completion:', error);
    throw error;
  }
}
