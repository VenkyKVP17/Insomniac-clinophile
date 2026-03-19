import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join } from 'path';

async function check() {
    const db = await open({
        filename: './data/pantheon.db',
        driver: sqlite3.Database
    });

    const pending = await db.all('SELECT count(*) as count FROM nyx_queue WHERE sent_at IS NULL');
    console.log('Pending messages:', pending[0].count);

    if (pending[0].count === 0) {
        console.log('No pending messages. Adding a test message...');
        await db.run(
            `INSERT INTO nyx_queue (created_at, pa_name, priority, message, action_url, action_label, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
            [new Date().toISOString(), 'SYSTEM', 1, 'This is a manual test message triggered by the developer to verify the NYX summary system.', null, null]
        );
    }
}

check().catch(console.error);
