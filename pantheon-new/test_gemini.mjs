#!/usr/bin/env node
/**
 * Quick test script for Gemini CLI integration
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testGeminiCLI() {
    console.log('🧪 Testing Gemini CLI Integration...\n');

    // Test 1: Check if Gemini is installed
    console.log('1️⃣  Checking Gemini CLI installation...');
    try {
        const { stdout: whichOutput } = await execAsync('which gemini');
        console.log('   ✅ Gemini CLI found at:', whichOutput.trim());
    } catch (error) {
        console.log('   ❌ Gemini CLI not found!');
        process.exit(1);
    }

    // Test 2: Get version
    console.log('\n2️⃣  Getting Gemini CLI version...');
    try {
        const { stdout: versionOutput } = await execAsync('gemini --version 2>&1 | head -1', { timeout: 5000 });
        console.log('   ✅ Version:', versionOutput.trim());
    } catch (error) {
        console.log('   ⚠️  Could not get version');
    }

    // Test 3: Test headless mode
    console.log('\n3️⃣  Testing Gemini CLI in headless mode...');
    try {
        const testPrompt = 'Say "Hello from Gemini CLI!" and nothing else.';
        const escapedPrompt = testPrompt.replace(/'/g, "'\\''");
        const command = `gemini -p '${escapedPrompt}'`;

        console.log('   Running:', command);
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30000,
            env: { ...process.env, FORCE_COLOR: '0' }
        });

        if (stderr && stderr.trim()) {
            console.log('   ⚠️  Stderr:', stderr.trim());
        }

        const response = stdout.trim()
            .replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
            .replace(/^>\s*/gm, '')
            .trim();

        console.log('   ✅ Response received:', response);
    } catch (error) {
        console.log('   ❌ Failed:', error.message);
        process.exit(1);
    }

    // Test 4: Test with NYX personality
    console.log('\n4️⃣  Testing with NYX personality...');
    try {
        const nyxPrompt = `You are NYX, VPK's executive assistant. Respond to this greeting in character: "Hello NYX, status report?"`;
        const escapedPrompt = nyxPrompt.replace(/'/g, "'\\''");
        const command = `gemini -p '${escapedPrompt}'`;

        console.log('   Testing NYX persona...');
        const { stdout } = await execAsync(command, {
            timeout: 30000,
            env: { ...process.env, FORCE_COLOR: '0' }
        });

        const response = stdout.trim()
            .replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
            .replace(/^>\s*/gm, '')
            .trim();

        console.log('   ✅ NYX Response:');
        console.log('   ' + response.split('\n').join('\n   '));
    } catch (error) {
        console.log('   ❌ Failed:', error.message);
        process.exit(1);
    }

    console.log('\n✨ All tests passed! Gemini CLI is ready for use.\n');
}

testGeminiCLI().catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
