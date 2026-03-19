import { defineEventHandler, readBody, createError, getRouterParam } from 'h3';
import { updateTask } from '../../utils/db';

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const taskId = parseInt(id || '0', 10);

  if (!taskId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid task ID'
    });
  }

  const body = await readBody(event);

  try {
    const result = await updateTask(taskId, body);

    return {
      success: true,
      message: 'Task updated successfully',
      ...result
    };
  } catch (error: any) {
    if (error.message.includes('not found')) {
      throw createError({
        statusCode: 404,
        statusMessage: error.message
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update task'
    });
  }
});
