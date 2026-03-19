/**
 * Gmail API Integration
 * Send emails via Gmail API using service account or OAuth
 */

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}

export interface SentEmail {
  messageId: string;
  threadId: string;
  to: string;
  subject: string;
  sentAt: string;
}

/**
 * Encode email to RFC 2822 format
 */
function encodeEmail(draft: EmailDraft): string {
  const lines: string[] = [];

  lines.push(`To: ${draft.to}`);
  if (draft.cc) lines.push(`Cc: ${draft.cc}`);
  if (draft.bcc) lines.push(`Bcc: ${draft.bcc}`);
  if (draft.replyTo) lines.push(`Reply-To: ${draft.replyTo}`);

  lines.push(`Subject: ${draft.subject}`);
  lines.push(`Content-Type: text/plain; charset=utf-8`);
  lines.push('');
  lines.push(draft.body);

  const email = lines.join('\r\n');

  // Base64url encode
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send email via n8n Gmail workflow (recommended)
 * This uses n8n's OAuth credentials instead of managing them here
 */
export async function sendEmailViaN8n(
  draft: EmailDraft,
  n8nWebhookUrl: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'send_email',
        email: draft,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `n8n workflow error: ${error}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.messageId || 'Email sent successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to send via n8n: ${error.message}`,
    };
  }
}

/**
 * Format email draft for user confirmation
 */
export function formatEmailForConfirmation(draft: EmailDraft): string {
  let formatted = '📧 **EMAIL DRAFT**\n\n';
  formatted += `**To:** ${draft.to}\n`;
  if (draft.cc) formatted += `**Cc:** ${draft.cc}\n`;
  if (draft.bcc) formatted += `**Bcc:** ${draft.bcc}\n`;
  formatted += `**Subject:** ${draft.subject}\n\n`;
  formatted += `**Message:**\n${draft.body}\n\n`;
  formatted += `───────────────────\n`;
  formatted += `Reply:\n`;
  formatted += `• **SEND** - Send this email\n`;
  formatted += `• **EDIT** - Make changes\n`;
  formatted += `• **CANCEL** - Don't send`;

  return formatted;
}

/**
 * Parse AI-generated email response
 * Expected format: TO|SUBJECT|BODY
 */
export function parseAIEmailResponse(response: string): EmailDraft | null {
  const lines = response.trim().split('\n');

  let to = '';
  let subject = '';
  let body = '';

  // Try pipe-separated format first
  if (response.includes('|')) {
    const parts = response.split('|').map(p => p.trim());
    if (parts.length >= 3) {
      to = parts[0].replace(/^TO:\s*/i, '');
      subject = parts[1].replace(/^SUBJECT:\s*/i, '');
      body = parts.slice(2).join('|').replace(/^BODY:\s*/i, '');
    }
  } else {
    // Try parsing line-by-line
    for (const line of lines) {
      if (/^TO:/i.test(line)) {
        to = line.replace(/^TO:\s*/i, '').trim();
      } else if (/^SUBJECT:/i.test(line)) {
        subject = line.replace(/^SUBJECT:\s*/i, '').trim();
      } else if (/^BODY:/i.test(line) || body) {
        if (!body) {
          body = line.replace(/^BODY:\s*/i, '').trim();
        } else {
          body += '\n' + line;
        }
      }
    }
  }

  // Validate required fields
  if (!to || !subject) {
    return null;
  }

  // If body is empty, use the whole response
  if (!body) {
    body = response;
  }

  return {
    to: to.trim(),
    subject: subject.trim(),
    body: body.trim(),
  };
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
  return emailRegex.test(email);
}

/**
 * Clean and normalize email address
 */
export function normalizeEmail(email: string): string {
  // Remove display names like "John Doe <john@example.com>"
  const match = email.match(/<([\w.-]+@[\w.-]+\.\w+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return email.trim().toLowerCase();
}
