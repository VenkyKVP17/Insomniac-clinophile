import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dataDir = join(process.cwd(), 'data');
const QUEUE_FILE = join(dataDir, 'nyx_queue.json');
const LOGS_FILE = join(dataDir, 'agent_logs.json');
const CONVERSATION_FILE = join(dataDir, 'nyx_conversations.json');
const TASKS_FILE = join(dataDir, 'nyx_tasks.json');
const STATE_FILE = join(dataDir, 'nyx_state.json');
const PROFILE_FILE = join(dataDir, 'user_profile.json');

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Helper to read JSON file or return empty object/array
export async function readJson<T>(filePath: string, defaultValue: any = []): Promise<T> {
  try {
    if (!existsSync(filePath)) return defaultValue;
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return defaultValue;
  }
}

// Helper to write JSON file
async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export interface NyxState {
  current_location?: {
    id: string;
    name: string;
    last_update: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Profile & Smart Learning
// ─────────────────────────────────────────────────────────────────────────────

export interface LearnedFact {
  id: string;
  category: string;
  fact: string;
  confidence: number;
  learned_at: string;
  last_validated: string;
  source: 'explicit' | 'inferred';
  context?: string;
}

export interface UserProfile {
  version: string;
  created_at: string;
  updated_at: string;
  preferences: {
    communication: {
      style: 'concise' | 'detailed' | 'conversational';
      greeting: boolean;
      emojis: boolean;
      markdown_style: string[];
      tone: string;
    };
    notifications: {
      priority_threshold: 0 | 1 | 2 | 3;
      batch_mode: boolean;
      quiet_hours: { start: string; end: string; days?: string[] }[];
      category_filters: {
        [category: string]: {
          enabled: boolean;
          min_priority?: number;
          threshold_value?: number;
        };
      };
    };
    agents: {
      [agentName: string]: {
        enabled: boolean;
        priority_boost: number;
        custom_rules: string[];
        quiet_hours?: { start: string; end: string }[];
      };
    };
    finance: {
      alert_threshold: number;
      currency: string;
      track_categories: string[];
    };
    medical: {
      preferred_duty: string[];
      duty_alert_advance_hours: number;
      roster_changes_notify: boolean;
    };
    location: {
      auto_context: boolean;
      known_locations: {
        [locationId: string]: {
          name: string;
          type: string;
          typical_activities: string[];
          auto_suppress_agents?: string[];
        };
      };
    };
  };
  learned_facts: LearnedFact[];
  context_memory: {
    hot: ConversationMessage[];
    warm_summary: string;
    last_compression: string;
    compression_count: number;
  };
  behavioral_patterns: {
    typical_response_times: { [hour: number]: number };
    interaction_frequency: { [agentName: string]: number };
    dismissal_rate: { [agentName: string]: number };
    engagement_topics: { topic: string; count: number }[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User State
// ─────────────────────────────────────────────────────────────────────────────

export const updateUserLocation = async (locationId: string | null, locationName?: string) => {
  const state = await readJson<NyxState>(STATE_FILE, {});
  if (locationId === null) {
    delete state.current_location;
  } else {
    state.current_location = {
      id: locationId,
      name: locationName || locationId,
      last_update: new Date().toISOString()
    };
  }
  await writeJson(STATE_FILE, state);
};

export const getUserLocation = async () => {
  const state = await readJson<NyxState>(STATE_FILE, {});
  return state.current_location;
};

export interface AgentLog {
  id?: number;
  timestamp: string;
  pa_name: string;
  trigger_type: string;
  action_taken: string;
  script_executed?: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED_ON_USER' | 'RUNNING';
  details?: string;
}

export interface NyxMessage {
  id?: number;
  created_at: string;
  pa_name: string;
  /** 0 = Critical (immediate), 1 = High, 2 = Info, 3 = Status */
  priority: 0 | 1 | 2 | 3;
  message: string;
  action_url?: string;
  action_label?: string;
  sent_at?: string | null;
  /** Feature #9: Category for smart grouping (Finance, Events, Medical, Vault Structure, General) */
  category?: string;
}

export interface ConversationMessage {
  id?: number;
  timestamp: string;
  role: 'user' | 'assistant';
  message: string;
  model_used: 'gemini-cli' | 'groq' | 'google-api';
  context_size?: number;
}

export interface NyxTask {
  id?: number;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  related_files?: string[];
  last_reminder_at?: string;
  completed_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Logs
// ─────────────────────────────────────────────────────────────────────────────

export const logAgentAction = async (log: Omit<AgentLog, 'id' | 'timestamp'>) => {
  const logs = await readJson<AgentLog>(LOGS_FILE);
  const newEntry: AgentLog = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    ...log
  };
  logs.push(newEntry);
  await writeJson(LOGS_FILE, logs);
  return { lastID: newEntry.id };
};

export const getAgentLogs = async (limit = 100) => {
  const logs = await readJson<AgentLog>(LOGS_FILE);
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
};

// ─────────────────────────────────────────────────────────────────────────────
// NYX Queue
// ─────────────────────────────────────────────────────────────────────────────

export const enqueueMessage = async (msg: Omit<NyxMessage, 'id' | 'created_at' | 'sent_at'>) => {
  const queue = await readJson<NyxMessage>(QUEUE_FILE);
  const newEntry: NyxMessage = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    created_at: new Date().toISOString(),
    sent_at: null,
    ...msg
  };
  queue.push(newEntry);
  await writeJson(QUEUE_FILE, queue);
  return { lastID: newEntry.id };
};

export const getPendingMessages = async (maxPriority?: number) => {
  const queue = await readJson<NyxMessage>(QUEUE_FILE);
  let pending = queue.filter(m => !m.sent_at);

  if (maxPriority !== undefined) {
    pending = pending.filter(m => m.priority <= maxPriority);
  }

  return pending.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.created_at.localeCompare(b.created_at);
  });
};

/**
 * Feature #9: Get pending messages by category for drill-down
 */
export const getPendingMessagesByCategory = async (category: string) => {
  const queue = await readJson<NyxMessage>(QUEUE_FILE);
  return queue.filter(m => !m.sent_at && m.category === category);
};

/**
 * Feature #9: Get all categories with pending message counts
 */
export const getCategoryCounts = async () => {
  const queue = await readJson<NyxMessage>(QUEUE_FILE);
  const pending = queue.filter(m => !m.sent_at);

  const counts: Record<string, number> = {};
  pending.forEach(m => {
    const cat = m.category || 'General';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  return counts;
};

export const markMessagesAsSent = async (ids: number[]) => {
  if (ids.length === 0) return;
  const queue = await readJson<NyxMessage>(QUEUE_FILE);
  const now = new Date().toISOString();

  const updated = queue.map(m => {
    if (m.id && ids.includes(m.id)) {
      return { ...m, sent_at: now };
    }
    return m;
  });

  await writeJson(QUEUE_FILE, updated);
};

// ─────────────────────────────────────────────────────────────────────────────
// Conversation History
// ─────────────────────────────────────────────────────────────────────────────

export const saveConversationMessage = async (msg: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
  const conversations = await readJson<ConversationMessage>(CONVERSATION_FILE);
  const newEntry: ConversationMessage = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    ...msg
  };
  conversations.push(newEntry);

  // Keep only the last 100 messages (memory optimization)
  const trimmed = conversations.slice(-100);
  await writeJson(CONVERSATION_FILE, trimmed);
  return { lastID: newEntry.id };
};

export const getRecentConversations = async (limit = 50) => {
  const conversations = await readJson<ConversationMessage>(CONVERSATION_FILE);
  return conversations.slice(-limit);
};

export const getConversationsSince = async (since: string) => {
  const conversations = await readJson<ConversationMessage>(CONVERSATION_FILE);
  return conversations.filter(c => c.timestamp > since);
};

// ─────────────────────────────────────────────────────────────────────────────
// Task Management (Feature #6)
// ─────────────────────────────────────────────────────────────────────────────

export const createTask = async (task: Omit<NyxTask, 'id' | 'created_at' | 'updated_at'>) => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  const newTask: NyxTask = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...task
  };
  tasks.push(newTask);
  await writeJson(TASKS_FILE, tasks);
  return { taskId: newTask.id, task: newTask };
};

export const updateTask = async (taskId: number, updates: Partial<Omit<NyxTask, 'id' | 'created_at'>>) => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    throw new Error(`Task with ID ${taskId} not found`);
  }

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...updates,
    updated_at: new Date().toISOString()
  };

  await writeJson(TASKS_FILE, tasks);
  return { task: tasks[taskIndex] };
};

