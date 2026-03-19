/**
 * Notification Filtering based on User Preferences
 * Filters out unwanted notifications before dispatching
 */

import type { NyxMessage } from './db';
import { getUserProfile } from './user-profile';

export interface FilterResult {
  shouldSend: boolean;
  reason?: string;
}

/**
 * Check if a message should be sent based on learned preferences
 */
export async function shouldSendNotification(message: NyxMessage): Promise<FilterResult> {
  const profile = await getUserProfile();

  // 1. Check category filters
  const category = message.category || 'General';
  const categoryFilter = profile.preferences.notifications.category_filters[category];

  if (categoryFilter && !categoryFilter.enabled) {
    return {
      shouldSend: false,
      reason: `Category ${category} is disabled by user preference`,
    };
  }

  // 2. Check minimum priority for category
  if (categoryFilter && categoryFilter.min_priority !== undefined) {
    if (message.priority > categoryFilter.min_priority) {
      return {
        shouldSend: false,
        reason: `Priority ${message.priority} below threshold ${categoryFilter.min_priority} for ${category}`,
      };
    }
  }

  // 3. Check threshold values (e.g., Finance > ₹1000)
  if (categoryFilter && categoryFilter.threshold_value !== undefined) {
    const amount = extractAmount(message.message);
    if (amount !== null && amount < categoryFilter.threshold_value) {
      return {
        shouldSend: false,
        reason: `Amount ${amount} below threshold ${categoryFilter.threshold_value} for ${category}`,
      };
    }
  }

  // 4. Check quiet hours
  const isQuietTime = checkQuietHours(profile.preferences.notifications.quiet_hours);
  if (isQuietTime && message.priority > 1) {
    // Only allow P0 and P1 during quiet hours
    return {
      shouldSend: false,
      reason: 'Quiet hours active, only critical notifications allowed',
    };
  }

  // 5. Check agent-specific quiet hours
  const agentPrefs = profile.preferences.agents[message.pa_name];
  if (agentPrefs && !agentPrefs.enabled) {
    return {
      shouldSend: false,
      reason: `Agent ${message.pa_name} is disabled`,
    };
  }

  if (agentPrefs && agentPrefs.quiet_hours) {
    const isAgentQuiet = checkQuietHours(agentPrefs.quiet_hours);
    if (isAgentQuiet && message.priority > 1) {
      return {
        shouldSend: false,
        reason: `Agent ${message.pa_name} quiet hours active`,
      };
    }
  }

  // 6. Check against learned suppression facts
  for (const fact of profile.learned_facts) {
    if (fact.category === 'filter' && fact.source === 'explicit') {
      // Check if message matches suppressed pattern
      const suppressPattern = fact.fact.toLowerCase();
      if (message.message.toLowerCase().includes(suppressPattern)) {
        return {
          shouldSend: false,
          reason: `Matches learned suppression: ${fact.fact}`,
        };
      }
    }
  }

  return { shouldSend: true };
}

/**
 * Extract amount from message (₹1000, $500, etc.)
 */
function extractAmount(message: string): number | null {
  const patterns = [
    /[₹$]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[₹$]/,
    /rupees?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const amount = match[1].replace(/,/g, '');
      return parseFloat(amount);
    }
  }

  return null;
}

/**
 * Check if current time is within quiet hours
 */
function checkQuietHours(quietHours: { start: string; end: string; days?: string[] }[]): boolean {
  if (!quietHours || quietHours.length === 0) return false;

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);

  const currentHour = ist.getUTCHours();
  const currentMinute = ist.getUTCMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const currentDay = ist.toLocaleDateString('en-US', { weekday: 'lowercase' });

  for (const period of quietHours) {
    // Check if today matches (if days specified)
    if (period.days && period.days.length > 0) {
      if (!period.days.includes(currentDay)) {
        continue; // Not applicable today
      }
    }

    // Parse start and end times
    const [startHour, startMin] = period.start.split(':').map(Number);
    const [endHour, endMin] = period.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Check if current time is within range
    if (currentTime >= startTime && currentTime < endTime) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a batch of messages based on preferences
 */
export async function filterMessages(messages: NyxMessage[]): Promise<{
  toSend: NyxMessage[];
  filtered: Array<{ message: NyxMessage; reason: string }>;
}> {
  const toSend: NyxMessage[] = [];
  const filtered: Array<{ message: NyxMessage; reason: string }> = [];

  for (const message of messages) {
    const result = await shouldSendNotification(message);
    if (result.shouldSend) {
      toSend.push(message);
    } else if (result.reason) {
      filtered.push({ message, reason: result.reason });
    }
  }

  return { toSend, filtered };
}

/**
 * Apply priority boost from agent preferences
 */
export async function applyPriorityBoost(message: NyxMessage): Promise<NyxMessage> {
  const profile = await getUserProfile();
  const agentPrefs = profile.preferences.agents[message.pa_name];

  if (agentPrefs && agentPrefs.priority_boost !== 0) {
    const newPriority = Math.max(0, Math.min(3, message.priority + agentPrefs.priority_boost));
    return {
      ...message,
      priority: newPriority as 0 | 1 | 2 | 3,
    };
  }

  return message;
}
