/**
 * User Profile Management & Preference Learning
 * Implements smart learning from user interactions without requiring AI tokens
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import type { UserProfile, LearnedFact, ConversationMessage } from './db';

const dataDir = join(process.cwd(), 'data');
const PROFILE_FILE = join(dataDir, 'user_profile.json');

/**
 * Default user profile with sensible defaults
 */
const DEFAULT_PROFILE: UserProfile = {
  version: '1.0.0',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  preferences: {
    communication: {
      style: 'concise',
      greeting: false,
      emojis: false,
      markdown_style: ['bold', 'italic', 'code'],
      tone: 'professional',
    },
    notifications: {
      priority_threshold: 2,
      batch_mode: true,
      quiet_hours: [
        { start: '08:00', end: '17:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] }
      ],
      category_filters: {
        Finance: { enabled: true, min_priority: 1, threshold_value: 1000 },
        Events: { enabled: true, min_priority: 2 },
        Medical: { enabled: true, min_priority: 0 },
        'Vault Structure': { enabled: true, min_priority: 2 },
        General: { enabled: true, min_priority: 2 },
      },
    },
    agents: {
      DEMETER: { enabled: true, priority_boost: 0, custom_rules: [], quiet_hours: [] },
      MIDAS: { enabled: true, priority_boost: 0, custom_rules: [], quiet_hours: [] },
      PLUTUS: { enabled: true, priority_boost: 1, custom_rules: [], quiet_hours: [] },
      ASCLEPIUS: { enabled: true, priority_boost: 1, custom_rules: [], quiet_hours: [] },
      CHRONOS: { enabled: true, priority_boost: 0, custom_rules: [], quiet_hours: [] },
    },
    finance: {
      alert_threshold: 1000,
      currency: '₹',
      track_categories: ['Food', 'Transport', 'Medical', 'EMI'],
    },
    medical: {
      preferred_duty: ['A', 'M'],
      duty_alert_advance_hours: 12,
      roster_changes_notify: true,
    },
    location: {
      auto_context: true,
      known_locations: {
        apollo_hospital: {
          name: 'Apollo Hospital',
          type: 'workplace',
          typical_activities: ['duty', 'patient_rounds', 'clinical_work'],
          auto_suppress_agents: ['DEMETER'],
        },
        home: {
          name: 'Home',
          type: 'personal',
          typical_activities: ['study', 'rest', 'meal_prep'],
          auto_suppress_agents: [],
        },
      },
    },
  },
  learned_facts: [],
  context_memory: {
    hot: [],
    warm_summary: '',
    last_compression: new Date().toISOString(),
    compression_count: 0,
  },
  behavioral_patterns: {
    typical_response_times: {},
    interaction_frequency: {},
    dismissal_rate: {},
    engagement_topics: [],
  },
};

/**
 * Load user profile (creates default if not exists)
 */
export async function getUserProfile(): Promise<UserProfile> {
  try {
    if (!existsSync(PROFILE_FILE)) {
      await saveUserProfile(DEFAULT_PROFILE);
      return DEFAULT_PROFILE;
    }

    const data = await fs.readFile(PROFILE_FILE, 'utf-8');
    const profile = JSON.parse(data) as UserProfile;

    // Merge with defaults in case new fields were added
    return {
      ...DEFAULT_PROFILE,
      ...profile,
      preferences: {
        ...DEFAULT_PROFILE.preferences,
        ...profile.preferences,
      },
    };
  } catch (e) {
    console.error('[PROFILE] Error loading profile, using defaults:', e);
    return DEFAULT_PROFILE;
  }
}

/**
 * Save user profile
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  profile.updated_at = new Date().toISOString();
  await fs.writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
}

/**
 * Update hot memory (keep last 5 conversations)
 */
export async function updateHotMemory(conversations: ConversationMessage[]): Promise<void> {
  const profile = await getUserProfile();
  profile.context_memory.hot = conversations.slice(-5);
  await saveUserProfile(profile);
}

/**
 * Add a learned fact
 */
export async function addLearnedFact(fact: Omit<LearnedFact, 'id' | 'learned_at' | 'last_validated'>): Promise<void> {
  const profile = await getUserProfile();

  const newFact: LearnedFact = {
    id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    learned_at: new Date().toISOString(),
    last_validated: new Date().toISOString(),
    ...fact,
  };

  profile.learned_facts.push(newFact);
  await saveUserProfile(profile);
  console.log(`[LEARNING] Added new fact: ${fact.fact}`);
}

/**
 * Update preference from explicit user statement
 */
export async function updatePreference(category: string, key: string, value: any): Promise<void> {
  const profile = await getUserProfile();

  // Navigate nested preferences object
  const keys = key.split('.');
  let current: any = profile.preferences;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  await saveUserProfile(profile);
  console.log(`[LEARNING] Updated preference: ${category}.${key} = ${value}`);
}

/**
 * Pattern detection - learns from user messages without AI
 */
export interface DetectedPattern {
  explicit_preference: boolean;
  preference_type?: 'filter' | 'threshold' | 'style' | 'schedule';
  preference_data?: any;
  learned_fact?: string;
}

export function detectPatterns(message: string): DetectedPattern {
  const lowerMsg = message.toLowerCase();
  const result: DetectedPattern = {
    explicit_preference: false,
  };

  // 1. FILTER PREFERENCES
  // "Don't send me X", "Stop sending Y", "I don't want Z"
  const filterPatterns = [
    /(?:don't|do not|stop) (?:send|show|notify|tell|give me) (?:me )?(?:about |the )?(.+?)(?:\.|$|during|when|for)/i,
    /(?:i don't want|no more|skip) (?:about |the )?(.+?)(?:\.|$|during|when|for)/i,
  ];

  for (const pattern of filterPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.explicit_preference = true;
      result.preference_type = 'filter';
      result.preference_data = { suppress: match[1].trim() };
      result.learned_fact = `User prefers not to receive: ${match[1].trim()}`;
      return result;
    }
  }

  // 2. THRESHOLD PREFERENCES
  // "Only alert me for Finance > ₹1000", "Notify me for transactions above ₹500"
  const thresholdPattern = /(?:only|just) (?:alert|notify|tell|show) (?:me )?(?:for |about )?(\w+) (?:>|above|over|greater than) [₹$]?(\d+)/i;
  const thresholdMatch = message.match(thresholdPattern);
  if (thresholdMatch) {
    result.explicit_preference = true;
    result.preference_type = 'threshold';
    result.preference_data = {
      category: thresholdMatch[1],
      threshold: parseInt(thresholdMatch[2]),
    };
    result.learned_fact = `User wants ${thresholdMatch[1]} alerts only above ${thresholdMatch[2]}`;
    return result;
  }

  // 3. COMMUNICATION STYLE
  // "I prefer concise messages", "Keep it brief", "Be detailed"
  const stylePatterns = [
    { pattern: /(?:i prefer|i want|give me|keep it) (?:concise|brief|short)/i, style: 'concise' },
    { pattern: /(?:i prefer|i want|give me) (?:detailed|verbose|complete)/i, style: 'detailed' },
    { pattern: /(?:no greetings?|skip (?:the )?greetings?)/i, style: 'no_greeting' },
    { pattern: /(?:no emojis?)/i, style: 'no_emoji' },
  ];

  for (const { pattern, style } of stylePatterns) {
    if (pattern.test(message)) {
      result.explicit_preference = true;
      result.preference_type = 'style';
      result.preference_data = { style };
      result.learned_fact = `User prefers communication style: ${style}`;
      return result;
    }
  }

  // 4. SCHEDULE PREFERENCES
  // "Don't disturb me during duty", "Quiet hours from 8am to 5pm"
  const schedulePattern = /(?:don't disturb|quiet|silence|no notifications?) (?:during |from |between )?(.+?)(?:\.|$)/i;
  const scheduleMatch = message.match(schedulePattern);
  if (scheduleMatch) {
    result.explicit_preference = true;
    result.preference_type = 'schedule';
    result.preference_data = { period: scheduleMatch[1].trim() };
    result.learned_fact = `User wants quiet hours: ${scheduleMatch[1].trim()}`;
    return result;
  }

  return result;
}

/**
 * Learn from user interaction
 */
export async function learnFromInteraction(
  userMessage: string,
  assistantResponse: string,
  context?: { location?: string; time: string }
): Promise<void> {
  const pattern = detectPatterns(userMessage);

  if (!pattern.explicit_preference) {
    return; // Nothing to learn
  }

  const profile = await getUserProfile();

  // Apply learned preferences
  switch (pattern.preference_type) {
    case 'filter':
      // Add to suppression rules
      if (pattern.preference_data?.suppress) {
        const category = pattern.preference_data.suppress;
        if (profile.preferences.notifications.category_filters[category]) {
          profile.preferences.notifications.category_filters[category].enabled = false;
        }
      }
      break;

    case 'threshold':
      if (pattern.preference_data?.category && pattern.preference_data?.threshold) {
        const cat = pattern.preference_data.category;
        if (profile.preferences.notifications.category_filters[cat]) {
          profile.preferences.notifications.category_filters[cat].threshold_value = pattern.preference_data.threshold;
        }
      }
      break;

    case 'style':
      if (pattern.preference_data?.style === 'concise') {
        profile.preferences.communication.style = 'concise';
      } else if (pattern.preference_data?.style === 'detailed') {
        profile.preferences.communication.style = 'detailed';
      } else if (pattern.preference_data?.style === 'no_greeting') {
        profile.preferences.communication.greeting = false;
      } else if (pattern.preference_data?.style === 'no_emoji') {
        profile.preferences.communication.emojis = false;
      }
      break;

    case 'schedule':
      // Parse schedule and add to quiet hours
      // This is simplified - you can enhance with time parsing
      break;
  }

  // Add learned fact
  if (pattern.learned_fact) {
    await addLearnedFact({
      category: pattern.preference_type || 'general',
      fact: pattern.learned_fact,
      confidence: 1.0,
      source: 'explicit',
      context: context ? JSON.stringify(context) : undefined,
    });
  }

  await saveUserProfile(profile);
}

/**
 * Get relevant learned facts for a query
 */
export async function getRelevantFacts(query: string, maxFacts: number = 5): Promise<LearnedFact[]> {
  const profile = await getUserProfile();
  const lowerQuery = query.toLowerCase();

  // Simple keyword matching (can be enhanced with embeddings later)
  const relevant = profile.learned_facts.filter(fact => {
    const lowerFact = fact.fact.toLowerCase();
    const keywords = lowerQuery.match(/\b\w{4,}\b/g) || [];
    return keywords.some(keyword => lowerFact.includes(keyword));
  });

  // Sort by confidence and recency
  relevant.sort((a, b) => {
    const confidenceDiff = b.confidence - a.confidence;
    if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;
    return b.learned_at.localeCompare(a.learned_at);
  });

  return relevant.slice(0, maxFacts);
}
