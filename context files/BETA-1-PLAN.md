# BPERP Beta 1 Release Plan

> **Created**: January 29, 2026  
> **Target**: First external beta release with native installers  
> **Prerequisites**: Phases 1-3.5 of Commercialization Plan (complete)

---

## Beta 1 Goals

1. **Native installers** for Windows, macOS, and Linux
2. **First-run setup wizard** for database configuration
3. **Bundled dependencies** (no manual Node.js/PostgreSQL setup)
4. **Basic documentation** for installation and quick start
5. **Stable core functionality** validated through testing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BPERP Desktop Application                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Electron Main Process                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Tray &    │  │   Window    │  │   Backend Process   │  │   │
│  │  │   Menu      │  │   Manager   │  │   (Express Server)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Electron Renderer Process                   │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              Frontend (index.html + JS)              │    │   │
│  │  │         Communicates with backend via HTTP           │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Data Layer                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  PostgreSQL │  │   SQLite    │  │   Config Store      │  │   │
│  │  │  (bundled)  │  │  (fallback) │  │   (electron-store)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase B1.1: Electron Foundation

### Overview

Wrap the existing Express + frontend application in Electron for desktop distribution.

### Tasks

#### B1.1.1: Project Setup

Create Electron project structure:

```
electron/
├── main.js                 # Main process entry
├── preload.js              # Secure bridge to renderer
├── splash.html             # Loading screen
├── setup-wizard/
│   ├── wizard.html         # Setup wizard UI
│   ├── wizard.js           # Wizard logic
│   └── wizard.css          # Wizard styles
├── assets/
│   ├── icon.ico            # Windows icon
│   ├── icon.icns           # macOS icon
│   └── icon.png            # Linux icon (256x256)
└── scripts/
    ├── postinstall.js      # Post-install setup
    └── check-postgres.js   # PostgreSQL detection
```

**Files to create:**
- `electron/main.js` - Main process with window management
- `electron/preload.js` - Context bridge for IPC
- `electron/splash.html` - Loading screen while backend starts
- `package.json` updates for Electron

#### B1.1.2: Main Process Implementation

The main process (`electron/main.js`) handles:

1. **Application lifecycle**
   - Single instance lock (prevent multiple windows)
   - Graceful shutdown of backend on close
   - System tray integration (optional minimize to tray)

2. **Window management**
   - Main window (1280x800 default, resizable)
   - Splash screen during startup
   - Setup wizard window (if first run)

3. **Backend process management**
   - Spawn Express server as child process
   - Monitor backend health
   - Restart on crash
   - Forward logs to renderer

4. **IPC handlers**
   - Database configuration
   - Log retrieval
   - System info
   - Update checking

**Key code structure:**

```javascript
// electron/main.js (pseudocode)
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let backendProcess;

app.whenReady().then(async () => {
    // Check if first run
    if (isFirstRun()) {
        await showSetupWizard();
    }
    
    // Start backend
    await startBackend();
    
    // Create main window
    createMainWindow();
});

function startBackend() {
    return new Promise((resolve, reject) => {
        backendProcess = spawn('node', ['server.js'], {
            cwd: path.join(__dirname, '../backend'),
            env: { ...process.env, ...loadConfig() }
        });
        
        backendProcess.stdout.on('data', (data) => {
            if (data.includes('Server running')) {
                resolve();
            }
        });
    });
}
```

#### B1.1.3: Preload Script

Secure bridge between main and renderer:

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    setConfig: (config) => ipcRenderer.invoke('set-config', config),
    
    // Database
    testConnection: (config) => ipcRenderer.invoke('test-db-connection', config),
    runMigrations: () => ipcRenderer.invoke('run-migrations'),
    
    // System
    getVersion: () => ipcRenderer.invoke('get-version'),
    getLogs: () => ipcRenderer.invoke('get-logs'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Updates
    checkForUpdates: () => ipcRenderer.invoke('check-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    
    // Lifecycle
    quit: () => ipcRenderer.invoke('quit-app'),
    minimize: () => ipcRenderer.invoke('minimize-app'),
    maximize: () => ipcRenderer.invoke('maximize-app')
});
```

---

## Phase B1.2: Setup Wizard

### Overview

First-run wizard to configure database and create admin user.

### Wizard Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Welcome   │────▶│  Database   │────▶│ Admin User  │────▶│   Import    │
│             │     │   Setup     │     │  Creation   │     │   (Optional)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                       │
                           ▼                                       ▼
                    ┌─────────────┐                         ┌─────────────┐
                    │    Test     │                         │   Finish    │
                    │ Connection  │                         │   & Launch  │
                    └─────────────┘                         └─────────────┘
```

