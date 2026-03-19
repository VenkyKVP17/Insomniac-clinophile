/**
 * Agent Registry Configuration
 * Maps slash commands to agent scripts and metadata
 */

export interface AgentConfig {
    name: string;
    command: string;
    script: string | null;
    description: string;
    emoji: string;
    category: 'Medical' | 'Finance' | 'Schedule' | 'Development' | 'General';
    buttons?: Array<{ text: string; callback_data: string; url?: string }>;
    cross_talk?: string[]; // Array of command names to fetch data from before synthesizing
}

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
    'duty': {
        name: 'ASCLEPIUS',
        command: '/duty',
        script: '.scripts/asclepius_duty.py',
        description: 'Check current medical duty status and shift details',
        emoji: '🏥',
        category: 'Medical',
        buttons: [
            { text: '📅 View Roster', callback_data: 'agent:moira' },
            { text: '🕒 Shift Info', callback_data: 'view:shift' }
        ]
    },
    'finance': {
        name: 'PLUTUS',
        command: '/finance',
        script: '.scripts/plutus_finance.py',
        description: 'Get financial summary, budget status, and cashflow',
        emoji: '💰',
        category: 'Finance',
        buttons: [
            { text: '📊 Details', callback_data: 'view:finance' },
            { text: '💸 Log Expense', url: 'http://localhost:3000?action=log_expense' }
        ]
    },
    'market': {
        name: 'MIDAS',
        command: '/market',
        script: '.scripts/midas_market.py',
        description: 'Get latest market intelligence and investment signals',
        emoji: '📈',
        category: 'Finance',
        buttons: [
            { text: '📉 Trends', callback_data: 'view:trends' },
            { text: '💰 War Chest', callback_data: 'view:warchest' }
        ],
        cross_talk: ['finance'] // NYX will consult PLUTUS before giving MIDAS advice
    },
    'schedule': {
        name: 'CHRONOS',
        command: '/schedule',
        script: '.scripts/chronos_schedule.py',
        description: 'View today\'s schedule and upcoming events',
        emoji: '📅',
        category: 'Schedule',
        buttons: [
            { text: '🕒 Next Event', callback_data: 'view:next_event' },
            { text: '📝 Add Task', callback_data: 'view:add_task' }
        ]
    },
    'tasks': {
        name: 'AIAS',
        command: '/tasks',
        script: '.scripts/aias_sentinel.py',
        description: 'View actionable tasks from all vault notes',
        emoji: '🛡️',
        category: 'Schedule',
        buttons: [
            { text: '🔴 High Priority', callback_data: 'view:tasks_high' },
            { text: '⌛ Overdue', callback_data: 'view:tasks_overdue' }
        ]
    },
    'study': {
        name: 'METIS',
        command: '/study',
        script: '.scripts/metis_study.py',
        description: 'Check academic deadlines and MBA/Python study plan',
        emoji: '📜',
        category: 'General'
    },
    'roster': {
        name: 'MOIRA',
        command: '/roster',
        script: '.scripts/moira_roster.py',
        description: 'View or generate the JR resident duty roster',
        emoji: '🪢',
        category: 'Medical',
        buttons: [
            { text: '📄 Generate PR', callback_data: 'agent:moira_gen' }
        ]
    },
    'conflicts': {
        name: 'ARGUS',
        command: '/conflicts',
        script: '.scripts/argus_watch.py',
        description: 'Check for Apollo vs Envision duty conflicts',
        emoji: '👁️',
        category: 'Medical'
    },
    'health': {
        name: 'HYGIEIA',
        command: '/health',
        script: '.scripts/hygieia_care.py',
        description: 'Grooming schedules and personal care tracking',
        emoji: '🌿',
        category: 'General'
    },
    'vault': {
        name: 'HERMES',
        command: '/vault',
        script: '.scripts/hermes_vault.py',
        description: 'Vault health score and integrity check',
        emoji: '📁',
        category: 'General'
    }
};
