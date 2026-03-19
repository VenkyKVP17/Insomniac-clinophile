/**
 * Feature #1: Next Action Engine (Predictive Buttons)
 * Dynamically suggests Telegram buttons based on message content and context.
 */

import { TelegramButton } from './telegram';

export function suggestButtons(message: string, paName?: string): TelegramButton[][] | undefined {
    const buttons: TelegramButton[] = [];
    const msg = message.toLowerCase();

    // 1. Finance & Maintenance (PLUTUS/MIDAS/HEPHAESTUS)
    if (msg.includes('mechanic') || msg.includes('indica') || msg.includes('repair') || msg.includes('radiator')) {
        buttons.push({ text: '💰 Log Expense', callback_data: 'agent:finance' });
        buttons.push({ text: '📞 Call Mechanic', url: 'tel:+910000000000' }); // Replace with actual number if known
    } else if (msg.includes('market') || msg.includes('nifty') || msg.includes('buy signal')) {
        buttons.push({ text: '📈 View Market', callback_data: 'agent:market' });
        buttons.push({ text: '💰 Check Funds', callback_data: 'agent:finance' });
    }
    // 2. Tasks & Schedule (CHRONOS/AIAS)
    else if (msg.includes('overdue') || msg.includes('pending task') || msg.includes('assignment')) {
        buttons.push({ text: '🛡️ View Tasks', callback_data: 'view:tasks_high' });
        buttons.push({ text: '✅ Mark Done', callback_data: 'view:tasks_overdue' });
    } else if (msg.includes('morning briefing') || msg.includes('good morning')) {
        buttons.push({ text: '🏥 Duty Status', callback_data: 'agent:duty' });
        buttons.push({ text: '📅 Next Event', callback_data: 'view:next_event' });
    }
    // 3. Medical & Duty (ASCLEPIUS/MOIRA)
    else if (msg.includes('duty') || msg.includes('apollo') || msg.includes('envision')) {
        buttons.push({ text: '🕒 Shift Info', callback_data: 'agent:duty' });
        buttons.push({ text: '🪢 Roster', callback_data: 'agent:roster' });
    }
    // 4. Learning & Study (METIS/MNEMOSYNE)
    else if (msg.includes('mba') || msg.includes('study') || msg.includes('exam')) {
        buttons.push({ text: '📜 Study Plan', callback_data: 'agent:study' });
        buttons.push({ text: '🧠 Quiz Me', callback_data: 'agent:mnemosyne' });
    }
    // 5. Grooming (HYGIEIA)
    else if (msg.includes('beard trim') || msg.includes('haircut')) {
        buttons.push({ text: '✅ Done', callback_data: 'agent:hygieia:complete' });
        buttons.push({ text: '⏳ Postpone', callback_data: 'view:reschedule' });
    }

    if (buttons.length === 0) return undefined;

    // Layout: Max 2 buttons per row
    const layout: TelegramButton[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
        layout.push(buttons.slice(i, i + 2));
    }
    
    return layout;
}
