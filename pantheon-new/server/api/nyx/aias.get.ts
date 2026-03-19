import { defineEventHandler, createError } from 'h3';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/nyx/aias
 * Returns the latest task index from AIAS Sentinel
 */
export default defineEventHandler(async (event) => {
    const VAULT_PATH = '/home/ubuntu/vp';
    const TASKS_DB = join(VAULT_PATH, '.scripts/aias_tasks.json');

    try {
        const data = await readFile(TASKS_DB, 'utf-8');
        const tasks = JSON.parse(data);
        
        // Add some basic stats
        const highPrio = tasks.filter((t: any) => t.prio === 'high').length;
        const overdue = tasks.filter((t: any) => {
            if (!t.due) return false;
            const dueDate = new Date(t.due);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return dueDate < today;
        }).length;

        return {
            success: true,
            tasks,
            stats: {
                total: tasks.length,
                highPriority: highPrio,
                overdue: overdue
            },
            lastUpdated: new Date().toISOString()
        };
    } catch (error: any) {
        return {
            success: false,
            message: 'AIAS index not found or unreadable',
            tasks: [],
            stats: { total: 0, highPriority: 0, overdue: 0 }
        };
    }
});