### Tasks

#### B1.2.1: Welcome Screen

- BPERP logo and branding
- Brief description of what the wizard will do
- "Get Started" button
- Link to documentation

#### B1.2.2: Database Configuration Screen

**Options:**

1. **Use Bundled PostgreSQL** (Recommended)
   - Automatically configure local PostgreSQL
   - Creates `bperp` database
   - Uses default port 5432 or finds available port

2. **Connect to Existing PostgreSQL**
   - Host, Port, Database name
   - Username, Password
   - SSL toggle
   - "Test Connection" button

3. **Use SQLite** (Simplified - for evaluation only)
   - Single file database
   - Limited to single user
   - Warning about limitations

**Validation:**
- Test connection before proceeding
- Show clear error messages
- Offer to create database if doesn't exist

#### B1.2.3: Admin User Creation Screen

- Username (required, alphanumeric)
- Display Name (required)
- Email (optional)
- Password (required, show strength meter)
- Confirm Password
- Password requirements displayed

#### B1.2.4: Data Import Screen (Optional)

- "Import Existing Data" option
- Drag & drop CSV/Excel files
- Quick preview of data
- Skip option for fresh start

#### B1.2.5: Finish Screen

- Summary of configuration
- "Launch BPERP" button
- Option to create desktop shortcut
- Link to quick start guide

### Wizard Implementation

**Files to create:**
- `electron/setup-wizard/wizard.html` - Multi-step wizard UI
- `electron/setup-wizard/wizard.js` - Step navigation, validation, API calls
- `electron/setup-wizard/wizard.css` - Consistent styling with main app

---

## Phase B1.3: Native Installers

### Overview

Use electron-builder to create platform-specific installers.

### Package.json Configuration

```json
{
  "name": "bperp",
  "productName": "BPERP - Manufacturing ERP",
  "version": "1.0.0-beta.1",
  "description": "Manufacturing ERP for small machine shops",
  "main": "electron/main.js",
  "author": "Bray Precision LLC",
  "license": "proprietary",
  "build": {
    "appId": "com.brayprecision.bperp",
    "productName": "BPERP",
    "copyright": "Copyright (C) 2026 Bray Precision LLC",
    "directories": {
      "output": "dist-installers",
      "buildResources": "electron/assets"
    },
    "files": [
      "backend/**/*",
      "frontend/**/*",
      "electron/**/*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/.bin"
    ],
    "extraResources": [
      {
        "from": "database/",
        "to": "database/",
        "filter": ["**/*.sql"]
      }
    ],
    "win": {},
    "mac": {},
    "linux": {}
  }
}
```

### Tasks

#### B1.3.1: Windows Installer (.exe)

**Configuration:**

```json
{
  "build": {
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "electron/assets/icon.ico",
      "publisherName": "Bray Precision LLC"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "electron/assets/icon.ico",
      "uninstallerIcon": "electron/assets/icon.ico",
      "installerHeaderIcon": "electron/assets/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "BPERP",
      "include": "electron/scripts/installer.nsh",
      "license": "LICENSE.txt"
    }
  }
}
```

**Features:**
- Custom installer UI with BPERP branding
- Option to install for all users or current user
- Custom installation directory
- Desktop and Start Menu shortcuts
- Uninstaller in Add/Remove Programs

**PostgreSQL bundling options:**

1. **Bundled portable PostgreSQL** (Recommended)
   - Include portable PostgreSQL in installer (~100MB)
   - Auto-start as service during app launch
   - Isolated from system PostgreSQL

