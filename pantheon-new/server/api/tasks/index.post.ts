import { defineEventHandler, readBody, createError } from 'h3';
import { createTask } from '../../utils/db';
import type { NyxTask } from '../../utils/db';

/**
 * POST /api/tasks
 * Create a new task
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const { title, description, due_date, priority, tags, related_files } = body;

  if (!title || !description) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Title and description are required'
    });
  }

  try {
    const result = await createTask({
      title,
      description,
      due_date,
      status: 'pending',
      priority: priority || 'medium',
      tags,
      related_files
    });

    return {
      success: true,
      message: 'Task created successfully',
      ...result
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create task'
    });
  }
});
