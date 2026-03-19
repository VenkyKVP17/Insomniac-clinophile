/**
 * Gemini Encasement Service v2
 *
 * Uses Google AI API directly (not gemini CLI)
 * Provides REST API for AI inference with your Google AI API key
 */

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.GEMINI_SERVICE_PORT || 3500;
const API_KEY = process.env.GEMINI_SERVICE_API_KEY || 'your-secret-key-here';
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;

if (!GOOGLE_AI_KEY) {
  console.error('❌ ERROR: GOOGLE_AI_API_KEY environment variable is required!');
  process.exit(1);
}

// Initialize Google AI
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);

// In-memory queue and session storage
const requestQueue = [];
let isProcessing = false;

// Usage statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokensEstimated: 0,
  averageResponseTime: 0,
};

/**
 * Call Google AI API
 */
async function callGoogleAI(prompt, options = {}) {
  const startTime = Date.now();

  try {
    const modelName = options.model || 'gemini-2.0-flash-exp';
    const model = genAI.getGenerativeModel({ model: modelName });

    const generationConfig = {
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      maxOutputTokens: options.maxTokens || 2048,
    };

    console.log(`[GOOGLE-AI] Calling ${modelName}...`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();
    const duration = Date.now() - startTime;

    console.log(`[GOOGLE-AI] Success in ${duration}ms, output length: ${text.length}`);

    // Update stats
    stats.successfulRequests++;
    stats.totalTokensEstimated += Math.ceil((prompt.length + text.length) / 4);
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.successfulRequests - 1) + duration) /
      stats.successfulRequests;

    return {
      success: true,
      output: text,
      duration,
      model: modelName,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[GOOGLE-AI] Error after ${duration}ms:`, error.message);
    stats.failedRequests++;
    throw error;
  }
}

/**
 * Process request queue
 */
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (requestQueue.length > 0) {
    const { id, prompt, options, resolve, reject } = requestQueue.shift();

    console.log(`[QUEUE] Processing request ${id} (${requestQueue.length} remaining)`);

    try {
      const result = await callGoogleAI(prompt, options);
      resolve(result);
    } catch (error) {
      reject(error);
    }

    // Rate limiting: wait 500ms between requests
    if (requestQueue.length > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  isProcessing = false;
}

/**
 * Queue a request
 */
function queueRequest(prompt, options = {}) {
  const id = crypto.randomBytes(8).toString('hex');

  return new Promise((resolve, reject) => {
    requestQueue.push({ id, prompt, options, resolve, reject });
    console.log(`[QUEUE] Added request ${id}, queue size: ${requestQueue.length}`);

    // Start processing if not already running
    setImmediate(() => processQueue());
  });
}

// ============================================================================
// API ROUTES
// ============================================================================

function authenticateAPIKey(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '');

  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gemini-encasement-v2',
    backend: 'google-ai-api',
    queue: requestQueue.length,
    processing: isProcessing,
    stats,
  });
});

/**
 * OpenAI-compatible chat completions
 */
app.post('/v1/chat/completions', authenticateAPIKey, async (req, res) => {
  stats.totalRequests++;

  try {
    const { messages, model, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const prompt = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const result = await queueRequest(prompt, {
      model,
      temperature,
      maxTokens: max_tokens,
    });

    res.json({
      id: `chatcmpl-${crypto.randomBytes(16).toString('hex')}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model || model || 'gemini-2.0-flash-exp',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.output,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(result.output.length / 4),
        total_tokens: Math.ceil((prompt.length + result.output.length) / 4),
      },
      duration_ms: result.duration,
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error',
      },
    });
  }
});

/**
 * Simple completion
 */
app.post('/v1/completions', authenticateAPIKey, async (req, res) => {
  stats.totalRequests++;

  try {
    const { prompt, model, temperature, max_tokens } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const result = await queueRequest(prompt, {
      model,
      temperature,
      maxTokens: max_tokens,
    });

    res.json({
      id: `cmpl-${crypto.randomBytes(16).toString('hex')}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model || model || 'gemini-2.0-flash-exp',
      choices: [
        {
          text: result.output,
          index: 0,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(result.output.length / 4),
        total_tokens: Math.ceil((prompt.length + result.output.length) / 4),
      },
      duration_ms: result.duration,
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error',
      },
    });
  }
});

/**
 * Pantheon-specific endpoint
 */
app.post('/api/infer', authenticateAPIKey, async (req, res) => {
  stats.totalRequests++;

  try {
    const { prompt, temperature, max_tokens, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const result = await queueRequest(prompt, {
      model,
      temperature,
      maxTokens: max_tokens,
    });

    res.json({
      success: true,
      response: result.output,
      duration_ms: result.duration,
      model: result.model,
      tokens_estimated: Math.ceil((prompt.length + result.output.length) / 4),
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/stats', authenticateAPIKey, (req, res) => {
  res.json({
    ...stats,
    queueSize: requestQueue.length,
    isProcessing,
    uptime: process.uptime(),
  });
});

app.post('/api/admin/clear-queue', authenticateAPIKey, (req, res) => {
  const clearedCount = requestQueue.length;
  requestQueue.length = 0;

  res.json({
    success: true,
    message: `Cleared ${clearedCount} requests from queue`,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     🤖 GEMINI ENCASEMENT SERVICE v2 RUNNING           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Port:        ${PORT}`);
  console.log(`  Backend:     Google AI API`);
  console.log(`  API Key:     ${API_KEY.substring(0, 8)}...`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    POST /v1/chat/completions    (OpenAI-compatible)');
  console.log('    POST /v1/completions         (Simple completion)');
  console.log('    POST /api/infer              (Pantheon format)');
  console.log('    GET  /health                 (Health check)');
  console.log('    GET  /api/stats              (Usage stats)');
  console.log('');
});
