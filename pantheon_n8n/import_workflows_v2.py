#!/usr/bin/env python3
"""Import Pantheon workflows into n8n database with correct activation (v2)"""
import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

# Workflow files to import
WORKFLOWS = [
    'pantheon_telegram_master.json',
    'pantheon_github_sync.json',
    'pantheon_notification_dispatcher.json',
    'chronos_fetch_tasks.json',
    'chronos_sync_gcal.json',
    'chronos_upload_duties.json',
    'epione_gmail_sync.json',
    'hermes_contacts_sync.json',
    'iris_sync.json',
    'location_engine.json'
]

DB_PATH = '/home/ubuntu/pantheon_n8n/data/database.sqlite'
PROJECT_ID = 'TtDwVqcihXTy8S6D'

def import_workflow(conn, workflow_file):
    """Import a workflow JSON file into n8n database, correctly activating it"""

    # Read workflow JSON
    with open(workflow_file, 'r') as f:
        workflow = json.load(f)

    # Extract workflow data
    name = workflow.get('name', 'Untitled')
    
    # Use stable UUID based on name
    workflow_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"pantheon.workflow.{name}"))
    version_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"pantheon.version.{name}.v1"))

    nodes = json.dumps(workflow.get('nodes', []))
    connections = json.dumps(workflow.get('connections', {}))
    settings = json.dumps(workflow.get('settings', {}))
    static_data = json.dumps(workflow.get('staticData'))
    pin_data = json.dumps(workflow.get('pinData'))
    trigger_count = workflow.get('triggerCount', 0)

    cursor = conn.cursor()
    
    # 1. DELETE existing to avoid conflicts
    cursor.execute("DELETE FROM workflow_history WHERE workflowId = ?", (workflow_id,))
    cursor.execute("DELETE FROM workflow_entity WHERE id = ? OR name = ?", (workflow_id, name))
    
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

    # 2. Insert into workflow_history (Required for "published" status)
    cursor.execute("""
        INSERT INTO workflow_history (
            versionId, workflowId, authors, nodes, connections, name, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (version_id, workflow_id, '["Zeus"]', nodes, connections, name, now, now))

    # 3. Insert into workflow_entity with activeVersionId
    cursor.execute("""
        INSERT INTO workflow_entity (
            id, name, active, nodes, connections, settings, staticData,
            pinData, versionId, activeVersionId, triggerCount, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        workflow_id, name, True, nodes, connections, settings,
        static_data, pin_data, version_id, version_id, trigger_count, now, now
    ))

    # 4. Ensure it's shared with the project
    cursor.execute("""
        INSERT OR IGNORE INTO shared_workflow (workflowId, projectId, role, createdAt, updatedAt)
        VALUES (?, ?, 'workflow:owner', ?, ?)
    """, (workflow_id, PROJECT_ID, now, now))
    
    conn.commit()
    print(f"✅ Activated: {name}")
    return True

def main():
    """Main import function"""
    print("🏛️ Pantheon Workflow Activation (ZEUS Edition)")
    print("=" * 60)

    # Connect to database
    conn = sqlite3.connect(DB_PATH)

    imported = 0
    for workflow_file in WORKFLOWS:
        filepath = Path('/home/ubuntu/pantheon_n8n') / workflow_file
        if filepath.exists():
            try:
                if import_workflow(conn, filepath):
                    imported += 1
            except Exception as e:
                print(f"❌ Failed to activate {workflow_file}: {e}")
        else:
            print(f"❌ File not found: {workflow_file}")

    conn.close()

    print("=" * 60)
    print(f"✅ Activated {imported}/{len(WORKFLOWS)} workflows")
    print("\n📝 IMPORTANT: Restart n8n container to reload workflows!")

if __name__ == '__main__':
    main()
