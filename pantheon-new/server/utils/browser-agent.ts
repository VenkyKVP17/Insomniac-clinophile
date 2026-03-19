/**
 * Browser Agent Utility
 * Manages headless browser sessions via Playwright
 * Implements "Diet Chromium" for minimal RAM usage
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowseOptions {
    url: string;
    waitSelector?: string;
    timeout?: number;
    blockMedia?: boolean;
}

export interface BrowseResult {
    success: boolean;
    title: string;
    content: string;
    url: string;
    error?: string;
}

/**
 * Executes a one-off browser task and cleans up immediately
 * Zero-Idle Policy enforced.
 */
export async function browse(options: BrowseOptions): Promise<BrowseResult> {
    let browser: Browser | null = null;
    
    try {
        console.log(`[BROWSER-AGENT] Visiting: ${options.url}`);
        
        // Diet Chromium Flags
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });

        const page = await context.newPage();

        // Optional: Block media to save RAM/bandwidth
        if (options.blockMedia !== false) {
            await page.route('**/*.{png,jpg,jpeg,gif,svg,mp4,webm,woff,woff2}', route => route.abort());
        }

        // Navigate with timeout
        await page.goto(options.url, { 
            waitUntil: 'networkidle', 
            timeout: options.timeout || 30000 
        });

        if (options.waitSelector) {
            await page.waitForSelector(options.waitSelector, { timeout: 10000 });
        }

        const title = await page.title();
        
        // Extract main text content (simplified readability)
        const content = await page.evaluate(() => {
            // Remove scripts, styles, and nav elements to get cleaner text
            const scripts = document.querySelectorAll('script, style, nav, footer, header');
            scripts.forEach(s => s.remove());
            return document.body.innerText.trim();
        });

        return {
            success: true,
            title,
            content: content.substring(0, 10000), // Cap at 10k chars for LLM context
            url: page.url()
        };

    } catch (error: any) {
        console.error(`[BROWSER-AGENT] Error:`, error.message);
        return {
            success: false,
            title: '',
            content: '',
            url: options.url,
            error: error.message
        };
    } finally {
        if (browser) {
            await browser.close();
            console.log(`[BROWSER-AGENT] Session closed.`);
        }
    }
}
