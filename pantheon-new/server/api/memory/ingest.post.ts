import { defineEventHandler, readBody, createError } from 'h3';
import { saveMemory, embedPendingMemories } from '../../utils/memory-store';

/**
 * POST /api/memory/ingest
 *
 * Ingest external data (emails, SMS, calendar events, etc.) into NYX's memory.
 * This endpoint accepts various data types and stores them in the vector database.
 *
 * Authentication: X-API-Key header
 *
 * Body:
 * {
 *   type: 'email' | 'sms' | 'calendar' | 'task' | 'telegram' | 'note',
 *   items: Array<{
 *     timestamp: string (ISO 8601),
 *     content: string,
 *     metadata?: {
 *       from?: string,
 *       to?: string,
 *       subject?: string,
 *       title?: string,
 *       participants?: string[],
 *       location?: string,
 *       priority?: string,
 *       [key: string]: any
 *     }
 *   }>
 * }
 *
 * Returns:
 * {
 *   success: boolean,
 *   ingested: number,
 *   embedded: number,
 *   errors: string[]
 * }
 */

interface IngestItem {
  timestamp: string;
  content: string;
  metadata?: Record<string, any>;
}

interface IngestRequest {
  type: 'email' | 'sms' | 'calendar' | 'task' | 'telegram' | 'note';
  items: IngestItem[];
  autoEmbed?: boolean;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  // Authentication
  const apiKey = event.node.req.headers['x-api-key'];
  if (apiKey !== config.pantheonApiKey) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody<IngestRequest>(event);

  if (!body.type || !body.items || !Array.isArray(body.items)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request: type and items[] are required'
    });
  }

  console.log(`[MEMORY-INGEST] Processing ${body.items.length} ${body.type} items`);

  const errors: string[] = [];
  let ingested = 0;

  try {
    for (const item of body.items) {
      try {
        // Format the data based on type for better memory storage
        const formattedContent = formatDataForMemory(body.type, item);

        // Save to memory store
        // We use a formatted "system" message as the user message and the content as the response
        // This allows searching through all your data via the same memory system
        saveMemory(formattedContent.userMessage, formattedContent.nyxResponse);
        ingested++;
      } catch (err: any) {
        console.error(`[MEMORY-INGEST] Failed to ingest item:`, err.message);
        errors.push(`Failed to ingest item at ${item.timestamp}: ${err.message}`);
      }
    }

    // Auto-embed if requested (default: yes)
    let embedded = 0;
    if (body.autoEmbed !== false) {
      try {
        const googleKey = config.googleApi as string;
        if (googleKey) {
          embedded = await embedPendingMemories(googleKey, Math.min(body.items.length, 20));
        }
      } catch (err: any) {
        console.error('[MEMORY-INGEST] Embedding failed:', err.message);
        errors.push(`Embedding failed: ${err.message}`);
      }
    }

    console.log(`[MEMORY-INGEST] Success: ${ingested}/${body.items.length} ingested, ${embedded} embedded`);

    return {
      success: true,
      ingested,
      embedded,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error('[MEMORY-INGEST] Error:', error.message);
    throw createError({
      statusCode: 500,
      statusMessage: `Ingestion failed: ${error.message}`
    });
  }
});

/**
 * Format different data types into user/NYX message pairs
 */
function formatDataForMemory(
  type: string,
  item: IngestItem
): { userMessage: string; nyxResponse: string } {
  const timestamp = new Date(item.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  switch (type) {
    case 'email': {
      const from = item.metadata?.from || 'Unknown';
      const to = item.metadata?.to || 'VPK';
      const subject = item.metadata?.subject || '(no subject)';

      return {
        userMessage: `[EMAIL RECEIVED] On ${timestamp}\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}`,
        nyxResponse: item.content,
      };
    }

    case 'sms': {
      const from = item.metadata?.from || 'Unknown';
      const to = item.metadata?.to || 'VPK';

      return {
        userMessage: `[SMS] On ${timestamp}\nFrom: ${from}\nTo: ${to}`,
        nyxResponse: item.content,
      };
    }

    case 'calendar': {
      const title = item.metadata?.title || 'Event';
      const location = item.metadata?.location ? `\nLocation: ${item.metadata.location}` : '';
      const participants = item.metadata?.participants?.length
        ? `\nParticipants: ${item.metadata.participants.join(', ')}`
        : '';

      return {
        userMessage: `[CALENDAR EVENT] ${title}\nTime: ${timestamp}${location}${participants}`,
        nyxResponse: item.content || `Event: ${title}`,
      };
    }

    case 'task': {
      const title = item.metadata?.title || 'Task';
      const priority = item.metadata?.priority ? `\nPriority: ${item.metadata.priority}` : '';
      const dueDate = item.metadata?.due ? `\nDue: ${item.metadata.due}` : '';

      return {
        userMessage: `[TASK] ${title}\nCreated: ${timestamp}${priority}${dueDate}`,
        nyxResponse: item.content || `Task: ${title}`,
      };
    }

    case 'telegram': {
      const from = item.metadata?.from || 'VPK';
      const chatName = item.metadata?.chat_name ? ` (${item.metadata.chat_name})` : '';

      return {
        userMessage: `[TELEGRAM${chatName}] ${from} on ${timestamp}`,
        nyxResponse: item.content,
      };
    }

    case 'note': {
      const title = item.metadata?.title ? `${item.metadata.title}\n` : '';

      return {
        userMessage: `[NOTE] Created on ${timestamp}\n${title}`,
        nyxResponse: item.content,
      };
    }

    default:
      return {
        userMessage: `[${type.toUpperCase()}] On ${timestamp}`,
        nyxResponse: item.content,
      };
  }
}
