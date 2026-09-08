#!/usr/bin/env bash
set -e
echo "  📱 Installing Termux dependencies..."
pkg update -y
pkg install -y nodejs npm git tmux
echo ""
echo "  ✓ Dependencies installed"
echo "  Now run: ./install.sh"