2. **PostgreSQL prerequisite check**
   - Check if PostgreSQL is installed
   - Offer to download and install if missing
   - Guide user through PostgreSQL installation

#### B1.3.2: macOS Installer (.dmg)

**Configuration:**

```json
{
  "build": {
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "electron/assets/icon.icns",
      "category": "public.app-category.business",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "electron/entitlements.mac.plist",
      "entitlementsInherit": "electron/entitlements.mac.plist"
    },
    "dmg": {
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ],
      "background": "electron/assets/dmg-background.png",
      "iconSize": 100,
      "title": "BPERP Installer"
    }
  }
}
```

**Features:**
- Universal binary (Intel + Apple Silicon)
- Drag-to-Applications DMG layout
- Code signing ready (requires Apple Developer account)
- Notarization ready for Gatekeeper

**PostgreSQL for macOS:**
- Check for Homebrew PostgreSQL
- Offer to install via Homebrew: `brew install postgresql`
- Or bundle Postgres.app-style portable version

#### B1.3.3: Linux Installers (.deb, .rpm, .AppImage)

**Configuration:**

```json
{
  "build": {
    "linux": {
      "target": [
        {
          "target": "deb",
          "arch": ["x64"]
        },
        {
          "target": "rpm",
          "arch": ["x64"]
        },
        {
          "target": "AppImage",
          "arch": ["x64"]
        }
      ],
      "icon": "electron/assets/icons",
      "category": "Office",
      "maintainer": "Bray Precision LLC <support@brayprecision.com>",
      "vendor": "Bray Precision LLC",
      "synopsis": "Manufacturing ERP for small machine shops",
      "description": "BPERP is a complete ERP solution for machine shops, featuring inventory management, quote/work order tracking, task management, and maintenance scheduling."
    },
    "deb": {
      "depends": ["postgresql", "postgresql-contrib"],
      "recommends": ["postgresql-client"],
      "afterInstall": "electron/scripts/postinst-deb.sh",
      "afterRemove": "electron/scripts/postrm-deb.sh"
    },
    "rpm": {
      "depends": ["postgresql-server", "postgresql-contrib"],
      "afterInstall": "electron/scripts/postinst-rpm.sh",
      "afterRemove": "electron/scripts/postrm-rpm.sh"
    }
  }
}
```

**Installer types:**

| Format | Target Distros | Notes |
|--------|----------------|-------|
| `.deb` | Ubuntu, Debian, Mint | Uses apt package manager |
| `.rpm` | Fedora, RHEL, CentOS | Uses dnf/yum package manager |
| `.AppImage` | Universal | Portable, no installation needed |

**PostgreSQL for Linux:**
- Declare as package dependency
- Post-install script initializes database
- Works with system PostgreSQL service

---

## Phase B1.4: PostgreSQL Bundling Strategy

### Overview

The biggest complexity is bundling PostgreSQL. Here are the approaches:

### Option A: Embedded PostgreSQL (Recommended for Beta)

Use `embedded-postgres` npm package or similar:

```javascript
// electron/database/embedded-postgres.js
const EmbeddedPostgres = require('embedded-postgres');

const pg = new EmbeddedPostgres({
    databaseDir: path.join(app.getPath('userData'), 'postgresql'),
    port: 5433, // Non-default to avoid conflicts
    persistent: true
});

async function startDatabase() {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('bperp');
    return pg.getConnectionString();
}
```

**Pros:**
- Self-contained, no system dependencies
- Works offline
- Isolated from system PostgreSQL

**Cons:**
- Adds ~100-150MB to installer
- Need to manage PostgreSQL updates

### Option B: System PostgreSQL Detection

```javascript
// electron/database/detect-postgres.js
const { execSync } = require('child_process');

function detectPostgres() {
    try {
        // Try to find psql
        const version = execSync('psql --version', { encoding: 'utf8' });
        return { found: true, version };
    } catch {
        return { found: false };
    }
}

function installPostgres(platform) {
    const instructions = {
        win32: 'Download from https://www.postgresql.org/download/windows/',
        darwin: 'Run: brew install postgresql',
        linux: 'Run: sudo apt install postgresql'
    };
    return instructions[platform];
}
```

