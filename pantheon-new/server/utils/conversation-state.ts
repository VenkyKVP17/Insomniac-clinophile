/**
 * Conversation State Management
 * Manages pending actions like email confirmations
 */

import type { EmailDraft } from './gmail-api';

export interface PendingAction {
  id: string;
  type: 'email_confirmation' | 'calendar_confirmation' | 'task_confirmation';
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  data: any;
}

interface EmailConfirmation {
  draft: EmailDraft;
  originalRequest: string;
}

// In-memory storage (you could use Redis or database for production)
const pendingActions = new Map<string, PendingAction>();

/**
 * Create a new pending email confirmation
 */
export function createEmailConfirmation(
  userId: string,
  draft: EmailDraft,
  originalRequest: string
): string {
  const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const action: PendingAction = {
    id,
    type: 'email_confirmation',
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    data: {
      draft,
      originalRequest,
    } as EmailConfirmation,
  };

  pendingActions.set(id, action);

  // Clean up expired actions
  cleanupExpiredActions();

  return id;
}

/**
 * Get pending action by ID
 */
export function getPendingAction(id: string): PendingAction | null {
  const action = pendingActions.get(id);

  if (!action) {
    return null;
  }

  // Check if expired
  if (action.expiresAt < new Date()) {
    pendingActions.delete(id);
    return null;
  }

  return action;
}

/**
 * Get the latest pending action for a user
 */
export function getLatestPendingAction(
  userId: string,
  type?: PendingAction['type']
): PendingAction | null {
  const userActions = Array.from(pendingActions.values())
    .filter(action => action.userId === userId)
    .filter(action => action.expiresAt > new Date())
    .filter(action => !type || action.type === type)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return userActions[0] || null;
}

/**
 * Complete and remove a pending action
 */
export function completePendingAction(id: string): boolean {
  return pendingActions.delete(id);
}

/**
 * Cancel all pending actions for a user
 */
export function cancelUserActions(userId: string, type?: PendingAction['type']): number {
  let count = 0;

  for (const [id, action] of pendingActions.entries()) {
    if (action.userId === userId && (!type || action.type === type)) {
      pendingActions.delete(id);
      count++;
    }
  }

  return count;
}

/**
 * Clean up expired actions
 */
export function cleanupExpiredActions(): number {
  let count = 0;
  const now = new Date();

  for (const [id, action] of pendingActions.entries()) {
    if (action.expiresAt < now) {
      pendingActions.delete(id);
      count++;
    }
  }

  return count;
}

/**
 * Get all pending actions for a user
 */
export function getUserPendingActions(userId: string): PendingAction[] {
  return Array.from(pendingActions.values())
    .filter(action => action.userId === userId)
    .filter(action => action.expiresAt > new Date())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Auto-cleanup expired actions every 5 minutes
setInterval(() => {
  const cleaned = cleanupExpiredActions();
  if (cleaned > 0) {
    console.log(`[STATE] Cleaned up ${cleaned} expired pending actions`);
  }
}, 5 * 60 * 1000);
