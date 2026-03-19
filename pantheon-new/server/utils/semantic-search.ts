/**
 * Semantic Search — Pantheon Server
 * Orchestration layer: embed query → KNN search → hybrid rank → return results.
 * This is the main interface for NYX to perform semantic vault search.
 */

import { embedText } from './embeddings';
import { searchVectors, getChunkCount, type SearchResult } from './vector-db';

export interface SemanticSearchResult extends SearchResult {
  /** Hybrid score combining vector similarity and keyword boost */
  score: number;
  /** Shortened file path (relative to vault) */
  relativePath: string;
}

/**
 * Perform a semantic search across the indexed vault.
 *
 * 1. Embed the query using Gemini API
 * 2. Run KNN search in sqlite-vec
 * 3. Apply keyword boost for hybrid scoring
 * 4. Return ranked results
 */
export async function semanticSearch(
  query: string,
  apiKey: string,
  options?: {
    topK?: number;
    minSimilarity?: number;
    vaultPath?: string;
  }
): Promise<SemanticSearchResult[]> {
  const topK = options?.topK ?? 5;
  const minSimilarity = options?.minSimilarity ?? 0.1;
  const vaultPath = options?.vaultPath ?? '/home/ubuntu/vp';

  // Check if index has any data
  const totalChunks = getChunkCount();
  if (totalChunks === 0) {
    console.log('[SEMANTIC-SEARCH] No indexed chunks found. Run vault indexing first.');
    return [];
  }

  // 1. Embed the query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query, apiKey);
  } catch (err) {
    console.error('[SEMANTIC-SEARCH] Failed to embed query:', err);
    return [];
  }

  // 2. KNN search — fetch more than topK to allow filtering
  const rawResults = searchVectors(queryEmbedding, topK * 2);

  if (rawResults.length === 0) {
    return [];
  }

  // 3. Hybrid scoring: combine vector similarity with keyword boost
  const queryTerms = extractKeywords(query);

  const scored: SemanticSearchResult[] = rawResults.map(r => {
    const keywordBoost = calculateKeywordBoost(r.content, queryTerms);
    const hybridScore = (r.similarity * 0.75) + (keywordBoost * 0.25);

    // Strip vault path prefix for cleaner display
    const relativePath = r.file_path.startsWith(vaultPath)
      ? r.file_path.substring(vaultPath.length + 1)
      : r.file_path;

    return {
      ...r,
      score: hybridScore,
      relativePath,
    };
  });

  // 4. Sort by hybrid score, filter by minimum similarity, limit to topK
  return scored
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Extract meaningful keywords from a query string.
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'shall',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'about', 'what', 'which', 'who', 'whom',
    'this', 'that', 'these', 'those', 'it', 'its', 'my', 'your',
    'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them',
    'i', 'you', 'he', 'she', 'we', 'they', 'how', 'when', 'where',
    'why', 'if', 'because', 'until', 'while',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word));
}

/**
 * Calculate a keyword match boost score (0-1).
 * Simple BM25-lite: fraction of query keywords found in the text.
 */
function calculateKeywordBoost(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let matches = 0;

  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      matches++;
    }
  }

  return matches / queryTerms.length;
}

/**
 * Format search results into a context string for NYX's prompt.
 */
export function formatResultsForContext(results: SemanticSearchResult[]): string {
  if (results.length === 0) return '';

  let context = '\n### 🧠 Semantic Memory (Vector Search):\n';

  for (const r of results) {
    const scorePercent = Math.round(r.score * 100);
    context += `\n*${r.relativePath}* (${scorePercent}% match):\n`;
    context += `${r.content.substring(0, 400)}${r.content.length > 400 ? '...' : ''}\n`;
  }

  return context;
}
