#!/bin/bash
# Wrapper that launchd runs to keep the agent bridge worker alive.
# Pins the fnm node + agent CLIs on PATH so claude/codex resolve outside a shell.

FNM_BIN="/Users/bradperry/.local/share/fnm/node-versions/v24.15.0/installation/bin"
export PATH="$FNM_BIN:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Absolute agent commands (belt-and-suspenders in case PATH resolution differs)
export BRIDGE_CLAUDE_CMD="$FNM_BIN/claude"
export BRIDGE_CODEX_CMD="$FNM_BIN/codex"
export BRIDGE_CWD="/Users/bradperry/aether-hockey"

cd /Users/bradperry/brad-perry-enterprises || exit 1
exec "$FNM_BIN/node" scripts/agent-bridge-worker.mjs
