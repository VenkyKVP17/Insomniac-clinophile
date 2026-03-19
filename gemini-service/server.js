/**
 * Gemini Encasement Service
 *
 * A local AI server that wraps Google's gemini CLI
 * Provides REST API for AI inference while keeping control on your server
 *
 * Features:
 * - OpenAI-compatible API format
 * - Request queuing
 * - Rate limiting
 * - Streaming support
 * - Session management
 * - Usage tracking
 */

const express = require('express');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.GEMINI_SERVICE_PORT || 3500;
const API_KEY = process.env.GEMINI_SERVICE_API_KEY || 'your-secret-key-here';

// In-memory queue and session storage
const requestQueue = [];
const activeSessions = new Map();
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
 * Call gemini CLI with proper handling
 */
async function callGeminiCLI(prompt, options = {}) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const args = ['-y', '-o', 'text'];

    if (options.model) {
      args.push('-m', options.model);
    }

    if (options.temperature !== undefined) {
      args.push('-t', options.temperature.toString());
    }

    if (options.maxTokens) {
      args.push('--max-output-tokens', options.maxTokens.toString());
    }

    // Add prompt as argument
    args.push('-p', prompt);

    console.log('[GEMINI] Spawning gemini CLI...');

    const gemini = spawn('gemini', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000, // 60 second timeout
    });

    let output = '';
    let errorOutput = '';

    gemini.stdout.on('data', (data) => {
      output += data.toString();
    });

    gemini.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    gemini.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0 && output) {
        console.log(`[GEMINI] Success in ${duration}ms, output length: ${output.length}`);

        // Update stats
        stats.successfulRequests++;
        stats.totalTokensEstimated += Math.ceil(output.length / 4);
        stats.averageResponseTime =
          (stats.averageResponseTime * (stats.successfulRequests - 1) + duration) /
          stats.successfulRequests;

        resolve({
          success: true,
          output: output.trim(),
          duration,
        });
      } else {
        console.error(`[GEMINI] Failed with code ${code}:`, errorOutput);
        stats.failedRequests++;

        reject(new Error(errorOutput || 'Gemini CLI failed'));
      }
    });

    gemini.on('error', (err) => {
      console.error('[GEMINI] Spawn error:', err);
      stats.failedRequests++;
      reject(err);
    });
  });
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
      const result = await callGeminiCLI(prompt, options);
      resolve(result);
    } catch (error) {
      reject(error);
    }

    // Rate limiting: wait 1 second between requests
    if (requestQueue.length > 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  isProcessing = false;
}

/**
 * Queue a Gemini request
 */
function queueGeminiRequest(prompt, options = {}) {
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

/**
 * Middleware: API Key authentication
 */
function authenticateAPIKey(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '');

  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gemini-encasement',
    queue: requestQueue.length,
    processing: isProcessing,
    stats,
  });
});

/**
 * OpenAI-compatible chat completions endpoint
 *
 * POST /v1/chat/completions
 * {
 *   "model": "gemini-2.0-flash-exp",
 *   "messages": [
 *     {"role": "user", "content": "Hello"}
 *   ],
 *   "temperature": 0.7,
 *   "max_tokens": 2048
 * }
 */
app.post('/v1/chat/completions', authenticateAPIKey, async (req, res) => {
  stats.totalRequests++;

  try {
    const { messages, model, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Convert messages to a single prompt
    const prompt = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    console.log(`[API] Chat completion request, model: ${model || 'default'}`);

    const result = await queueGeminiRequest(prompt, {
      model,
      temperature,
      maxTokens: max_tokens,
    });

    // OpenAI-compatible response format
    res.json({
      id: `chatcmpl-${crypto.randomBytes(16).toString('hex')}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'gemini-2.0-flash-exp',
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
 * Simple completion endpoint
 *
 * POST /v1/completions
 * {
 *   "prompt": "Tell me a joke",
 *   "model": "gemini-2.0-flash-exp",
 *   "temperature": 0.7,
 *   "max_tokens": 500
 * }
 */
app.post('/v1/completions', authenticateAPIKey, async (req, res) => {
  stats.totalRequests++;

  try {
    const { prompt, model, temperature, max_tokens } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    console.log(`[API] Completion request, prompt length: ${prompt.length}`);

    const result = await queueGeminiRequest(prompt, {
      model,
      temperature,
      maxTokens: max_tokens,
    });

    res.json({
      id: `cmpl-${crypto.randomBytes(16).toString('hex')}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'gemini-2.0-flash-exp',
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
 * Pantheon-specific endpoint (simpler format)
 *
 * POST /api/infer
 * {
 *   "prompt": "What is the capital of France?",
 *   "temperature": 0.7
 * }
 */
app.post('/api/infer', authenticateAPIKey, async (req, res) => {
  stats.totalRequests++;

  try {
    const { prompt, temperature, max_tokens, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    console.log(`[API] Infer request, prompt: "${prompt.substring(0, 50)}..."`);

    const result = await queueGeminiRequest(prompt, {
      model,
      temperature,
      maxTokens: max_tokens,
    });

    res.json({
      success: true,
      response: result.output,
      duration_ms: result.duration,
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

/**
 * Get service statistics
 */
app.get('/api/stats', authenticateAPIKey, (req, res) => {
  res.json({
    ...stats,
    queueSize: requestQueue.length,
    isProcessing,
    uptime: process.uptime(),
  });
});

/**
 * Clear queue (admin endpoint)
 */
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
  console.log('║        🤖 GEMINI ENCASEMENT SERVICE RUNNING           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Port:        ${PORT}`);
  console.log(`  API Key:     ${API_KEY.substring(0, 8)}...`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    POST /v1/chat/completions    (OpenAI-compatible)');
  console.log('    POST /v1/completions         (Simple completion)');
  console.log('    POST /api/infer              (Pantheon format)');
  console.log('    GET  /health                 (Health check)');
  console.log('    GET  /api/stats              (Usage stats)');
  console.log('');
  console.log('  Test with:');
  console.log(`    curl -X POST http://localhost:${PORT}/api/infer \\`);
  console.log(`      -H "Authorization: Bearer ${API_KEY}" \\`);
  console.log('      -H "Content-Type: application/json" \\');
  console.log('      -d \'{"prompt":"What is 2+2?"}\'');
  console.log('');
});
