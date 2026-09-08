#!/usr/bin/env bash
PID_FILE="$HOME/.omniwave/omniwave.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "  ✓ OmniWave stopped (PID: $PID)"
  else
    echo "  ℹ OmniWave was not running"
  fi
  rm -f "$PID_FILE"
else
  echo "  ℹ No PID file found — OmniWave is not running"
fi
