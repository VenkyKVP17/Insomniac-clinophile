import { defineEventHandler, getQuery, createError } from 'h3';
import { getAllTasks, getTasksDueToday, getTasksDueSoon, getOverdueTasks } from '../../utils/db';

/**
 * GET /api/tasks
 * Get tasks with optional filtering
 * Query params:
 *   - status: pending | in_progress | completed | cancelled
 *   - filter: due_today | due_soon | overdue
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const status = query.status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined;
  const filter = query.filter as 'due_today' | 'due_soon' | 'overdue' | undefined;

  try {
    if (filter === 'due_today') {
      const tasks = await getTasksDueToday();
      return { success: true, tasks, count: tasks.length };
    }

    if (filter === 'due_soon') {
      const tasks = await getTasksDueSoon(3);
      return { success: true, tasks, count: tasks.length };
    }

    if (filter === 'overdue') {
      const tasks = await getOverdueTasks();
      return { success: true, tasks, count: tasks.length };
    }

    const tasks = await getAllTasks(status);
    return { success: true, tasks, count: tasks.length };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch tasks'
    });
  }
});
