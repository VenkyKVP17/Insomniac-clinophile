#!/bin/bash

# Configuration script for Mosh and Tmux persistent environment

# 1. Detect package manager and install mosh/tmux
echo "Checking for package manager..."
if command -v apt-get >/dev/null; then
    echo "Using apt-get to install mosh and tmux..."
    sudo apt-get update -qq
    sudo apt-get install -y mosh tmux
elif command -v yum >/dev/null; then
    echo "Using yum to install mosh and tmux..."
    sudo yum install -y mosh tmux
elif command -v dnf >/dev/null; then
    echo "Using dnf to install mosh and tmux..."
    sudo dnf install -y mosh tmux
else
    echo "No supported package manager found. Please install mosh and tmux manually."
    exit 1
fi

# 2. Check if ufw is active and allow Mosh UDP ports 60000:61000
if command -v ufw >/dev/null; then
    UFW_STATUS=$(sudo ufw status | grep -Po "Status: \K\w+")
    if [ "$UFW_STATUS" = "active" ]; then
        echo "UFW is active. Allowing Mosh UDP ports 60000:61000..."
        sudo ufw allow 60000:61000/udp
    else
        echo "UFW is not active or not configured. Skipping firewall rules."
    fi
else
    echo "ufw not found. Skipping firewall rules."
fi

# 3. Configure auto-attach logic for Tmux
TMUX_LOGIC='
# === TMUX AUTO-ATTACH CONFIG ===
# Auto-attach to or create a "main" tmux session upon login via SSH or Mosh.
if [ -z "$TMUX" ] && ([ -n "$SSH_CONNECTION" ] || [ -n "$MOSH_CONNECTION" ]); then
  exec tmux new-session -A -s main
fi
# === END TMUX AUTO-ATTACH CONFIG ===
'

configure_shell() {
    SHELL_RC=$1
    if [ -f "$SHELL_RC" ]; then
        if grep -q "TMUX AUTO-ATTACH CONFIG" "$SHELL_RC"; then
            echo "Tmux auto-attach logic already exists in $SHELL_RC. Skipping."
        else
            echo "Appending tmux auto-attach logic to $SHELL_RC..."
            echo "$TMUX_LOGIC" >> "$SHELL_RC"
        fi
    fi
}

configure_shell "$HOME/.bashrc"
configure_shell "$HOME/.zshrc"

echo "Setup complete! Mosh and Tmux are configured for a persistent environment."
echo "You can now connect using: mosh --ssh='ssh -p <port>' <user>@<host>"
