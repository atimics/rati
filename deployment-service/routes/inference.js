import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * AI Inference Endpoint
 * 
 * Connects to various AI services (Ollama, OpenAI, etc.) to provide
 * text generation capabilities for character creation and chat responses.
 */

// Configuration for AI services
const AI_SERVICES = {
  ollama: {
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama2'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  }
};

// Determine which AI service to use
const getActiveService = () => {
  if (process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL) {
    return 'ollama';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return 'ollama'; // Default to Ollama
};

/**
 * Call Ollama API
 */
const callOllama = async (prompt, system = '', options = {}) => {
  const config = AI_SERVICES.ollama;
  
  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: system ? `${system}\n\n${prompt}` : prompt,
        system: system || undefined,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 500,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama API call failed:', error);
    throw error;
  }
};

/**
 * Call OpenAI API
 */
const callOpenAI = async (prompt, system = '', options = {}) => {
  const config = AI_SERVICES.openai;
  
  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const messages = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 500,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    throw error;
  }
};

/**
 * POST /api/inference
 * Generate text using the configured AI service
 */
router.post('/', async (req, res) => {
  try {
    const { prompt, system, ...options } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required'
      });
    }

    const activeService = getActiveService();
    let response;

    switch (activeService) {
      case 'ollama':
        response = await callOllama(prompt, system, options);
        break;
      case 'openai':
        response = await callOpenAI(prompt, system, options);
        break;
      default:
        throw new Error(`Unsupported AI service: ${activeService}`);
    }

    res.json({
      success: true,
      response,
      service: activeService,
      model: AI_SERVICES[activeService].model
    });

  } catch (error) {
    console.error('Inference error:', error);
    
    // If primary service fails, try fallback
    if (error.message.includes('Ollama') && process.env.OPENAI_API_KEY) {
      try {
        const response = await callOpenAI(req.body.prompt, req.body.system, req.body);
        return res.json({
          success: true,
          response,
          service: 'openai',
          model: AI_SERVICES.openai.model,
          fallback: true
        });
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }

    res.status(500).json({
      error: 'Inference failed',
      message: error.message,
      service: getActiveService()
    });
  }
});

/**
 * GET /api/inference/status
 * Check the status of configured AI services
 */
router.get('/status', async (req, res) => {
  const status = {
    activeService: getActiveService(),
    services: {}
  };

  // Check Ollama
  try {
    const ollamaResponse = await fetch(`${AI_SERVICES.ollama.baseUrl}/api/tags`);
    status.services.ollama = {
      available: ollamaResponse.ok,
      url: AI_SERVICES.ollama.baseUrl,
      model: AI_SERVICES.ollama.model
    };
  } catch (error) {
    status.services.ollama = {
      available: false,
      error: error.message,
      url: AI_SERVICES.ollama.baseUrl
    };
  }

  // Check OpenAI
  status.services.openai = {
    available: !!AI_SERVICES.openai.apiKey,
    configured: !!process.env.OPENAI_API_KEY,
    model: AI_SERVICES.openai.model
  };

  res.json(status);
});

export default router;
