================================================================================
                    BPERP DASHBOARD LAUNCHER SYSTEM
                        Bray Precision LLC ERP
================================================================================

QUICK START
-----------
1. Double-click "install-bperp-advanced.bat" for advanced options
   OR "install-bperp.bat" for standard installation
2. Choose your preferred launcher experience:
   • Silent Launcher (RECOMMENDED) - No command prompts, loading screen
   • GUI Launcher - Native Windows forms with progress
   • Classic Launcher - Traditional command-line interface
3. Launch BPERP using the desktop shortcut "BPERP Dashboard"
4. Experience professional loading screen with shop logo

SYSTEM REQUIREMENTS
-------------------
• Windows 7/8/10/11
• Node.js 14.0.0 or higher (download from https://nodejs.org)
• PostgreSQL 13 or higher (download from https://postgresql.org)
• Available port 3000 (backend server)
• Modern web browser (Chrome, Firefox, Edge)
• Minimum 4GB RAM recommended
• 500MB free disk space

INSTALLATION
------------
1. Ensure Node.js is installed on your system
2. Extract/place all BPERP files in a permanent directory
3. Run "install-bperp.bat" as Administrator (recommended)
4. Follow the installation prompts
5. Launch from desktop shortcut or start menu

FILES INCLUDED
--------------
• launch-bperp-gui.bat      - GUI launcher with Windows Forms (RECOMMENDED)
• launch-bperp-gui.vbs      - VBS wrapper for GUI launcher
• launch-bperp-gui.ps1      - PowerShell GUI script
• install-bperp-advanced.bat- Advanced installation with launcher options
• install-bperp.bat         - Standard installation script  
• create-shortcut.vbs       - Shortcut creation utility
• uninstall-bperp.bat       - Uninstaller (created during installation)
• frontend/loading.html     - Professional loading screen
• frontend/                 - Application files
• README-LAUNCHER.txt       - This file

USAGE OPTIONS
-------------

🚀 RECOMMENDED: Desktop Shortcut
   • Double-click "BPERP Dashboard" on desktop
   • Automatically starts server and opens browser
   • Shows startup progress and status

⚡ Start Menu Access
   • Start Menu → BPERP Dashboard

💻 Manual Launch Options:
   • launch-bperp-gui.bat       - Windows Forms GUI launcher (RECOMMENDED)

🌐 Browser Direct (if server running)
   • Open browser to: http://localhost:3000
   • Loading screen: http://localhost:3000/loading.html

TROUBLESHOOTING
---------------

❌ "Node.js is not installed"
   → Download and install Node.js from https://nodejs.org
   → Restart computer and try again
   → Verify installation: Open Command Prompt, type "node --version"

❌ "Port 3000 is already in use"
   → Another application is using port 3000
   → Either close the other application or set PORT env variable in backend/.env
   → Common conflicts: Other Node.js servers, development tools

❌ "Frontend directory not found"
   → Ensure launcher is in the correct BPERP root directory
   → Check that all files were extracted/copied properly

❌ Browser shows "This site can't be reached"
   → Server may not have started properly
   → Check if BPERP Server window is running
   → Wait 10 seconds and refresh browser
   → Restart launcher if needed

❌ "Module Loading Issue" in browser
   → Do not open HTML files directly (file:// protocol)
   → Always use the launcher or navigate to http://localhost:3000
   → Clear browser cache if needed

❌ Shortcuts not working
   → Run install-bperp.bat as Administrator
   → Check Windows shortcut permissions
   → Manually run launcher from BPERP folder

LAUNCHER EXPERIENCE
------------------

🖼️ GUI LAUNCHER (Windows Forms) - RECOMMENDED
   • Native Windows loading dialog with shop logo
   • Real-time status updates and progress bar
   • Professional animated loading screen
   • Requires PowerShell execution permissions
   • Best for daily production use
   • No command prompts visible during startup

ADVANCED CONFIGURATION
----------------------

Port Configuration:
   • Create or edit backend/.env
   • Add: PORT=3000 (change to desired port)
   • Update PORT in backend/.env to match

Database Configuration:
   • Edit backend/.env (copy from backend/.env.example)
   • Set DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT
   • Default database name: airshop

Firewall/Network:
   • BPERP runs locally on http://localhost:3000
   • No internet connection required for operation
   • Firewall may prompt on first run - allow Node.js

MANUFACTURING ENVIRONMENT NOTES
-------------------------------

✓ Production Ready
   • Designed for continuous operation
   • Minimized server window to reduce desktop clutter
   • Auto-recovery from common issues

✓ Multi-User Considerations  
   • Each user needs their own BPERP installation
   • Data stored locally per user
   • Network deployment requires additional configuration

✓ Backup Recommendations
   • Backup entire BPERP folder regularly
   • Export data periodically using built-in export functions
   • Consider automated backup scripts for production use

UNINSTALLATION
--------------
• Run "uninstall-bperp.bat" to remove shortcuts
• Delete BPERP folder to completely remove application

SUPPORT & MAINTENANCE
--------------------
• Check Windows Event Viewer for detailed error logs
• Server logs available in minimized server window
• Keep Node.js updated for security and performance
• Monitor disk space - logs and data can accumulate

For technical support, provide:
• Windows version
• Node.js version (run: node --version)
• Error messages from launcher window
• Browser console errors (F12 → Console)

================================================================================
                           © Bray Precision LLC
                              ERP Dashboard v2.0
================================================================================