import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getTasksDueToday, getTasksDueSoon, getOverdueTasks, getAllTasks, getPendingMessages, markMessagesAsSent, NyxMessage } from './db';

const execAsync = promisify(exec);

/**
 * Feature #2v3: Proactive Daily Briefings
 * JARVIS-style autonomous briefings sent morning and evening
 */

interface BriefingData {
  date: string;
  dayOfWeek: string;
  time: string;
  dailyNote?: string;
  eventsToday: Array<{ time: string; title: string; file: string }>;
  tasksOverdue: number;
  tasksDueToday: number;
  tasksUpcoming: number;
  tasksInProgress: number;
  apolloDuty?: string;
  recentVaultChanges: Array<{ file: string; timestamp: string }>;
}

/**
 * Parse Apollo duty from daily note content
 */
function parseApolloDuty(content: string): string | undefined {
  // Look for patterns like "Duty: M", "Apollo: M", "M duty", etc.
  const dutyPatterns = [
    /duty[:\s]*([MAGNC]|CAMP|MRD|WO|CO|CL)/i,
    /apollo[:\s]*([MAGNC]|CAMP|MRD|WO|CO|CL)/i,
    /([MAGNC]|CAMP|MRD|WO|CO|CL)\s*duty/i,
  ];

  for (const pattern of dutyPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return undefined;
}

/**
 * Parse events from 08-Events folder for today
 */
async function getTodaysEvents(): Promise<Array<{ time: string; title: string; file: string }>> {
  const events: Array<{ time: string; title: string; file: string }> = [];

  try {
    const eventsDir = '/home/ubuntu/vp/08-Events';
    if (!existsSync(eventsDir)) return events;

    // Get all .md files from events folder
    const { stdout } = await execAsync(`find ${eventsDir} -name "*.md" -type f`);
    const files = stdout.trim().split('\n').filter(Boolean);

    const ist = new Date();
    const todayStr = ist.toISOString().split('T')[0]; // YYYY-MM-DD

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');

        // Check if event is for today (look for date in content)
        if (content.includes(todayStr)) {
          // Extract time and title
          const timeMatch = content.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
          const titleMatch = file.split('/').pop()?.replace('.md', '') || 'Event';

          events.push({
            time: timeMatch ? timeMatch[1] : 'All day',
            title: titleMatch,
            file: file.replace('/home/ubuntu/vp/', '')
          });
        }
      } catch (e) {
        // Skip file if can't read
      }
    }
  } catch (e) {
    console.warn('[BRIEFING] Error loading events:', e);
  }

  return events.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Get recent vault changes (last 24 hours)
 */
async function getRecentVaultChanges(): Promise<Array<{ file: string; timestamp: string }>> {
  const changes: Array<{ file: string; timestamp: string }> = [];

  try {
    // Find files modified in last 24 hours
    const { stdout } = await execAsync(
      `find /home/ubuntu/vp -name "*.md" -type f -mtime -1 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.nuxt/*" | head -n 10`
    );

    const files = stdout.trim().split('\n').filter(Boolean);

    for (const file of files) {
      try {
        const { stdout: statOut } = await execAsync(`stat -c %y "${file}"`);
        const timestamp = statOut.trim().split('.')[0]; // Remove milliseconds

        changes.push({
          file: file.replace('/home/ubuntu/vp/', ''),
          timestamp
        });
      } catch (e) {
        // Skip file if can't stat
      }
    }
  } catch (e) {
    console.warn('[BRIEFING] Error loading vault changes:', e);
  }

  return changes.slice(0, 5); // Return top 5
}

/**
 * Gather all briefing data
 */
async function gatherBriefingData(): Promise<BriefingData> {
  const ist = new Date();

  const dateStr = ist.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const dayOfWeek = ist.toLocaleDateString('en-US', { weekday: 'long' });
  const timeStr = ist.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Load today's daily note
  let dailyNote: string | undefined;
  let apolloDuty: string | undefined;
  const dailyNotePath = `/home/ubuntu/vp/00-Daily_Notes/${dateStr}.md`;

  if (existsSync(dailyNotePath)) {
    try {
      dailyNote = await readFile(dailyNotePath, 'utf-8');
      apolloDuty = parseApolloDuty(dailyNote);
    } catch (e) {
      console.warn('[BRIEFING] Could not read daily note:', e);
    }
  }

  // Get tasks
  const overdueTasks = await getOverdueTasks();
  const todayTasks = await getTasksDueToday();
  const upcomingTasks = await getTasksDueSoon(3);
  const inProgressTasks = await getAllTasks('in_progress');

  // Get events
  const eventsToday = await getTodaysEvents();

  // Get recent vault changes
  const recentVaultChanges = await getRecentVaultChanges();

  return {
    date: dateStr,
    dayOfWeek,
    time: timeStr,
    dailyNote,
    eventsToday,
    tasksOverdue: overdueTasks.length,
    tasksDueToday: todayTasks.length,
    tasksUpcoming: upcomingTasks.length,
    tasksInProgress: inProgressTasks.length,
    apolloDuty,
    recentVaultChanges
  };
}

/**
 * Generate morning briefing message
 */
