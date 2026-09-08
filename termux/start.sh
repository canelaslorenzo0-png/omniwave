#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/.env" ]; then
  source "$SCRIPT_DIR/.env"
fi

mkdir -p "$HOME/.omniwave"
LOG="$HOME/.omniwave/omniwave.log"
PID_FILE="$HOME/.omniwave/omniwave.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "  ⚡ OmniWave is already running (PID: $(cat "$PID_FILE"))"
  echo "  Dashboard: http://localhost:${PORT:-20128}"
  exit 0
fi

echo "  ⚡ Starting OmniWave Gateway..."
nohup node "$SCRIPT_DIR/src/index.js" >> "$LOG" 2>&1 &
echo $! > "$PID_FILE"
sleep 1

if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "  ✓ OmniWave started (PID: $(cat "$PID_FILE"))"
  echo "  Dashboard: http://localhost:${PORT:-20128}"
  echo "  Log: $LOG"
else
  echo "  ✗ Failed to start. Check: $LOG"
  rm -f "$PID_FILE"
  exit 1
fi
