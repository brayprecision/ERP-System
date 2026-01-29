#!/bin/bash
# BPERP Dashboard Installation Script for Linux

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
echo "  ║                    Installation Script (Linux)                          ║"
echo "  ║                                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Change to the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}[INFO]${NC} Starting BPERP Dashboard installation..."
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
    echo -e "${CYAN}[INFO]${NC} Or visit: https://nodejs.org"
    exit 1
fi

# Get Node.js version for display
NODE_VERSION=$(node --version 2>/dev/null)
echo -e "${GREEN}[SUCCESS]${NC} Node.js $NODE_VERSION detected"

# Check if required files exist
if [[ ! -f "launch-bperp-gui.sh" ]]; then
    echo -e "${RED}[ERROR]${NC} launch-bperp-gui.sh not found."
    echo -e "${CYAN}[INFO]${NC} Please ensure all installation files are present."
    exit 1
fi

if [[ ! -d "frontend" ]]; then
    echo -e "${RED}[ERROR]${NC} Frontend directory not found."
    echo -e "${CYAN}[INFO]${NC} Please ensure this installer is in the BPERP root directory."
    exit 1
fi

echo -e "${GREEN}[SUCCESS]${NC} All required files found"

# Make scripts executable
echo -e "${CYAN}[INFO]${NC} Making scripts executable..."
chmod +x launch-bperp-gui.sh
chmod +x create-shortcut.sh
chmod +x uninstall-bperp.sh 2>/dev/null || true
chmod +x update-shortcuts.sh 2>/dev/null || true
echo -e "${GREEN}[SUCCESS]${NC} Scripts made executable"

# Test the launcher before creating shortcuts
echo -e "${CYAN}[INFO]${NC} Testing launcher functionality..."
if [[ -f "frontend/index.html" ]]; then
    echo -e "${GREEN}[SUCCESS]${NC} Application files verified"
else
    echo -e "${RED}[ERROR]${NC} Main application file (index.html) not found."
    exit 1
fi

# Create shortcuts using the shortcut creator script
echo -e "${CYAN}[INFO]${NC} Creating desktop and applications menu shortcuts..."
./create-shortcut.sh

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
echo "Installation files remain in $(dirname "$(readlink -f "$0")")"
echo ""
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
echo "  ║    BPERP Dashboard has been successfully installed!                     ║"
echo "  ║                                                                          ║"
echo "  ║    You can now launch BPERP using:                                      ║"
echo "  ║    • Desktop shortcut: \"BPERP Dashboard\"                                ║"
echo "  ║    • Applications menu: BPERP Dashboard                                 ║"
echo "  ║    • Direct launch: ./launch-bperp-gui.sh                               ║"
echo "  ║                                                                          ║"
echo "  ║    System Requirements Met:                                              ║"
echo "  ║    ✓ Node.js $NODE_VERSION installed                                    ║"
echo "  ║    ✓ Application files verified                                          ║"
echo "  ║    ✓ Shortcuts created                                                   ║"
echo "  ║    ✓ Uninstaller available                                               ║"
echo "  ║                                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}[SUCCESS]${NC} Installation completed successfully!"
echo -e "${CYAN}[INFO]${NC} You can now launch BPERP Dashboard from your desktop or applications menu."
echo -e "${CYAN}[INFO]${NC} To uninstall, run ./uninstall-bperp.sh"
echo ""

# Ask if user wants to launch now
read -p "Would you like to launch BPERP Dashboard now? (y/n): " launch_now
if [[ "$launch_now" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}[INFO]${NC} Launching BPERP Dashboard..."
    ./launch-bperp-gui.sh &
else
    echo -e "${CYAN}[INFO]${NC} You can launch BPERP Dashboard anytime from your desktop or applications menu."
fi

echo ""
echo "Installation complete."
