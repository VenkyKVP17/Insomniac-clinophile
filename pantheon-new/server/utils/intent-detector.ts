/**
 * Intent Detection System
 * Detects user intentions from natural language messages
 */

export interface Intent {
  type: 'email' | 'calendar' | 'task' | 'search' | 'reminder' | 'general';
  confidence: number; // 0-1
  entities: {
    recipient?: string;
    subject?: string;
    body?: string;
    date?: string;
    time?: string;
    query?: string;
  };
  rawMessage: string;
}

/**
 * Detect Gmail/email intent from user message
 */
export function detectEmailIntent(message: string): Intent | null {
  const msg = message.toLowerCase();

  // Email trigger patterns
  const emailPatterns = [
    /\b(email|mail|send|write to|message|reply to)\b/i,
    /\b(compose|draft)\b.*\b(email|mail)\b/i,
    /\b(tell|inform|let.*know|notify)\b.*\b(via email|by email|through email)\b/i,
    /@[\w.-]+\.\w+/i, // Email address present
  ];

  const hasEmailIntent = emailPatterns.some(pattern => pattern.test(msg));

  if (!hasEmailIntent) {
    return null;
  }

  // Extract entities
  const entities: Intent['entities'] = {};

  // Extract email addresses
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
  if (emailMatch) {
    entities.recipient = emailMatch[0];
  }

  // Extract recipient names
  const toPatterns = [
    /(?:email|send|write to|message|tell)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  ];

  for (const pattern of toPatterns) {
    const match = message.match(pattern);
    if (match && !entities.recipient) {
      entities.recipient = match[1];
      break;
    }
  }

  // Extract subject
  const subjectPatterns = [
    /subject[:\s]+["']?([^"'\n]+)["']?/i,
    /about\s+["']?([^"'\n]+)["']?/i,
    /regarding\s+["']?([^"'\n]+)["']?/i,
  ];

  for (const pattern of subjectPatterns) {
    const match = message.match(pattern);
    if (match) {
      entities.subject = match[1].trim();
      break;
    }
  }

  // Extract body/message content
  const bodyPatterns = [
    /(?:saying|message|body)[:\s]+["'](.+?)["']/is,
    /["'](.+?)["']\s*$/s, // Quoted text at end
  ];

  for (const pattern of bodyPatterns) {
    const match = message.match(pattern);
    if (match) {
      entities.body = match[1].trim();
      break;
    }
  }

  // Calculate confidence based on how many entities we extracted
  let confidence = 0.5; // Base confidence for email keyword
  if (entities.recipient) confidence += 0.2;
  if (entities.subject) confidence += 0.15;
  if (entities.body) confidence += 0.15;

  return {
    type: 'email',
    confidence: Math.min(confidence, 1.0),
    entities,
    rawMessage: message,
  };
}

/**
 * Detect calendar/event intent
 */
export function detectCalendarIntent(message: string): Intent | null {
  const msg = message.toLowerCase();

  const calendarPatterns = [
    /\b(schedule|calendar|meeting|appointment|event)\b/i,
    /\b(book|set up|arrange)\b.*\b(meeting|call|appointment)\b/i,
    /\b(remind me|reminder)\b.*\b(at|on|tomorrow|next)\b/i,
  ];

  const hasCalendarIntent = calendarPatterns.some(pattern => pattern.test(msg));

  if (!hasCalendarIntent) {
    return null;
  }

  const entities: Intent['entities'] = {};

  // Extract date/time patterns
  const timePattern = /(?:at|@)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const datePattern = /(?:on|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;

  const timeMatch = message.match(timePattern);
  if (timeMatch) {
    entities.time = timeMatch[1];
  }

  const dateMatch = message.match(datePattern);
  if (dateMatch) {
    entities.date = dateMatch[0];
  }

  return {
    type: 'calendar',
    confidence: 0.7,
    entities,
    rawMessage: message,
  };
}

/**
 * Detect task creation intent
 */
export function detectTaskIntent(message: string): Intent | null {
  const msg = message.toLowerCase();

  const taskPatterns = [
    /\b(task|todo|to-do|reminder)\b/i,
    /\b(add|create)\b.*\b(task|todo|reminder)\b/i,
    /\b(remind me to|don't forget to|need to)\b/i,
  ];

  const hasTaskIntent = taskPatterns.some(pattern => pattern.test(msg));

  if (!hasTaskIntent) {
    return null;
  }

  return {
    type: 'task',
    confidence: 0.7,
    entities: {},
    rawMessage: message,
  };
}

/**
 * Main intent detection function
 */
export function detectIntent(message: string): Intent {
  // Try email intent first
  const emailIntent = detectEmailIntent(message);
  if (emailIntent && emailIntent.confidence > 0.6) {
    return emailIntent;
  }

  // Try calendar intent
  const calendarIntent = detectCalendarIntent(message);
  if (calendarIntent && calendarIntent.confidence > 0.6) {
    return calendarIntent;
  }

  // Try task intent
  const taskIntent = detectTaskIntent(message);
  if (taskIntent && taskIntent.confidence > 0.6) {
    return taskIntent;
  }

  // Default to general conversation
  return {
    type: 'general',
    confidence: 1.0,
    entities: {},
    rawMessage: message,
  };
}

/**
 * Generate AI prompt for email composition
 */
export function generateEmailPrompt(intent: Intent, userContext: string = ''): string {
  const { entities, rawMessage } = intent;

  let prompt = `You are NYX, VPK's AI assistant. VPK wants you to compose an email.\n\n`;

  prompt += `VPK's request: "${rawMessage}"\n\n`;

  if (userContext) {
    prompt += `Context from VPK's vault:\n${userContext}\n\n`;
  }

  prompt += `Based on this, compose a professional email with:\n`;

  if (entities.recipient) {
    prompt += `TO: ${entities.recipient}\n`;
  } else {
    prompt += `TO: [You must determine the recipient from the request]\n`;
  }

  if (entities.subject) {
    prompt += `SUBJECT: ${entities.subject}\n`;
  } else {
    prompt += `SUBJECT: [Generate an appropriate subject line]\n`;
  }

  prompt += `\nBODY:\n`;
  if (entities.body) {
    prompt += `[Elaborate on: "${entities.body}"]\n`;
  } else {
    prompt += `[Compose based on VPK's intent]\n`;
  }

  prompt += `\nIMPORTANT:\n`;
  prompt += `- Use professional but friendly tone\n`;
  prompt += `- Sign as "VPK" or "Regards, VPK"\n`;
  prompt += `- Be concise and clear\n`;
  prompt += `- Format as: TO|SUBJECT|BODY (separated by pipe |)\n`;

  return prompt;
}
