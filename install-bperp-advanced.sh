#!/bin/bash
# BPERP Dashboard Installation - Advanced Options for Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
echo ""
echo "  ╔══════════════════════════════════════════════════════════════════════════╗"
echo "  ║                                                                          ║"
echo "  ║   ██████╗ ██████╗ ███████╗██████╗ ██████╗                               ║"
echo "  ║   ██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗                              ║"
echo "  ║   ██████╔╝██████╔╝█████╗  ██████╔╝██████╔╝                              ║"
echo "  ║   ██╔══██╗██╔═══╝ ██╔══╝  ██╔══██╗██╔═══╝                               ║"
echo "  ║   ██████╔╝██║     ███████╗██║  ██║██║                                   ║"
echo "  ║   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝                                   ║"
echo "  ║                                                                          ║"
echo "  ║              Bray Precision ERP Dashboard                               ║"
echo "  ║                Advanced Installation Options (Linux)                    ║"
echo "  ║                                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Change to the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}[INFO]${NC} Advanced BPERP Dashboard installation with launcher options..."
echo ""

# Check prerequisites
echo -e "${CYAN}[INFO]${NC} Checking system prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed or not in PATH."
    echo -e "${CYAN}[INFO]${NC} Please install Node.js before continuing."
    echo -e "${CYAN}[INFO]${NC} On Ubuntu/Debian: sudo apt install nodejs npm"
    echo -e "${CYAN}[INFO]${NC} On Fedora: sudo dnf install nodejs"
    echo -e "${CYAN}[INFO]${NC} On Arch: sudo pacman -S nodejs npm"
    exit 1
fi

NODE_VERSION=$(node --version 2>/dev/null)
echo -e "${GREEN}[SUCCESS]${NC} Node.js $NODE_VERSION detected"

# Check required files
if [[ ! -d "frontend" ]]; then
    echo -e "${RED}[ERROR]${NC} Frontend directory not found."
    exit 1
fi

echo -e "${GREEN}[SUCCESS]${NC} All required files found"
echo ""

# Check for optional dependencies
echo -e "${CYAN}[INFO]${NC} Checking optional dependencies..."

# Check for notify-send (desktop notifications)
if command -v notify-send &> /dev/null; then
    echo -e "${GREEN}[SUCCESS]${NC} Desktop notifications available (notify-send)"
else
    echo -e "${YELLOW}[INFO]${NC} notify-send not found - desktop notifications disabled"
    echo -e "${CYAN}[TIP]${NC} Install libnotify-bin for desktop notifications"
fi

# Check for xdg-open (browser opening)
if command -v xdg-open &> /dev/null; then
    echo -e "${GREEN}[SUCCESS]${NC} Browser launcher available (xdg-open)"
else
    echo -e "${YELLOW}[WARNING]${NC} xdg-open not found - may have trouble opening browser"
fi

echo ""

# Make scripts executable
echo -e "${CYAN}[INFO]${NC} Making scripts executable..."
chmod +x launch-bperp-gui.sh 2>/dev/null || true
chmod +x create-shortcut.sh 2>/dev/null || true
chmod +x uninstall-bperp.sh 2>/dev/null || true
chmod +x update-shortcuts.sh 2>/dev/null || true
echo -e "${GREEN}[SUCCESS]${NC} Scripts made executable"

# Create shortcuts
echo -e "${CYAN}[INFO]${NC} Creating desktop and applications menu shortcuts..."
if [[ -f "create-shortcut.sh" ]]; then
    ./create-shortcut.sh
else
    echo -e "${YELLOW}[WARNING]${NC} create-shortcut.sh not found, skipping shortcuts"
fi

# Create uninstaller
echo -e "${CYAN}[INFO]${NC} Creating uninstaller..."
cat > uninstall-bperp.sh << 'UNINSTALLER'
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
read -p "Press Enter to continue..."
UNINSTALLER

chmod +x uninstall-bperp.sh
echo -e "${GREEN}[SUCCESS]${NC} Uninstaller created"

# Installation complete
echo ""
echo "  ╔══════════════════════════════════════════════════════════════════════════╗"
echo "  ║                                                                          ║"
echo "  ║                    🎉 INSTALLATION COMPLETE! 🎉                         ║"
echo "  ║                                                                          ║"
echo "  ║    BPERP Dashboard installed with terminal launcher                     ║"
echo "  ║                                                                          ║"
echo "  ║    Launch Options:                                                       ║"
echo "  ║    • Desktop shortcut: \"BPERP Dashboard\"                                ║"
echo "  ║    • Applications menu: BPERP Dashboard                                 ║"
echo "  ║    • Direct: ./launch-bperp-gui.sh                                      ║"
echo "  ║                                                                          ║"
echo "  ║    Features:                                                             ║"
echo "  ║    ✓ Node.js $NODE_VERSION ready                                        ║"
echo "  ║    ✓ Cross-platform compatibility                                       ║"
echo "  ║    ✓ Multi-part work order system                                       ║"
echo "  ║    ✓ Desktop notifications (if available)                               ║"
echo "  ║                                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}[SUCCESS]${NC} Installation completed successfully!"
echo ""

read -p "Would you like to test the launcher now? (y/n): " launch_now
if [[ "$launch_now" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}[INFO]${NC} Testing launcher..."
    ./launch-bperp-gui.sh &
else
    echo -e "${CYAN}[INFO]${NC} You can launch BPERP Dashboard anytime from your desktop."
fi

echo ""
echo "Installation complete."
