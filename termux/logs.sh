#!/usr/bin/env bash
LOG="$HOME/.omniwave/omniwave.log"
if [ -f "$LOG" ]; then
  echo "  📋 OmniWave Logs (last 50 lines):"
  echo ""
  tail -50 "$LOG"
else
  echo "  ℹ No logs found. Start OmniWave first."
fi
