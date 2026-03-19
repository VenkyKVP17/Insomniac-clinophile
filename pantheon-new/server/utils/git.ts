import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Executes a git pull and returns an array of files that changed
 * during the most recent pull.
 * 
 * @param repoPath Absolute path to the git repository
 * @returns Array of relative file paths that changed
 */
export async function pullVaultChanges(repoPath: string): Promise<string[]> {
    try {
        // 1. Execute git pull to sync changes from remote (GitHub)
        console.log(`[GIT] Pulling latest changes in ${repoPath}`);
        const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull', { cwd: repoPath });

        if (pullOutput.includes('Already up to date')) {
            console.log('[GIT] Vault is already up to date.');
            return [];
        }

        // 2. Identify which files just changed using git diff.
        // HEAD@{1} refers to the state before the pull. HEAD is the current state.
        console.log('[GIT] Identifying changed files...');
        const { stdout: diffOutput } = await execAsync('git diff --name-only HEAD@{1} HEAD', { cwd: repoPath });

        // Split by newline, trim, and filter out any empty strings
        const changedFiles = diffOutput.split('\n').map((f: string) => f.trim()).filter((f: string) => f.length > 0);

        console.log(`[GIT] Detected ${changedFiles.length} changed files.`);
        return changedFiles;

    } catch (error) {
        console.error(`[GIT] Error pulling vault changes:`, error);
        throw error;
    }
}
