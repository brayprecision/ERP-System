#!/bin/bash
# BPERP Dashboard Shortcut Creator for Linux
# Creates desktop and applications menu shortcuts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Paths
LAUNCHER_PATH="$SCRIPT_DIR/launch-bperp-gui.sh"
ICON_PATH="$SCRIPT_DIR/frontend/assets/modern-logo.png"

# Fallback icon paths
if [[ ! -f "$ICON_PATH" ]]; then
    ICON_PATH="$SCRIPT_DIR/frontend/assets/logo.png"
fi
if [[ ! -f "$ICON_PATH" ]]; then
    ICON_PATH="$SCRIPT_DIR/context files/shop_logo_app_version.jpg"
fi

# Check if launcher exists
if [[ ! -f "$LAUNCHER_PATH" ]]; then
    echo -e "${RED}[ERROR]${NC} launch-bperp-gui.sh not found in $SCRIPT_DIR"
    echo -e "${CYAN}[INFO]${NC} Please ensure all files are in the correct location."
    exit 1
fi

# Make sure launcher is executable
chmod +x "$LAUNCHER_PATH"

# Desktop entry content
DESKTOP_ENTRY="[Desktop Entry]
Version=1.0
Type=Application
Name=BPERP Dashboard
Comment=Bray Precision ERP Dashboard - Production Management System
Exec=$LAUNCHER_PATH
Icon=$ICON_PATH
Terminal=false
Categories=Office;ProjectManagement;
StartupNotify=true
StartupWMClass=bperp-dashboard"

# Create desktop shortcut
DESKTOP_DIR="$HOME/Desktop"
if [[ -d "$DESKTOP_DIR" ]]; then
    DESKTOP_FILE="$DESKTOP_DIR/bperp-dashboard.desktop"
    echo "$DESKTOP_ENTRY" > "$DESKTOP_FILE"
    chmod +x "$DESKTOP_FILE"
    
    # Trust the desktop file (for GNOME)
    if command -v gio &> /dev/null; then
        gio set "$DESKTOP_FILE" metadata::trusted true 2>/dev/null || true
    fi
    
    echo -e "${GREEN}[SUCCESS]${NC} Desktop shortcut created: $DESKTOP_FILE"
else
    echo -e "${CYAN}[INFO]${NC} Desktop directory not found, skipping desktop shortcut"
fi

# Create applications menu shortcut
APPLICATIONS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPLICATIONS_DIR"

APP_FILE="$APPLICATIONS_DIR/bperp-dashboard.desktop"
echo "$DESKTOP_ENTRY" > "$APP_FILE"
chmod +x "$APP_FILE"

echo -e "${GREEN}[SUCCESS]${NC} Applications menu shortcut created: $APP_FILE"

# Update desktop database to refresh application menu
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true
    echo -e "${CYAN}[INFO]${NC} Desktop database updated"
fi

# Show success message
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║      BPERP Dashboard shortcuts created successfully!      ║"
echo "║                                                            ║"
echo "║  Created shortcuts:                                        ║"
echo "║  • Desktop: BPERP Dashboard                                ║"
echo "║  • Applications Menu: BPERP Dashboard                      ║"
echo "║                                                            ║"
echo "║  You can now launch BPERP from your desktop or app menu!  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
