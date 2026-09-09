#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║  ⚡ OmniWave Gateway — Installer                ║"
echo "  ║  Free AI Router · 19 Providers · 19 Strategies ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Detect Termux ───
IS_TERMUX=false
if [ -d "/data/data/com.termux" ] || command -v pkg &>/dev/null || [ -n "$TERMUX_VERSION" ]; then
  IS_TERMUX=true
  echo -e "${CYAN}  📱 Termux environment detected${NC}"
  echo ""

  # Ensure storage permissions
  if [ ! -d "$HOME/storage" ]; then
    echo -e "${YELLOW}  Requesting storage access...${NC}"
    termux-setup-storage 2>/dev/null || true
  fi
fi

# ─── Check Node.js ───
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  if $IS_TERMUX; then
    echo -e "  Installing Node.js via pkg..."
    pkg update -y 2>/dev/null || apt update -y
    pkg install -y nodejs 2>/dev/null || apt install -y nodejs
    echo -e "${GREEN}✓${NC} Node.js installed"
  else
    echo "  Install from https://nodejs.org (v22+)"
    echo "  Or: sudo apt install nodejs"
    exit 1
  fi
fi
NODE_VER=$(node -v)
echo -e "${GREEN}✓${NC} Node.js ${NODE_VER}"

# ─── Check npm ───
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm not found${NC}"
  if $IS_TERMUX; then
    echo -e "  Installing npm via pkg..."
    pkg install -y npm 2>/dev/null || apt install -y npm
    echo -e "${GREEN}✓${NC} npm installed"
  else
    exit 1
  fi
fi
echo -e "${GREEN}✓${NC} npm $(npm -v)"

# ─── Install dependencies ───
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$SCRIPT_DIR"
npm install 2>&1 | tail -5
echo -e "${GREEN}✓${NC} Dependencies installed"

# ─── Create directories ───
mkdir -p "$SCRIPT_DIR/data"
mkdir -p "$SCRIPT_DIR/termux"
echo -e "${GREEN}✓${NC} Data directory ready"

# ─── Create .env ───
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  if command -v openssl &>/dev/null; then
    API_KEY="ow_$(openssl rand -hex 16)"
  elif command -v head &>/dev/null; then
    API_KEY="ow_$(head -c 16 /dev/urandom | xxd -p | head -c 32)"
  else
    API_KEY="ow_$(date +%s | md5sum | head -c 32 2>/dev/null || echo "defaultkey12345678")"
  fi
  cat > "$SCRIPT_DIR/.env" << ENVFILE
PORT=20128
OMNIWAVE_KEY=${API_KEY}
ENVFILE
  echo -e "${GREEN}✓${NC} Created .env with API key: ${API_KEY}"
else
  echo -e "${GREEN}✓${NC} .env already exists"
fi

# ─── Link CLI globally ───
if [ -d "$SCRIPT_DIR/node_modules" ]; then
  chmod +x "$SCRIPT_DIR/bin/omniwave.js"
  chmod +x "$SCRIPT_DIR/termux/"*.sh 2>/dev/null || true
  if command -v npm &> /dev/null; then
    npm link 2>/dev/null && echo -e "${GREEN}✓${NC} CLI linked globally (omniwave)" || echo -e "${YELLOW}~${NC} Run 'npm link' manually for global CLI"
  fi
fi

# ─── Termux-specific setup ───
if $IS_TERMUX; then
  echo ""
  echo -e "${YELLOW}📱 Termux Setup${NC}"

  # Create termux service launcher
  cat > "$SCRIPT_DIR/termux/start.sh" << 'TERMUX_START'
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
TERMUX_START

  cat > "$SCRIPT_DIR/termux/stop.sh" << 'TERMUX_STOP'
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
TERMUX_STOP

  cat > "$SCRIPT_DIR/termux/status.sh" << 'TERMUX_STATUS'
#!/usr/bin/env bash
PID_FILE="$HOME/.omniwave/omniwave.pid"
LOG="$HOME/.omniwave/omniwave.log"
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "  ⚡ OmniWave is running (PID: $(cat "$PID_FILE"))"
  PORT=$(grep PORT .env 2>/dev/null | cut -d= -f2 || echo "20128")
  echo "  Dashboard: http://localhost:${PORT}"
  echo "  Log: $LOG"
  echo ""
  echo "  Last 5 log lines:"
  tail -5 "$LOG" 2>/dev/null || echo "  (no logs yet)"
else
  echo "  ✗ OmniWave is not running"
  echo "  Start with: omniwave termux-start"
fi
TERMUX_STATUS

  cat > "$SCRIPT_DIR/termux/logs.sh" << 'TERMUX_LOGS'
#!/usr/bin/env bash
LOG="$HOME/.omniwave/omniwave.log"
if [ -f "$LOG" ]; then
  echo "  📋 OmniWave Logs (last 50 lines):"
  echo ""
  tail -50 "$LOG"
else
  echo "  ℹ No logs found. Start OmniWave first."
fi
TERMUX_LOGS

  chmod +x "$SCRIPT_DIR/termux/"*.sh
  echo -e "${GREEN}✓${NC} Termux scripts created in termux/"

  echo ""
  echo -e "  ${BOLD}Termux Quick Start:${NC}"
  echo -e "    omniwave start          Start in foreground (see logs)"
  echo -e "    omniwave termux-start   Start in background"
  echo -e "    omniwave termux-stop    Stop background process"
  echo -e "    omniwave termux-status  Check running status"
  echo -e "    omniwave termux-logs    View recent logs"
  echo ""
  echo -e "  ${BOLD}Tip:${NC} Use 'tmux' for a persistent session:"
  echo -e "    pkg install tmux"
  echo -e "    tmux new -s omniwave"
  echo -e "    omniwave start"
  echo -e "    Press Ctrl+B then D to detach"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Quick Start:${NC}"
echo -e "    cd ${SCRIPT_DIR}"
echo -e "    npm start"
echo ""
echo -e "  ${BOLD}Then open:${NC}  http://localhost:20128"
echo ""
echo -e "  ${BOLD}Point your tools at:${NC}"
echo -e "    URL:      http://localhost:20128/v1"
echo -e "    API Key:  (see .env file)"
echo -e "    Model:    auto"
echo ""
echo -e "  ${BOLD}CLI:${NC}"
echo -e "    omniwave status"
echo -e "    omniwave providers"
echo -e "    omniwave add"
echo -e "    omniwave models"
echo ""
