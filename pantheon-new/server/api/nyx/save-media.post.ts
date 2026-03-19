/// <reference types="node" />
import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import { join } from 'path';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import fetch from 'node-fetch';

/**
 * POST /api/nyx/save-media
 * Bridge for n8n to save images/files to the vault.
 * Used by IRIS (Google Photos) and NYX-Verbal (Telegram Media).
 * 
 * Auth: X-Pantheon-Key
 */
export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const expectedKey = config.pantheonApiKey as string;
    const apiKey = getHeader(event, 'x-pantheon-key');

    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const body = await readBody<{ url: string, filename: string, id: string, target_dir: string }>(event);
    
    if (!body?.url || !body?.filename || !body?.target_dir) {
        throw createError({ statusCode: 400, statusMessage: 'Missing parameters' });
    }

    const VAULT_PATH = '/home/ubuntu/vp';
    const targetPath = join(VAULT_PATH, body.target_dir);
    const filePath = join(targetPath, `${Date.now()}_${body.filename}`);
    const syncLogPath = join(targetPath, '.n8n_sync_log.json');

    try {
        // 1. Check if already synced (to avoid duplicates from n8n polling)
        let syncLog = [];
        if (existsSync(syncLogPath)) {
            const raw = await readFile(syncLogPath, 'utf-8');
            syncLog = JSON.parse(raw);
        }

        if (body.id && syncLog.includes(body.id)) {
            return { success: true, status: 'already_synced' };
        }

        // 2. Ensure directory exists
        if (!existsSync(targetPath)) {
            await mkdir(targetPath, { recursive: true });
        }

        // 3. Download the file
        console.log(`[MEDIA-BRIDGE] Downloading ${body.filename} to ${body.target_dir}...`);
        const response = await fetch(body.url);
        if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
        
        const buffer = await response.buffer();
        await writeFile(filePath, buffer);

        // 4. Update sync log
        if (body.id) {
            syncLog.push(body.id);
            // Keep log small (last 500 IDs)
            if (syncLog.length > 500) syncLog.shift();
            await writeFile(syncLogPath, JSON.stringify(syncLog));
        }

        return { 
            success: true, 
            path: filePath,
            filename: body.filename
        };
    } catch (err: any) {
        console.error('[MEDIA-BRIDGE] Error:', err.message);
        throw createError({ 
            statusCode: 500, 
            statusMessage: `Media Bridge failed: ${err.message}` 
        });
    }
});
