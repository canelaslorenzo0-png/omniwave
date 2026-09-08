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
echo "  ║  Free AI Router · 350+ Providers · 19 Strategies ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  echo "  Install from https://nodejs.org (v22+)"
  exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}✓${NC} Node.js ${NODE_VER}"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} npm $(npm -v)"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$SCRIPT_DIR"
npm install 2>&1 | tail -3
echo -e "${GREEN}✓${NC} Dependencies installed"

# Create data directory
mkdir -p "$SCRIPT_DIR/data"
echo -e "${GREEN}✓${NC} Data directory ready"

# Create .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  API_KEY="ow_$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -c 32)"
  cat > "$SCRIPT_DIR/.env" << ENVFILE
PORT=20128
OMNIWAVE_KEY=${API_KEY}
ENVFILE
  echo -e "${GREEN}✓${NC} Created .env with API key: ${API_KEY}"
else
  echo -e "${GREEN}✓${NC} .env already exists"
fi

# Link CLI globally
if [ -d "$SCRIPT_DIR/node_modules" ]; then
  chmod +x "$SCRIPT_DIR/bin/omniwave.js"
  # Try to link globally
  if command -v npm &> /dev/null; then
    npm link 2>/dev/null && echo -e "${GREEN}✓${NC} CLI linked globally (omniwave)" || echo -e "${YELLOW}~${NC} Run 'npm link' manually for global CLI"
  fi
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
