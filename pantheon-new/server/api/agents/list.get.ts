import { promises as fs } from 'fs';
import { join } from 'path';

export default defineEventHandler(async (event) => {
    try {
        const registryPath = '/home/ubuntu/vp/.agents/agent_registry.json';
        const data = await fs.readFile(registryPath, 'utf-8');
        const registry = JSON.parse(data);
        
        return {
            success: true,
            data: registry.agents || []
        };
    } catch (error) {
        console.error('Failed to load agent registry:', error);
        return createError({
            statusCode: 500,
            statusMessage: 'Failed to load agent registry',
        });
    }
});