export const getTaskById = async (taskId: number) => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  return tasks.find(t => t.id === taskId);
};

export const getAllTasks = async (status?: NyxTask['status']) => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  if (status) {
    return tasks.filter(t => t.status === status);
  }
  return tasks;
};

export const getTasksDueToday = async () => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  const today = new Date().toISOString().split('T')[0];

  return tasks.filter(t =>
    t.status !== 'completed' &&
    t.status !== 'cancelled' &&
    t.due_date &&
    t.due_date.startsWith(today)
  );
};

export const getTasksDueSoon = async (daysAhead = 3) => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'cancelled' || !t.due_date) {
      return false;
    }
    const dueDate = new Date(t.due_date);
    return dueDate >= now && dueDate <= futureDate;
  });
};

export const getOverdueTasks = async () => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  const now = new Date().toISOString();

  return tasks.filter(t =>
    t.status !== 'completed' &&
    t.status !== 'cancelled' &&
    t.due_date &&
    t.due_date < now
  );
};

export const deleteTask = async (taskId: number) => {
  const tasks = await readJson<NyxTask>(TASKS_FILE);
  const filtered = tasks.filter(t => t.id !== taskId);

  if (filtered.length === tasks.length) {
    throw new Error(`Task with ID ${taskId} not found`);
  }

  await writeJson(TASKS_FILE, filtered);
  return { success: true };
};