**Pros:**
- Smaller installer
- Uses optimized system PostgreSQL

**Cons:**
- Requires user to install PostgreSQL
- Version compatibility concerns

### Option C: SQLite Fallback (Evaluation Mode)

For users who just want to try the software:

```javascript
// Use better-sqlite3 for single-user evaluation
const Database = require('better-sqlite3');
const db = new Database(path.join(userData, 'bperp-eval.db'));
```

**Pros:**
- Zero configuration
- Tiny footprint
- Great for demos

**Cons:**
- Single-user only
- Not suitable for production

### Recommended Approach for Beta 1

1. **Primary**: Embedded PostgreSQL (Option A)
2. **Alternative**: Connect to existing PostgreSQL (Option B)
3. **Demo mode**: SQLite for evaluation (Option C)

Setup wizard presents these choices clearly.

---

## Phase B1.5: Documentation

### Tasks

#### B1.5.1: Installation Guide

**File:** `docs/INSTALLATION.md`

Contents:
- System requirements (OS, RAM, disk space)
- Download links
- Step-by-step installation for each platform
- Setup wizard walkthrough with screenshots
- Troubleshooting common issues

#### B1.5.2: Quick Start Guide

**File:** `docs/QUICK-START.md`

Contents:
- First login
- Setting up shop branding
- Creating first customer
- Creating first quote
- Converting quote to work order
- Basic task management
- Data import from spreadsheet

#### B1.5.3: Data Import Guide

**File:** `docs/DATA-IMPORT.md`

Contents:
- Supported file formats (CSV, Excel)
- Template downloads
- Column mapping explanation
- Field requirements for each entity type
- Error handling and validation
- Best practices for data preparation

#### B1.5.4: In-App Help

- Tooltip improvements throughout UI
- "Help" menu linking to documentation
- Context-sensitive help buttons
- "What's New" dialog for beta testers

---

## Phase B1.6: Quality Assurance

### Pre-Beta Checklist

#### Functionality Testing

- [ ] All CRUD operations work (customers, quotes, work orders, tasks)
- [ ] User authentication works correctly
- [ ] Role-based permissions enforced
- [ ] Data import handles all file types
- [ ] Backup/restore functions properly
- [ ] Shop branding saves and persists

#### Installer Testing

- [ ] Windows installer completes without errors
- [ ] macOS DMG mounts and app launches
- [ ] Linux packages install correctly
- [ ] Setup wizard completes all steps
- [ ] Database connection established
- [ ] Migrations run successfully
- [ ] Admin user can log in after setup

#### Platform-Specific Testing

**Windows:**
- [ ] Windows 10 (x64)
- [ ] Windows 11 (x64)
- [ ] Shortcut creation works
- [ ] Uninstaller removes all files

**macOS:**
- [ ] macOS 12 (Monterey) - Intel
- [ ] macOS 13 (Ventura) - Apple Silicon
- [ ] App moves to Applications correctly
- [ ] Gatekeeper allows launch

**Linux:**
- [ ] Ubuntu 22.04 LTS
- [ ] Fedora 38
- [ ] AppImage runs without installation
- [ ] Desktop file created

#### Performance Testing

- [ ] App launches in < 10 seconds
- [ ] Page navigation is responsive
- [ ] 1000+ records loads smoothly
- [ ] Memory usage stays under 500MB

---

## Implementation Schedule

### Week 1: Electron Foundation

| Day | Tasks |
|-----|-------|
| 1-2 | Set up Electron project structure, main process |
| 3-4 | Implement window management, backend spawning |
| 5 | Preload script, IPC handlers, splash screen |

### Week 2: Setup Wizard

| Day | Tasks |
|-----|-------|
| 1-2 | Wizard UI (HTML/CSS), step navigation |
| 3-4 | Database configuration, connection testing |
| 5 | Admin user creation, data import option |

