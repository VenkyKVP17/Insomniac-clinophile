import { getAgentLogs, readJson } from '../../utils/db';
import { promises as fs } from 'fs';
import { join } from 'path';

export default defineEventHandler(async (event) => {
    const name = event.context.params?.name;
    if (!name) {
        return createError({
            statusCode: 400,
            statusMessage: 'Agent name is required',
        });
    }

    try {
        // 1. Fetch registry info
        const registryPath = '/home/ubuntu/vp/.agents/agent_registry.json';
        const registryData = await fs.readFile(registryPath, 'utf-8');
        const registry = JSON.parse(registryData);
        const agentInfo = registry.agents.find((a: any) => a.name.toLowerCase() === name.toLowerCase());

        // 2. Fetch logs and filter
        // Note: getAgentLogs returns last 100, we filter those.
        // For a more robust solution, we'd add filtering to getAgentLogs.
        const allLogs = await getAgentLogs(500);
        const agentLogs = allLogs.filter(log => log.pa_name.toLowerCase() === name.toLowerCase());

        // 3. Fetch pending messages (communication log)
        const queueFile = join(process.cwd(), 'data', 'nyx_queue.json');
        const queue = await readJson<any[]>(queueFile, []);
        const communicationLog = queue.filter(m => 
            m.pa_name.toLowerCase() === name.toLowerCase() || 
            (m.message && m.message.toLowerCase().includes(name.toLowerCase()))
        ).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);

        return {
            success: true,
            data: {
                info: agentInfo,
                logs: agentLogs,
                communication: communicationLog
            }
        };
    } catch (error) {
        console.error(`Failed to get details for agent ${name}:`, error);
        return createError({
            statusCode: 500,
            statusMessage: `Failed to retrieve details for ${name}`,
        });
    }
});
