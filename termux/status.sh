#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$HOME/.omniwave/omniwave.pid"
LOG="$HOME/.omniwave/omniwave.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "  ⚡ OmniWave is running (PID: $(cat "$PID_FILE"))"
  PORT=$(grep "^PORT=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2)
  PORT=${PORT:-20128}
  echo "  Dashboard: http://localhost:${PORT}"
  echo "  Log: $LOG"
  echo ""
  echo "  Last 5 log lines:"
  tail -5 "$LOG" 2>/dev/null || echo "  (no logs yet)"
else
  echo "  ✗ OmniWave is not running"
  echo "  Start with: omniwave termux-start"
fi