### Week 3: PostgreSQL & Installers

| Day | Tasks |
|-----|-------|
| 1-2 | Embedded PostgreSQL integration |
| 3 | Windows NSIS installer configuration |
| 4 | macOS DMG configuration |
| 5 | Linux .deb/.rpm/.AppImage configuration |

### Week 4: Testing & Documentation

| Day | Tasks |
|-----|-------|
| 1-2 | Cross-platform testing, bug fixes |
| 3-4 | Documentation (installation, quick start) |
| 5 | Final testing, prepare release notes |

---

## File Structure After Beta 1

```
ERP-System/
├── backend/                    # Existing backend
├── frontend/                   # Existing frontend
├── electron/
│   ├── main.js                 # Main process
│   ├── preload.js              # Context bridge
│   ├── splash.html             # Loading screen
│   ├── setup-wizard/
│   │   ├── wizard.html
│   │   ├── wizard.js
│   │   └── wizard.css
│   ├── database/
│   │   ├── embedded-postgres.js
│   │   ├── detect-postgres.js
│   │   └── sqlite-fallback.js
│   ├── assets/
│   │   ├── icon.ico
│   │   ├── icon.icns
│   │   ├── icon.png
│   │   └── dmg-background.png
│   ├── scripts/
│   │   ├── postinst-deb.sh
│   │   ├── postinst-rpm.sh
│   │   └── installer.nsh
│   └── entitlements.mac.plist
├── docs/
│   ├── INSTALLATION.md
│   ├── QUICK-START.md
│   └── DATA-IMPORT.md
├── dist-installers/            # Built installers (gitignored)
│   ├── BPERP-Setup-1.0.0-beta.1.exe
│   ├── BPERP-1.0.0-beta.1.dmg
│   ├── BPERP-1.0.0-beta.1.AppImage
│   ├── bperp_1.0.0-beta.1_amd64.deb
│   └── bperp-1.0.0-beta.1.x86_64.rpm
├── package.json                # Updated with Electron deps
└── electron-builder.yml        # Build configuration
```

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "electron-store": "^8.1.0",
    "embedded-postgres": "^16.1.0"
  }
}
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| PostgreSQL bundling complexity | High | Start with system PostgreSQL requirement, add bundled later |
| Code signing costs | Medium | Use self-signed for beta, purchase certs before release |
| macOS notarization | Medium | Apply for Apple Developer account early |
| Large installer size | Low | Accept ~150MB for bundled PostgreSQL |
| Cross-platform bugs | Medium | Test on all platforms in parallel |

---

## Success Criteria for Beta 1

1. **Installers work** on Windows 10+, macOS 12+, Ubuntu 22.04+
2. **Setup wizard** successfully configures database and creates admin
3. **Core features** functional (customers, quotes, work orders, tasks)
4. **No critical bugs** blocking normal workflow
5. **Documentation** sufficient for self-service installation
6. **5+ beta testers** can install and use without developer assistance

---

## Post-Beta 1 Roadmap

After successful Beta 1:

1. **Beta 2**: Auto-updater, bug fixes from feedback
2. **Beta 3**: Performance optimization, edge case handling
3. **Release Candidate**: Licensing system, full documentation
4. **v1.0 Release**: Public launch with marketing

---

## Appendix: Build Commands

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run electron:dev

# Build for current platform
npm run electron:build

# Build for all platforms (requires CI or appropriate OS)
npm run electron:build:all

# Build specific platform
npm run electron:build:win
npm run electron:build:mac
npm run electron:build:linux
```

---

## Appendix: Environment Variables

```bash
# Database (set by setup wizard, stored in electron-store)
BPERP_DB_HOST=localhost
BPERP_DB_PORT=5433
BPERP_DB_NAME=bperp
BPERP_DB_USER=bperp
BPERP_DB_PASSWORD=<generated>

# Application
BPERP_PORT=3000
BPERP_ENV=production
BPERP_LOG_LEVEL=info

# Electron
BPERP_EMBEDDED_POSTGRES=true
BPERP_DATA_DIR=<userData>/bperp
```
