#!/bin/bash
# BPERP Shortcut Updater for Linux

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════╗"
echo "║       BPERP Shortcut Updater           ║"
echo "║   Updating to Latest Launcher          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}[INFO]${NC} Removing old desktop shortcut..."
DESKTOP_FILE="$HOME/Desktop/bperp-dashboard.desktop"
if [[ -f "$DESKTOP_FILE" ]]; then
    rm "$DESKTOP_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} Old desktop shortcut removed"
else
    echo -e "${CYAN}[INFO]${NC} No old desktop shortcut found"
fi

echo -e "${CYAN}[INFO]${NC} Removing old applications menu shortcut..."
APP_FILE="$HOME/.local/share/applications/bperp-dashboard.desktop"
if [[ -f "$APP_FILE" ]]; then
    rm "$APP_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} Old applications menu shortcut removed"
else
    echo -e "${CYAN}[INFO]${NC} No old applications menu shortcut found"
fi

echo -e "${CYAN}[INFO]${NC} Creating new shortcuts..."
if [[ -f "create-shortcut.sh" ]]; then
    chmod +x create-shortcut.sh
    ./create-shortcut.sh
else
    echo -e "${RED}[ERROR]${NC} create-shortcut.sh not found!"
    exit 1
fi

echo -e "${CYAN}[INFO]${NC} Testing the launcher..."
./launch-bperp-gui.sh &

echo ""
echo "╔════════════════════════════════════════╗"
echo "║           UPDATE COMPLETE!             ║"
echo "║                                        ║"
echo "║  Your shortcuts have been updated:     ║"
echo "║  • Desktop: BPERP Dashboard            ║"
echo "║  • Applications Menu: BPERP Dashboard  ║"
echo "║                                        ║"
echo "║  Try your desktop shortcut now!        ║"
echo "╚════════════════════════════════════════╝"
echo ""

read -p "Press Enter to continue..."
