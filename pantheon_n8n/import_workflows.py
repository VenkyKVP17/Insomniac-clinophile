#!/usr/bin/env python3
"""Import Pantheon workflows into n8n database"""
import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

# Workflow files to import
WORKFLOWS = [
    'pantheon_telegram_master.json',
    'pantheon_github_sync.json',
    'pantheon_notification_dispatcher.json'
]

DB_PATH = '/home/ubuntu/pantheon_n8n/data/database.sqlite'
PROJECT_ID = 'TtDwVqcihXTy8S6D'

def import_workflow(conn, workflow_file):
    """Import a workflow JSON file into n8n database, overwriting if exists"""

    # Read workflow JSON
    with open(workflow_file, 'r') as f:
        workflow = json.load(f)

    # Generate IDs
    workflow_id = str(uuid.uuid4())
    version_id = workflow.get('versionId', str(uuid.uuid4()))

    # Extract workflow data
    name = workflow.get('name', 'Untitled')
    nodes = json.dumps(workflow.get('nodes', []))
    connections = json.dumps(workflow.get('connections', {}))
    settings = json.dumps(workflow.get('settings', {}))
    static_data = json.dumps(workflow.get('staticData'))
    pin_data = json.dumps(workflow.get('pinData'))
    trigger_count = workflow.get('triggerCount', 0)

    cursor = conn.cursor()
    
    # DELETE if exists to avoid NOT NULL constraints on ID changes (or just replace)
    cursor.execute("DELETE FROM workflow_entity WHERE name = ?", (name,))
    
    # Insert workflow
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

    cursor.execute("""
        INSERT INTO workflow_entity (
            id, name, active, nodes, connections, settings, staticData,
            pinData, versionId, triggerCount, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        workflow_id, name, True, nodes, connections, settings,
        static_data, pin_data, version_id, trigger_count, now, now
    ))

    conn.commit()
    
    # Ensure it's shared with the project
    cursor.execute("""
        INSERT OR IGNORE INTO shared_workflow (workflowId, projectId, role, createdAt, updatedAt)
        VALUES (?, ?, 'workflow:owner', ?, ?)
    """, (workflow_id, PROJECT_ID, now, now))
    
    conn.commit()
    print(f"✅ Imported/Updated: {name} (ID: {workflow_id})")
    return True

def main():
    """Main import function"""
    print("🏛️ Pantheon Workflow Import")
    print("=" * 50)

    # Connect to database
    conn = sqlite3.connect(DB_PATH)

    imported = 0
    for workflow_file in WORKFLOWS:
        filepath = Path('/home/ubuntu/pantheon_n8n') / workflow_file
        if filepath.exists():
            if import_workflow(conn, filepath):
                imported += 1
        else:
            print(f"❌ File not found: {workflow_file}")

    conn.close()

    print("=" * 50)
    print(f"✅ Imported {imported}/{len(WORKFLOWS)} workflows")
    print("\n📝 Next steps:")
    print("  1. Restart n8n: docker compose restart")
    print("  2. Check workflows in UI: https://n8n-nyx.katthan.online")

if __name__ == '__main__':
    main()
