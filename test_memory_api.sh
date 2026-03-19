#!/bin/bash
# Quick test script for memory ingestion API

API_KEY="65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863"
BASE_URL="http://localhost:3001"

echo "=========================================="
echo "Testing Memory Ingestion API"
echo "=========================================="
echo ""

# Test 1: Email
echo "Test 1: Ingesting email..."
curl -s -X POST "$BASE_URL/api/memory/ingest" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "items": [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "content": "Hi VPK, Just wanted to follow up on the project discussion. Let me know if you need any help. Best, Alice",
      "metadata": {
        "from": "alice@example.com",
        "to": "vpk@example.com",
        "subject": "Project Follow-up"
      }
    }]
  }' | python3 -m json.tool
echo ""

# Test 2: Calendar Event
echo "Test 2: Ingesting calendar event..."
curl -s -X POST "$BASE_URL/api/memory/ingest" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "calendar",
    "items": [{
      "timestamp": "'$(date -u -d '+1 day' +%Y-%m-%dT09:00:00Z)'",
      "content": "Weekly team standup meeting. Discuss project progress and blockers.",
      "metadata": {
        "title": "Team Standup",
        "location": "Conference Room A",
        "participants": ["team@example.com"]
      }
    }]
  }' | python3 -m json.tool
echo ""

# Test 3: Task
echo "Test 3: Ingesting task..."
curl -s -X POST "$BASE_URL/api/memory/ingest" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task",
    "items": [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "content": "Review and approve the Q1 budget report",
      "metadata": {
        "title": "Review Q1 Budget",
        "priority": "high",
        "due": "'$(date -u -d '+3 days' +%Y-%m-%dT17:00:00Z)'"
      }
    }]
  }' | python3 -m json.tool
echo ""

# Test 4: SMS
echo "Test 4: Ingesting SMS..."
curl -s -X POST "$BASE_URL/api/memory/ingest" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sms",
    "items": [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "content": "Hey! Are we still on for dinner tonight at 7 PM?",
      "metadata": {
        "from": "Mom",
        "to": "VPK",
        "phone": "+1234567890"
      }
    }]
  }' | python3 -m json.tool
echo ""

# Test 5: Note
echo "Test 5: Ingesting note..."
curl -s -X POST "$BASE_URL/api/memory/ingest" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "note",
    "items": [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "content": "Remember to backup the database before the migration. Also need to notify the team 24 hours in advance.",
      "metadata": {
        "title": "Database Migration Checklist"
      }
    }]
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "Now try asking NYX about this data:"
echo "  - 'What emails did I receive recently?'"
echo "  - 'What's on my calendar tomorrow?'"
echo "  - 'What are my pending tasks?'"
echo "  - 'Show me recent SMS messages'"
echo ""
