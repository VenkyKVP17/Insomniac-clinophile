import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getUserLocation } from './db';

/**
 * Duty Utils
 * Detects Apollo duty and shift timings
 */

export type DutyType = 'M' | 'A' | 'N' | 'G' | 'CAMP' | 'MRD' | 'WO' | 'CO' | 'CL' | 'Unknown';

export interface DutyShift {
    type: DutyType;
    startHour: number; // 24h format
    endHour: number;   // 24h format
}

const DUTY_SHIFTS: Record<string, { start: number; end: number }> = {
    'M': { start: 8, end: 14 },     // Morning: 08:00 - 14:00
    'A': { start: 14, end: 21 },    // Afternoon: 14:00 - 21:00
    'G': { start: 9, end: 17 },     // General: 09:00 - 17:00
    'N': { start: 21, end: 8 },     // Night: 21:00 - 08:00 (next day)
};

/**
 * Parse Apollo duty from daily note content
 */
export function parseApolloDuty(content: string): DutyType {
    const dutyPatterns = [
        /duty[:\s]*([MAGNC]|CAMP|MRD|WO|CO|CL)/i,
        /apollo[:\s]*([MAGNC]|CAMP|MRD|WO|CO|CL)/i,
        /([MAGNC]|CAMP|MRD|WO|CO|CL)\s*duty/i,
    ];

    for (const pattern of dutyPatterns) {
        const match = content.match(pattern);
        if (match) {
            return match[1].toUpperCase() as DutyType;
        }
    }

    return 'Unknown';
}

/**
 * Get today's duty from the daily note
 */
export async function getTodayDuty(): Promise<DutyType> {
    const ist = new Date();
    const dateStr = ist.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const dailyNotePath = `/home/ubuntu/vp/00-Daily_Notes/${dateStr}.md`;

    if (existsSync(dailyNotePath)) {
        try {
            const content = await readFile(dailyNotePath, 'utf-8');
            return parseApolloDuty(content);
        } catch (e) {
            console.warn('[DUTY] Could not read daily note:', e);
        }
    }
    return 'Unknown';
}

/**
 * Check if the user is currently on duty based on the time, duty type, and physical location
 */
export async function isUserOnDuty(): Promise<boolean> {
    // --- FEATURE: LOCATION-BASED QUIET MODE ---
    const location = await getUserLocation();
    if (location && (location.id === 'apollo' || location.id === 'envision')) {
        return true;
    }

    const duty = await getTodayDuty();
    if (duty === 'Unknown' || duty === 'WO' || duty === 'CO') return false;

    const shift = DUTY_SHIFTS[duty];
    if (!shift) return false;

    const now = new Date();
    const currentHour = now.getHours();

    if (shift.start < shift.end) {
        // Same day shift (e.g. 08:00 - 14:00)
        return currentHour >= shift.start && currentHour < shift.end;
    } else {
        // Overnight shift (e.g. 21:00 - 08:00)
        return currentHour >= shift.start || currentHour < shift.end;
    }
}