// Get conversation statistics
export const getConversationStats = async () => {
  const conversations = await readJson<ConversationMessage>(CONVERSATION_FILE);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = conversations.filter(c => c.timestamp > last24h);

  return {
    totalMessages: conversations.length,
    last24h: recent.length,
    byModel: {
      geminiCli: recent.filter(c => c.model_used === 'gemini-cli').length,
      groq: recent.filter(c => c.model_used === 'groq').length,
      googleApi: recent.filter(c => c.model_used === 'google-api').length,
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Smart Cleanup
// ─────────────────────────────────────────────────────────────────────────────

import { exec } from 'child_process';
import { promisify } from 'util';
const execCleanup = promisify(exec);

/**
 * Purge sent queue messages older than N days
 */
export const purgeOldQueueMessages = async (daysOld = 7) => {
  const queue = await readJson<NyxMessage>(QUEUE_FILE);
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  const kept = queue.filter(m => !m.sent_at || m.sent_at > cutoff);
  const purged = queue.length - kept.length;
  if (purged > 0) {
    await writeJson(QUEUE_FILE, kept);
    console.log(`[CLEANUP] Purged ${purged} sent queue messages older than ${daysOld} days`);
  }
  return purged;
};

/**
 * Trim conversation history to last N messages
 */
export const trimConversations = async (maxMessages = 100) => {
  const conversations = await readJson<ConversationMessage>(CONVERSATION_FILE);
  if (conversations.length > maxMessages) {
    const trimmed = conversations.slice(-maxMessages);
    await writeJson(CONVERSATION_FILE, trimmed);
    console.log(`[CLEANUP] Trimmed conversations from ${conversations.length} to ${maxMessages}`);
    return conversations.length - maxMessages;
  }
  return 0;
};

/**
 * Clean orphaned temp files older than 1 hour
 */
export const cleanTempFiles = async () => {
  let cleaned = 0;
  try {
    // Clean old prompt files
    const { stdout: promptResult } = await execCleanup(
      `find /tmp/nyx-prompts/ -name '*.txt' -mmin +60 -delete -print 2>/dev/null | wc -l`
    );
    cleaned += parseInt(promptResult.trim()) || 0;

    // Clean old response output files
    const { stdout: outputResult } = await execCleanup(
      `find /tmp/nyx-outputs/ -name 'response_*.txt' -mmin +60 -delete -print 2>/dev/null | wc -l`
    );
    cleaned += parseInt(outputResult.trim()) || 0;

    if (cleaned > 0) {
      console.log(`[CLEANUP] Removed ${cleaned} orphaned temp files`);
    }
  } catch (e) {
    console.warn('[CLEANUP] Temp file cleanup error:', e);
  }
  return cleaned;
};

/**
 * Prune old Gemini CLI session data (keeps last 3 sessions)
 */
export const pruneGeminiSessions = async () => {
  try {
    const sessionsDir = join(process.env.HOME || '/home/ubuntu', '.gemini', 'tmp');
    const { stdout } = await execCleanup(
      `ls -1dt ${sessionsDir}/*/ 2>/dev/null | tail -n +4`
    );
    const oldDirs = stdout.trim().split('\n').filter(Boolean);
    for (const dir of oldDirs) {
      await execCleanup(`rm -rf "${dir}"`);
    }
    if (oldDirs.length > 0) {
      console.log(`[CLEANUP] Pruned ${oldDirs.length} old Gemini CLI sessions`);
    }
    return oldDirs.length;
  } catch (e) {
    console.warn('[CLEANUP] Gemini session pruning error:', e);
    return 0;
  }
};

/**
 * Master cleanup — call this periodically (e.g. daily)
 */
export const runSmartCleanup = async () => {
  console.log('[CLEANUP] Running smart cleanup...');
  const results = {
    queuePurged: await purgeOldQueueMessages(7),
    conversationsTrimmed: await trimConversations(100),
    tempFilesCleaned: await cleanTempFiles(),
    sessionsPruned: await pruneGeminiSessions(),
  };
  console.log('[CLEANUP] Done:', results);
  return results;
};
