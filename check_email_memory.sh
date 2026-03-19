#!/bin/bash
# Diagnostic script to check email ingestion status

echo "=========================================="
echo "Email Memory Diagnostic"
echo "=========================================="
echo ""

echo "1. Total memories in database:"
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db "SELECT COUNT(*) FROM nyx_memory;"
echo ""

echo "2. Memories by type (last 24 hours):"
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db "
SELECT
  CASE
    WHEN user_message LIKE '[EMAIL%' THEN 'EMAIL'
    WHEN user_message LIKE '[SMS%' THEN 'SMS'
    WHEN user_message LIKE '[CALENDAR%' THEN 'CALENDAR'
    WHEN user_message LIKE '[TASK%' THEN 'TASK'
    WHEN user_message LIKE '[TELEGRAM%' THEN 'TELEGRAM'
    WHEN user_message LIKE '[NOTE%' THEN 'NOTE'
    ELSE 'OTHER'
  END as type,
  COUNT(*) as count
FROM nyx_memory
WHERE timestamp > datetime('now', '-1 day')
GROUP BY type
ORDER BY count DESC;
"
echo ""

echo "3. Last 5 emails ingested:"
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db "
SELECT
  datetime(timestamp) as time,
  substr(user_message, 1, 80) as email_info
FROM nyx_memory
WHERE user_message LIKE '[EMAIL%'
ORDER BY timestamp DESC
LIMIT 5;
"
echo ""

echo "4. Recent API ingestion logs (last 20):"
pm2 logs pantheon-new --lines 200 --nostream 2>/dev/null | grep "MEMORY-INGEST" | tail -20
echo ""

echo "=========================================="
echo "To manually test email ingestion:"
echo "curl -X POST http://localhost:3001/api/memory/ingest \\"
echo "  -H 'X-API-Key: 65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"type\":\"email\",\"items\":[{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"content\":\"Test\",\"metadata\":{\"from\":\"test@test.com\",\"subject\":\"Test\"}}]}'"
echo "=========================================="