export async function generateMorningBriefing(): Promise<string> {
  const data = await gatherBriefingData();

  let message = `🌅 *Good morning, Sir.*\n\n`;
  message += `Today is *${data.dayOfWeek}, ${data.date}*\n`;
  message += `Current time: ${data.time} IST\n\n`;

  // Apollo duty alert
  if (data.apolloDuty) {
    message += `⚕️ *Apollo Duty:* ${data.apolloDuty}\n`;
    if (['M', 'A', 'G', 'N'].includes(data.apolloDuty)) {
      message += `   Remember to bring your ID card and stethoscope.\n`;
    }
    message += `\n`;
  }

  // Overdue tasks (urgent)
  if (data.tasksOverdue > 0) {
    message += `⚠️ *URGENT:* You have ${data.tasksOverdue} overdue task${data.tasksOverdue > 1 ? 's' : ''}.\n`;
    message += `   Please review them as soon as possible.\n\n`;
  }

  // Tasks due today
  if (data.tasksDueToday > 0) {
    message += `📅 *Today's Tasks:* ${data.tasksDueToday} task${data.tasksDueToday > 1 ? 's' : ''} due today\n\n`;
  }

  // Events today
  if (data.eventsToday.length > 0) {
    message += `📆 *Today's Schedule:*\n`;
    data.eventsToday.forEach(event => {
      message += `   • ${event.time} - ${event.title}\n`;
    });
    message += `\n`;
  }

  // In-progress tasks reminder
  if (data.tasksInProgress > 0) {
    message += `🔄 You have ${data.tasksInProgress} task${data.tasksInProgress > 1 ? 's' : ''} in progress.\n\n`;
  }

  // Upcoming tasks (next 3 days)
  if (data.tasksUpcoming > 0) {
    message += `🔜 *Coming up:* ${data.tasksUpcoming} task${data.tasksUpcoming > 1 ? 's' : ''} due in the next 3 days.\n\n`;
  }

  // Daily note preview (first 200 chars)
  if (data.dailyNote) {
    const preview = data.dailyNote.substring(0, 200).replace(/\n{2,}/g, '\n');
    if (preview.length > 0) {
      message += `📝 *Daily Note Preview:*\n${preview}${data.dailyNote.length > 200 ? '...' : ''}\n\n`;
    }
  }

  message += `_I'm here if you need anything, Sir._\n`;
  message += `— NYX`;

  return message;
}

/**
 * Generate catch-up briefing (post-duty)
 */
export async function generateCatchupBriefing(): Promise<string> {
  const pending = await getPendingMessages();
  if (pending.length === 0) {
    return `🌙 *Post-Duty Check-in*\n\nYour clinical shift has ended. I have no pending alerts for you. All systems are nominal.\n\n_Rest well, Sir._`;
  }

  const PRIORITY_LABELS: Record<number, string> = { 0: '🚨 CRITICAL', 1: '⚠️ HIGH', 2: '✅ INFO', 3: '🔄 STATUS' };
  
  // Group by PA
  const groups: Record<string, NyxMessage[]> = {};
  pending.forEach(m => {
    if (!groups[m.pa_name]) groups[m.pa_name] = [];
    groups[m.pa_name].push(m);
  });

  let message = `🌙 *Post-Duty Catch-up Briefing*\n\n`;
  message += `While you were focused on your clinical duties, I have queued *${pending.length}* updates for your review.\n\n`;

  for (const [pa, msgs] of Object.entries(groups)) {
    message += `*${pa}:*\n`;
    msgs.forEach(m => {
      const label = PRIORITY_LABELS[m.priority] || '';
      message += `   • [${label}] ${m.message}\n`;
    });
    message += `\n`;
  }

  // Mark all as sent
  await markMessagesAsSent(pending.map(m => m.id!).filter(Boolean));

  message += `_All alerts are now cleared. I'm ready for your next command._\n— NYX`;
  return message;
}

/**
 * Generate evening summary message
 */
export async function generateEveningSummary(): Promise<string> {
  const data = await gatherBriefingData();

  let message = `🌙 *Good evening, Sir.*\n\n`;
  message += `End of day summary for *${data.date}*\n`;
  message += `Current time: ${data.time} IST\n\n`;

  // Recent vault activity
  if (data.recentVaultChanges.length > 0) {
    message += `📁 *Today's Vault Activity:*\n`;
    data.recentVaultChanges.forEach(change => {
      const fileName = change.file.split('/').pop() || change.file;
      message += `   • ${fileName}\n`;
    });
    message += `\n`;
  }

  // Task completion check
  if (data.tasksDueToday > 0) {
    message += `✅ You had ${data.tasksDueToday} task${data.tasksDueToday > 1 ? 's' : ''} due today.\n`;
    message += `   Don't forget to mark them complete if you're done.\n\n`;
  }

  // In-progress tasks
  if (data.tasksInProgress > 0) {
    message += `🔄 *In Progress:* ${data.tasksInProgress} task${data.tasksInProgress > 1 ? 's' : ''} still ongoing.\n\n`;
  }

  // Tomorrow's preview
  if (data.tasksUpcoming > 0 || data.tasksDueToday > 0) {
    message += `🔜 *Tomorrow's Agenda:*\n`;
    message += `   Upcoming tasks to review in the morning.\n\n`;
  }

  // Overdue reminder
  if (data.tasksOverdue > 0) {
    message += `⚠️ *Reminder:* ${data.tasksOverdue} overdue task${data.tasksOverdue > 1 ? 's' : ''} need attention.\n\n`;
  }

  message += `_Rest well, Sir. I'll be monitoring the vault overnight._\n`;
  message += `— NYX`;

  return message;
}
