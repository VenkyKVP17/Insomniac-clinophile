import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Feature #3: Predictive Anomaly Detection
 * Analyzes spending velocity and trends from transactions.csv
 */

const VAULT_PATH = '/home/ubuntu/vp';
const CSV_PATH = join(VAULT_PATH, '04-Finance/transactions.csv');
const PANTHEON_URL = 'http://localhost:3000';
const API_KEY = '65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863';

interface Transaction {
    date: string;
    amount: number;
    category: string;
    type: string;
}

async function parseTransactions(): Promise<Transaction[]> {
    try {
        const raw = await readFile(CSV_PATH, 'utf-8');
        // Clean up null characters and split lines
        const lines = raw.replace(/\0/g, '').split('\n').filter(l => l.trim() !== '');
        const transactions: Transaction[] = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 6) continue;

            const date = cols[0].trim();
            const amount = parseFloat(cols[5].trim());
            const type = cols[6]?.trim().toLowerCase() || 'expense';
            const category = cols[7]?.trim() || 'General';

            if (!isNaN(amount) && type === 'expense') {
                transactions.push({ date, amount, category, type });
            }
        }
        return transactions;
    } catch (e) {
        console.error('[ANALYTICS] Failed to parse transactions:', e);
        return [];
    }
}

export async function checkSpendingVelocity() {
    const transactions = await parseTransactions();
    if (transactions.length === 0) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dayOfMonth = now.getDate();

    // 1. Calculate Current Month Spending
    const monthExpenses = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalSpentThisMonth = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const dailyVelocity = totalSpentThisMonth / dayOfMonth;

    // 2. Calculate Historical Average (Previous Month)
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const historicalExpenses = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const totalSpentPrevMonth = historicalExpenses.reduce((sum, t) => sum + t.amount, 0);
    const prevDailyVelocity = totalSpentPrevMonth / 30; // Average month

    // 3. Compare and Alert
    const threshold = 1.3; // 30% increase
    if (dailyVelocity > (prevDailyVelocity * threshold) && totalSpentThisMonth > 5000) {
        const percentIncrease = Math.round(((dailyVelocity / prevDailyVelocity) - 1) * 100);
        
        await fetch(`${PANTHEON_URL}/api/internal/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Pantheon-Key': API_KEY },
            body: JSON.stringify({
                pa_name: 'PLUTUS',
                priority: 1, // High
                message: `📉 *Spending Anomaly Detected*\nYour daily spend velocity is ₹${Math.round(dailyVelocity)}/day, which is *${percentIncrease}% higher* than last month (₹${Math.round(prevDailyVelocity)}/day).\n\n_Suggestion: Review Dining_out and Misc expenses to remain within budget._`
            })
        });
    }
}
