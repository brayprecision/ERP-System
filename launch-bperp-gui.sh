#!/bin/bash
# BPERP Dashboard GUI Launcher for Linux
# Launches the frontend server and opens the browser

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
PORT=8080
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Function to check if a port is in use
check_port() {
    if command -v ss &> /dev/null; then
        ss -tuln | grep -q ":$PORT "
    elif command -v netstat &> /dev/null; then
        netstat -tuln | grep -q ":$PORT "
    elif command -v lsof &> /dev/null; then
        lsof -i ":$PORT" &> /dev/null
    else
        return 1
    fi
}

# Function to open URL in browser
open_browser() {
    local url="$1"
    if command -v xdg-open &> /dev/null; then
        xdg-open "$url" 2>/dev/null &
    elif command -v gnome-open &> /dev/null; then
        gnome-open "$url" 2>/dev/null &
    elif command -v kde-open &> /dev/null; then
        kde-open "$url" 2>/dev/null &
    elif command -v sensible-browser &> /dev/null; then
        sensible-browser "$url" 2>/dev/null &
    elif [[ -n "$BROWSER" ]]; then
        "$BROWSER" "$url" 2>/dev/null &
    else
        echo -e "${YELLOW}[WARNING]${NC} Could not detect browser. Please open: $url"
    fi
}

# Function to show a simple loading message (terminal-based)
show_loading() {
    echo ""
    echo "  ╔══════════════════════════════════════════════════════════════╗"
    echo "  ║                                                              ║"
    echo "  ║            Bray Precision LLC                                ║"
    echo "  ║            ERP Dashboard v2.0                                ║"
    echo "  ║                                                              ║"
    echo "  ║            Starting server...                                ║"
    echo "  ║                                                              ║"
    echo "  ╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# Function to show a GUI notification if available
show_notification() {
    local title="$1"
    local message="$2"
    if command -v notify-send &> /dev/null; then
        notify-send "$title" "$message" 2>/dev/null || true
    fi
}

# Main execution
main() {
    show_loading
    
    echo -e "${CYAN}[INFO]${NC} Checking Node.js..."
    if ! command -v node &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} Node.js is not installed!"
        echo -e "${CYAN}[INFO]${NC} Please install Node.js first."
        show_notification "BPERP Error" "Node.js is not installed"
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    echo -e "${CYAN}[INFO]${NC} Checking if server is already running on port $PORT..."
    if check_port; then
        echo -e "${GREEN}[SUCCESS]${NC} Server already running on port $PORT"
        echo -e "${CYAN}[INFO]${NC} Opening dashboard in browser..."
        sleep 1
        open_browser "http://localhost:$PORT/loading.html"
        show_notification "BPERP Dashboard" "Opening dashboard in browser"
        exit 0
    fi
    
    echo -e "${CYAN}[INFO]${NC} Starting server..."
    
    # Check if npx serve is available
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} npx not found. Please install Node.js with npm."
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    # Start the server in the background
    cd "$FRONTEND_DIR"
    npx serve -l $PORT -s --no-clipboard > /dev/null 2>&1 &
    SERVER_PID=$!
    
    echo -e "${CYAN}[INFO]${NC} Waiting for server to start..."
    
    # Wait for the server to be ready (max 15 seconds)
    for i in {1..30}; do
        sleep 0.5
        if check_port; then
            echo -e "${GREEN}[SUCCESS]${NC} Server started on port $PORT"
            break
        fi
        if [[ $i -eq 30 ]]; then
            echo -e "${RED}[ERROR]${NC} Server failed to start within timeout"
            kill $SERVER_PID 2>/dev/null || true
            read -p "Press Enter to exit..."
            exit 1
        fi
    done
    
    echo -e "${CYAN}[INFO]${NC} Opening dashboard in browser..."
    sleep 1
    open_browser "http://localhost:$PORT/loading.html"
    
    show_notification "BPERP Dashboard" "Dashboard is now running at http://localhost:$PORT"
    
    echo ""
    echo -e "${GREEN}[SUCCESS]${NC} BPERP Dashboard is running!"
    echo -e "${CYAN}[INFO]${NC} Server running at: http://localhost:$PORT"
    echo -e "${CYAN}[INFO]${NC} Press Ctrl+C to stop the server"
    echo ""
    
    # Keep the script running to show server status
    # The server runs in background, so we wait for it
    wait $SERVER_PID 2>/dev/null || true
}

main "$@"
