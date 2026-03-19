# 🌐 Headless Browser Integration: Feasibility Plan for Pantheon

Adding an autonomous headless browser (the "Lobster" equivalent) to the Pantheon architecture gives NYX the ability to interact directly with the internet on your behalf. This plan outlines how to integrate this capability while respecting our core constraints: security, reliability, and our ~12GB physical server limit.

## 1. The Chosen Tool: Playwright (over Puppeteer)

### Why Playwright?
*   **Auto-Wait Protocol:** Playwright natively waits for elements to be actionable (visible, enabled) before clicking, drastically reducing flakey errors on slow healthcare or banking portals.
*   **Browser Contexts:** It allows for creating isolated "incognito" browser instances instantly, meaning NYX can perform tasks without polluting a main browser state.
*   **Network Interception:** Playwright can easily block image/video loading to save RAM and bandwidth, essential for running on our constrained server.

## 2. Architectural Integration

We will introduce a new specialized utility module `server/utils/browser-agent.ts` to manage the browser lifecycle and run automation scripts.

### The Execution Flow:
1.  **Trigger:** You ask NYX "Fetch the latest papers on CABG mortality from PubMed."
2.  **Intent Recognition:** The Groq/Gemini routing layer identifies the intent requires live web access and routes the command to the Headless Browser Utility.
3.  **Boot & Navigate:** 
    *   Playwright launches an isolated Chromium context.
    *   Image/CSS loading is blocked to conserve RAM.
    *   The agent navigates to the target URL.
4.  **Interaction:** The LLM directs Playwright on what CSS selectors to click, what text to type, or what data to extract.
5.  **Shutdown & Synthesis:** The browser is immediately closed. Extracted text is passed to NYX for summarization, or directly indexed into the Vector DB via the `indexSpecificFiles` pipeline.

## 3. The Resource Constraint Strategy

Headless Chrome is notoriously resource-heavy. Left unmanaged, it will crash the Pantheon Nitro server.

*   **Zero-Idle Policy:** The browser process (`chrome.exe`/`chromium`) must *never* run in the background. It boots exactly when needed and terminates completely when the task ends.
*   **Concurrency Limits:** Only 1 active browser session is permitted at any time. If NYX is currently scraping a portal and you ask for another web task, the second task is queued.
*   **Diet Chromium:** We will run Chromium with flags specifically designed to minimize overhead (`--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu`, `--disable-extensions`).

## 4. Security & Credential Management

Allowing an LLM to navigate the web with your personal credentials (e.g., Apollo Portal, banking) requires absolute compartmentalization.

*   **No Auto-Discovery:** NYX will *not* be allowed to "guess" passwords or search your vault for them dynamically during a live web session. 
*   **The Credential Vault:** Secure credentials will be stored as encrypted environment variables in `.env` (e.g., `APOLLO_PORTAL_USER`, `APOLLO_PORTAL_PASS`). 
*   **Hardcoded Workflows for High-Risk Sites:** For sensitive portals like banking or EMR/EHR, the LLM will *not* be allowed to drive the browser freely. Instead, we will write strict, hardcoded Playwright scripts (e.g., `scrape-apollo-roster.ts`) that the LLM is only permitted to *trigger*, not modify on the fly. For open web research (like PubMed), the LLM can navigate autonomously.

## 5. Implementation Phases (Proposed)

### Phase 1: Infrastructure Setup (Low Risk)
*   Install `playwright` core (bypassing full browser downloads to use system chromium if possible, or specifically downloading just the minimal chromium binary).
*   Create `browser-agent.ts` with the "Diet Chromium" boot/shutdown lifecycle.
*   Create a simple API endpoint `POST /api/nyx/browse` that takes a URL, visits it, extracts the main text content, and closes the browser.

### Phase 2: Autonomous Open-Web Research (Medium Risk)
*   Integrate a tool into NYX's Gemini/Groq prompt allowing her to call the browser API to search Google or specific public domains (e.g., PubMed) to answer questions when her training data is insufficient.
*   Pipe scraped text directly into the semantic search pipeline for summarization.

### Phase 3: The "Lobster" Protocol - Authenticated Tasks (High Risk)
*   Write specific, deterministic Playwright scripts for high-value targets (e.g., your hospital duty roster portal).
*   Store credentials securely in `.env`.
*   Grant NYX the specific tool to execute the `scrape-duty-roster` command.

## Conclusion

Integrating Playwright is highly feasible on the Pantheon server, provided we strictly enforce the **Zero-Idle Policy** to protect RAM. It fundamentally transforms NYX from a reactive answer-engine into a proactive digital assistant capable of bridging the gap between your physical workspace (the vault) and the external clinical/financial web.
