#!/bin/bash
# ---------------------------------------------------------
# Pantheon Git Sync & Agent Trigger (100MB RAM VPS)
# ---------------------------------------------------------
# This script should be run via cron every 5 minutes.
# It pulls changes from the GitHub repository and triggers
# background agents ONLY if there are new changes detected.
# Note: Pantheon and JR-Hub share this VPS but are separate entities.
# ---------------------------------------------------------

VAULT_DIR="/path/to/Obsidian/Vault/VP"
PANTHEON_DIR="/path/to/pantheon-server"

cd "$VAULT_DIR" || exit

# Fetch the remote changes without merging yet
git fetch origin main

# Check if we are behind the remote (changes exist on Mobile/PC)
HEADHASH=$(git rev-parse HEAD)
UPSTREAMHASH=$(git rev-parse main@{upstream})

if [ "$HEADHASH" != "$UPSTREAMHASH" ]; then
    echo "$(date): New changes detected. Pulling..."
    
    # Fast-forward pull
    git pull origin main
    
    echo "$(date): Vault synced. Triggering Agent execution."
    
    # ---------------------------------------------------------
    # TRIGGER EPHEMERAL AGENTS HERE
    # Note: Running with strict max-old-space-size to keep 
    # memory under 50-70MB to fit within the 100MB constraint.
    # ---------------------------------------------------------
    cd "$PANTHEON_DIR" || exit
    
    # Example agent trigger (assuming agents are set up as npm scripts)
    # NODE_OPTIONS=\"--max-old-space-size=50\" npm run start-agents
    
    echo "$(date): Agents finished. Handing over to NYX for notifications."
    
    # Trigger Nyx Notification Script
    NODE_OPTIONS="--max-old-space-size=30" node "$PANTHEON_DIR/scripts/nyx_notifier.js"
    
else
    echo "$(date): No new changes. Sleeping."
fi
