#!/bin/bash
# Dedicated Gemini Session Script
# Optimized for nesting inside Mosh/Tmux "main" session

# 1. Unset TMUX to allow nesting (force)
unset TMUX

# 2. Create or attach to "gemini" session
# Using screen-256color for optimized CLI output
echo "Launching Gemini CLI in dedicated tmux session..."
exec tmux new-session -A -s gemini -c /home/ubuntu/vp "TERM=screen-256color /usr/bin/gemini"
