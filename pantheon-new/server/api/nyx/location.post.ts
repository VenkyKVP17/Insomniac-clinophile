import { defineEventHandler, readBody, createError } from 'h3';
import { runNyxLocationBriefing } from '../../utils/ai';
import { sendTelegramMessage } from '../../utils/telegram';
import { runAgent } from '../../utils/agent-runner';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { updateUserLocation } from '../../utils/db';

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();

    // ── Security Check ──────────────────────────────────────────────────────────
    const headers = getHeaders(event);
    const query = getQuery(event);
    
    // Check header OR query parameter
    const apiKey = getHeader(event, 'x-pantheon-key') || query.key;
    const expectedKey = config.pantheonApiKey;
    
    console.log('[DEBUG] All Headers:', JSON.stringify(headers));
    console.log('[DEBUG] Incoming API Key (Header or Query):', apiKey);
    console.log('[DEBUG] Expected API Key:', expectedKey);

    if (!apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    let body;
    try {
        body = await readBody(event);
        console.log('[DEBUG] Received Body:', JSON.stringify(body));
    } catch (e: any) {
        const rawBody = await readRawBody(event, 'utf-8');
        console.error('[DEBUG] JSON Parse Error. Raw Body:', rawBody);
        throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body: ' + e.message });
    }
    
    // Expecting: { lat, lon, event: 'enter'|'exit', place_id: 'optional' }
    const { lat, lon, event: locationEvent, place_id } = body;

    if (!locationEvent) {
        throw createError({ statusCode: 400, statusMessage: 'Missing location event type' });
    }

    const VAULT_PATH = '/home/ubuntu/vp';
    const GEOFENCES_PATH = join(VAULT_PATH, '07-Places/geofences.json');
    
    try {
        const geofencesRaw = await readFile(GEOFENCES_PATH, 'utf-8');
        const { locations } = JSON.parse(geofencesRaw);
        
        let targetLocation = locations.find((loc: any) => loc.id === place_id);
        
        // If no place_id, calculate based on lat/lon (fallback)
        if (!targetLocation && lat && lon) {
            targetLocation = locations.find((loc: any) => {
                const dist = calculateDistance(lat, lon, loc.lat, loc.lon);
                return dist <= loc.radius_meters;
            });
        }

        if (!targetLocation) {
            console.log('[LOCATION] No matching geofence found for coordinates:', lat, lon);
            // If exiting and no new match, clear location state
            if (locationEvent === 'exit') {
                await updateUserLocation(null);
            }
            return { ok: true, status: 'no_match' };
        }

        console.log(`[LOCATION] VPK ${locationEvent}ed ${targetLocation.name}`);

        // --- FEATURE: TRACK USER LOCATION FOR QUIET MODE ---
        if (locationEvent === 'enter') {
            await updateUserLocation(targetLocation.id, targetLocation.name);
        } else if (locationEvent === 'exit') {
            await updateUserLocation(null);
        }

        // --- FEATURE #1: AUTO-DUTY ATTENDANCE LOGGING ---
        if (targetLocation.id === 'apollo' || targetLocation.id === 'envision') {
            try {
                const now = new Date();
                const istOffset = 5.5 * 60 * 60 * 1000;
                const ist = new Date(now.getTime() + istOffset);
                const dateStr = ist.toISOString().split('T')[0]; // YYYY-MM-DD
                
                // Format for Obsidian filename: Mar 13, 2026.md
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const obsidianFileName = `${months[ist.getUTCMonth()]} ${String(ist.getUTCDate()).padStart(2, '0')}, ${ist.getUTCFullYear()}.md`;
                const dailyNotePath = join(VAULT_PATH, '00-Daily_Notes', obsidianFileName);
                
                const timeStr = ist.getUTCHours().toString().padStart(2, '0') + ':' + ist.getUTCMinutes().toString().padStart(2, '0');
                const logEntry = `\n- [x] 🏥 ${targetLocation.name} Duty: ${locationEvent === 'enter' ? 'Arrival' : 'Departure'} @ ${timeStr}`;
                
                const fs = await import('fs/promises');
                let content = '';
                try {
                    content = await fs.readFile(dailyNotePath, 'utf-8');
                } catch (e) {
                    content = `---\ndate: '${dateStr}'\n---\n`;
                }
                
                await fs.writeFile(dailyNotePath, content.trim() + logEntry + '\n');
                console.log(`[LOCATION] Logged ${locationEvent} to ${obsidianFileName}`);
            } catch (e) {
                console.error('[LOCATION] Failed to log attendance:', e);
            }
        }

        // Gather Context Data (Always include Duty & Schedule for proactive briefings)
        let contextData = '';
        
        // Fetch Medical Duty Status (ASCLEPIUS)
        try {
            const asclepius = await runAgent('duty', VAULT_PATH);
            contextData += `[MEDICAL DUTY]:\n${asclepius.message}\n`;
        } catch (e) {
            console.error('[LOCATION] Failed to fetch duty context:', e);
        }
        
        // Fetch Schedule (CHRONOS)
        try {
            const schedule = await runAgent('schedule', VAULT_PATH);
            contextData += `[SCHEDULE]:\n${schedule.message}\n`;
        } catch (e) {
            console.error('[LOCATION] Failed to fetch schedule context:', e);
        }

        // Fetch AIAS Tasks for this location (Feature #14)
        try {
            const fs = await import('fs/promises');
            const tasksPath = join(VAULT_PATH, '.scripts/aias_tasks.json');
            const tasksRaw = await fs.readFile(tasksPath, 'utf-8');
            const tasks = JSON.parse(tasksRaw);
            const localTasks = tasks.filter((t: any) => t.locations && t.locations.includes(targetLocation.id));
            
            if (localTasks.length > 0) {
                contextData += `\n[🛡️ AIAS LOCAL TASKS]:\n`;
                localTasks.forEach((t: any) => {
                    contextData += `- ${t.content} (Prio: ${t.prio}, Due: ${t.due || 'N/A'})\n`;
                });
            }
        } catch (e) {
            console.warn('[LOCATION] AIAS task retrieval failed (likely no index yet)');
        }

        // Generate Briefing via NYX
        const briefing = await runNyxLocationBriefing(
            targetLocation.name,
            locationEvent,
            contextData,
            config.groqApi as string,
            config.googleApi as string
        );

        if (briefing) {
            await sendTelegramMessage({
                message: briefing,
                pa_name: 'NYX',
                botToken: config.telegramBotToken as string,
                chatId: config.userChatId as string
            });
        }

        return { ok: true, location: targetLocation.name };

    } catch (error: any) {
        console.error('[LOCATION] Error processing location event:', error);
        return { ok: false, error: error.message };
    }
});

/**
 * Haversine formula to calculate distance between two points in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
