import crypto from 'crypto';
import { defineEventHandler, getHeader, readRawBody, createError, type H3Event } from 'h3';
import { pullVaultChanges } from '../../../utils/git';
import { executeAgentLoop } from '../../../utils/agent';

/**
 * Validates the GitHub webhook signature to ensure the request 
 * actually came from our GitHub repository and wasn't spoofed.
 */
async function verifyGitHubSignature(event: H3Event, secret: string): Promise<boolean> {
    const signature = getHeader(event, 'x-hub-signature-256');
    if (!signature) return false;

    const bodyStr = await readRawBody(event);
    if (!bodyStr) return false;

    // Use bodyStr directly, as it's already readRawBody (which returns a string)
    // and crypto.update accepts string when specifying the encoding
    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(bodyStr, 'utf8')
        .digest('hex');

    // Secure constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig();
    const WEBHOOK_SECRET = config.githubWebhookSecret as string;
    const VAULT_PATH = config.vaultPath as string;

    // 1. Validate Environment Variables
    if (!WEBHOOK_SECRET || !VAULT_PATH) {
        console.error("[WEBHOOK] Missing GITHUB_WEBHOOK_SECRET or VAULT_PATH in .env");
        throw createError({ statusCode: 500, statusMessage: 'Server configuration error' });
    }

    // 2. Validate GitHub Signature
    const isValid = await verifyGitHubSignature(event, WEBHOOK_SECRET as string);
    if (!isValid) {
        console.warn("[WEBHOOK] Invalid GitHub signature detected. Rejecting.");
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Invalid Signature' });
    }

    // 3. Process the Push Event
    const eventType = getHeader(event, 'x-github-event');
    if (eventType === 'ping') {
        console.log("[WEBHOOK] Ping event received. Webhook is active.");
        return { status: 'success', message: 'Ping received loud and clear.' };
    }

    if (eventType === 'push') {
        console.log("[WEBHOOK] Valid push event received. Checking for Vault changes...");

        try {
            const changedFiles = await pullVaultChanges(VAULT_PATH as string);
            console.log(`[WEBHOOK] Successfully pulled ${changedFiles.length} files.`);
            console.log(changedFiles);

            // 6. Trigger Executive Loop Asynchronously (don't await)
            // Run this in the background so GitHub gets a fast 200 OK.
            const agentConfig = {
                vaultPath: config.vaultPath as string,
                groqApiKey: config.groqApi as string,
                telegramBotToken: config.telegramBotToken as string,
                userChatId: config.userChatId as string
            };

            if (changedFiles.length > 0) {
                executeAgentLoop(changedFiles, agentConfig).catch(err => {
                    console.error("[WEBHOOK/AGENT] Background Agent Executor failed to run.", err);
                });
            }

            // 7. Acknowledge Receipt
            return {
                success: true,
                message: 'Sync successful & background agent triggered.',
                filesChanged: changedFiles
            };
        } catch (error) {
            console.error("[WEBHOOK] Failed to pull changes:", error);
            throw createError({ statusCode: 500, statusMessage: 'Failed to sync vault' });
        }
    }

    return { status: 'ignored', message: 'Event type not handled.' };
});
