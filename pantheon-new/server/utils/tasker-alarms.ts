/**
 * Tasker Alarm Integration
 * Allows NYX to set alarms on VPK's Android phone via Tasker HTTP server
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AlarmRequest {
  hour: number;
  minute: number;
  message?: string;
  date?: string; // YYYY-MM-DD for future alarms
}

export interface AlarmResponse {
  success: boolean;
  alarm_time?: string;
  error?: string;
}

/**
 * Parse natural language alarm requests
 * Examples:
 * - "Set alarm for 7am"
 * - "Wake me up at 6:30 tomorrow"
 * - "Set alarm for 8pm tonight"
 */
export function parseAlarmRequest(text: string): AlarmRequest | null {
  const lowerText = text.toLowerCase();

  // Extract time patterns
  const patterns = [
    // "7am", "7:30am", "07:30"
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
    // "at 7", "at 19:30"
    /at\s+(\d{1,2})(?::(\d{2}))?/i,
    // "for 7:30"
    /for\s+(\d{1,2}):(\d{2})/i,
  ];

  let hour: number | null = null;
  let minute = 0;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      hour = parseInt(match[1]);
      minute = match[2] ? parseInt(match[2]) : 0;

      // Handle AM/PM
      if (match[3]) {
        const meridiem = match[3].toLowerCase();
        if (meridiem === 'pm' && hour < 12) {
          hour += 12;
        } else if (meridiem === 'am' && hour === 12) {
          hour = 0;
        }
      }

      break;
    }
  }

  if (hour === null) {
    return null;
  }

  // Extract date context (tomorrow, tonight, etc.)
  let date: string | undefined;
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);

  if (/tomorrow/i.test(lowerText)) {
    const tomorrow = new Date(ist);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    date = tomorrow.toISOString().split('T')[0];
  } else if (/tonight/i.test(lowerText)) {
    // If it's evening and time is < 12, assume PM
    if (hour < 12 && ist.getUTCHours() >= 12) {
      hour += 12;
    }
  }

  // Extract message context
  let message = 'NYX Alarm';
  const msgPatterns = [
    /alarm (?:for|to) (.+?)(?:\s+at|\s+for|\s+tomorrow|\s+tonight|$)/i,
    /wake me (?:up )?(?:for|to) (.+?)(?:\s+at|\s+for|$)/i,
  ];

  for (const pattern of msgPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      message = match[1].trim();
      break;
    }
  }

  return {
    hour,
    minute,
    message,
    date,
  };
}

/**
 * Send alarm request to Tasker HTTP server on phone
 */
export async function sendAlarmToTasker(
  alarmReq: AlarmRequest,
  phoneIp: string,
  phonePort: number = 1821,
  authPassword?: string
): Promise<AlarmResponse> {
  try {
    const url = `http://${phoneIp}:${phonePort}/nyx/alarm`;

    const payload = JSON.stringify(alarmReq);
    const authHeader = authPassword ? `-u :${authPassword}` : '';

    const curlCmd = `curl -s -X POST ${authHeader} \
      -H "Content-Type: application/json" \
      -d '${payload}' \
      ${url}`;

    console.log(`[TASKER-ALARM] Sending to ${url}:`, alarmReq);

    const { stdout, stderr } = await execAsync(curlCmd, { timeout: 5000 });

    if (stderr) {
      console.error('[TASKER-ALARM] Error:', stderr);
      return { success: false, error: stderr };
    }

    try {
      const response = JSON.parse(stdout);
      return {
        success: true,
        alarm_time: `${String(alarmReq.hour).padStart(2, '0')}:${String(alarmReq.minute).padStart(2, '0')}`,
        ...response,
      };
    } catch (e) {
      // Tasker responded but not with JSON
      return {
        success: true,
        alarm_time: `${String(alarmReq.hour).padStart(2, '0')}:${String(alarmReq.minute).padStart(2, '0')}`,
      };
    }
  } catch (error: any) {
    console.error('[TASKER-ALARM] Failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Format confirmation message for user
 */
export function formatAlarmConfirmation(alarmReq: AlarmRequest, response: AlarmResponse): string {
  const timeStr = `${String(alarmReq.hour).padStart(2, '0')}:${String(alarmReq.minute).padStart(2, '0')}`;
  const meridiem = alarmReq.hour >= 12 ? 'PM' : 'AM';
  const hour12 = alarmReq.hour > 12 ? alarmReq.hour - 12 : alarmReq.hour === 0 ? 12 : alarmReq.hour;
  const time12 = `${hour12}:${String(alarmReq.minute).padStart(2, '0')} ${meridiem}`;

  if (!response.success) {
    return `❌ Failed to set alarm: ${response.error || 'Phone unreachable'}`;
  }

  let dateStr = 'today';
  if (alarmReq.date) {
    const date = new Date(alarmReq.date);
    dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return `✅ Alarm set for *${time12}* ${dateStr}\n${alarmReq.message ? `📝 ${alarmReq.message}` : ''}`;
}
