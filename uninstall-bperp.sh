#!/bin/bash
# BPERP Dashboard Uninstaller for Linux

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "Removing BPERP Dashboard shortcuts..."

# Remove desktop shortcut
DESKTOP_FILE="$HOME/Desktop/bperp-dashboard.desktop"
if [[ -f "$DESKTOP_FILE" ]]; then
    rm "$DESKTOP_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} Removed desktop shortcut"
else
    echo -e "${CYAN}[INFO]${NC} Desktop shortcut not found"
fi

# Remove applications menu shortcut
APP_FILE="$HOME/.local/share/applications/bperp-dashboard.desktop"
if [[ -f "$APP_FILE" ]]; then
    rm "$APP_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} Removed applications menu shortcut"
else
    echo -e "${CYAN}[INFO]${NC} Applications menu shortcut not found"
fi

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

echo ""
echo "BPERP Dashboard shortcuts have been removed."
echo "Installation files remain in $(dirname "$(readlink -f "$0")")"
echo ""
read -p "Press Enter to continue..."
