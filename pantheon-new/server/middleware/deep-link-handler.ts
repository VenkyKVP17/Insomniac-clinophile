/**
 * Deep Link Handler Middleware (Track 4.2)
 * Handles URL parameters for deep linking into NYX-Visual PWA
 *
 * Supported params:
 * - ?view=finance - Open finance view
 * - ?view=audit - Open audit view
 * - ?agent=plutus - Query specific agent
 * - ?task=123 - Open specific task
 * - ?action=approve&id=xyz - Execute action
 */

export default defineEventHandler((event) => {
    const url = getRequestURL(event);
    const params = url.searchParams;

    // Check for deep link parameters
    const view = params.get('view');
    const agent = params.get('agent');
    const task = params.get('task');
    const action = params.get('action');

    if (view || agent || task || action) {
        console.log('[DEEP-LINK] Parameters detected:', {
            view,
            agent,
            task,
            action
        });

        // Store deep link context in event for downstream handlers
        event.context.deepLink = {
            view,
            agent,
            task,
            action,
            params: Object.fromEntries(params.entries())
        };
    }
});
