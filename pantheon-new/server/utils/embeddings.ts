/**
 * Embeddings — Pantheon Server
 * Wrapper around Google Gemini Embedding API (gemini-embedding-001).
 * Uses the free tier GOOGLE_AI_API_KEY already configured in nuxt.config.
 */

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768; // MRL supports 768, 1536, 3072 — we use 768 for compact storage
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Rate limiting: free tier allows ~100 requests/minute
const RATE_LIMIT_DELAY_MS = 650; // ~92 req/min, safe margin
let lastRequestTime = 0;

/**
 * Wait to respect rate limits.
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Generate an embedding vector for a single text string.
 * Returns a 768-dimensional float array.
 */
export async function embedText(text: string, apiKey: string): Promise<number[]> {
  await rateLimit();

  const url = `${API_BASE}/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: text.substring(0, 8000) }] // API limit ~10k chars, be safe
      },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as any;

  if (!data.embedding?.values || !Array.isArray(data.embedding.values)) {
    throw new Error(`Unexpected embedding response format: ${JSON.stringify(data).substring(0, 200)}`);
  }

  const values: number[] = data.embedding.values;

  if (values.length !== EMBEDDING_DIMENSIONS) {
    console.warn(`[EMBEDDINGS] Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${values.length}`);
  }

  return values;
}

/**
 * Generate embeddings for multiple texts in batch.
 * Uses the batchEmbedContents endpoint for efficiency.
 * Max 100 texts per batch call.
 */
export async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) return [await embedText(texts[0], apiKey)];

  // Gemini batch limit is 100
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    await rateLimit();

    const url = `${API_BASE}/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map(text => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: {
            parts: [{ text: text.substring(0, 8000) }]
          },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Batch embedding API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as any;

    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error(`Unexpected batch response format: ${JSON.stringify(data).substring(0, 200)}`);
    }

    for (const emb of data.embeddings) {
      if (!emb.values || !Array.isArray(emb.values)) {
        throw new Error('Missing values in batch embedding response');
      }
      allEmbeddings.push(emb.values);
    }
  }

  return allEmbeddings;
}

/**
 * Get the embedding dimensions used by this module.
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Get the model name used.
 */
export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}
