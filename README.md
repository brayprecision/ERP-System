# BPERP - Manufacturing ERP System

Internal ERP system for Bray Precision LLC. Manages inventory, sales, tasks, workcenters, and maintenance for the shop floor.

## Status

**Version:** 1.0.0-beta.1 | **Internal Use Only** | **Windows & Linux**

### What's Working
- Inventory Management (Products, Parts, Materials, Tooling, Misc items with low-stock alerts; Product BOM for assemblies)
- Sales Management (Customers, Contacts, Quotes with lifecycle, Work Orders with checklists)
- Task Management (11 workflow types, assignments, history)
- Workcenter Management (machine queues, job routing, state tracking)
- Maintenance Tracking (preventive/corrective scheduling, runtime tracking)
- User Management (Admin/Machinist/Operator roles, tab-level permissions)
- Shop Branding (logo, name, tagline)
- Data Import (CSV/Excel bulk import for all major entities)
- Electron Desktop App (Windows & Linux)

### Known Issues
- **Backup/Restore** only saves browser localStorage, not a real database backup (should be a simple file copy of the SQLite DB)
- **Search** module exists but cross-module search isn't fully wired

### TODO (pick up here)
1. Test the Windows installer end-to-end: run `dist-installers\BPERP-1.0.0-beta.1-win-x64.exe` (use `npm run build:win` to rebuild)
2. Local dev: use **Standalone** in the setup wizard or `cd backend && npm run dev`; deploy **Network (NAS)** when ready for multiple workstations (see `docs/NAS-SETUP.md`)
3. Import shop data via CSV import (Settings > Data Import)
4. Fix Backup/Restore to copy the SQLite DB file via Electron IPC
5. Wire up cross-module search in `frontend/js/modules/search.js`
6. Implement auto-refresh so workcenter displays show current data
7. Ensure user profiles (appearance, permissions) load from database on login — no manual setup on new devices

## Architecture

BPERP supports two deployment modes, chosen during the first-run setup wizard.

### Standalone Mode (Local)
Everything runs on a single computer. The Electron app starts an embedded Express backend and uses a local SQLite database. Best for development, single-user testing, or working offline.

```
┌──────────────────────────┐
│  This Computer           │
│  Electron App            │
│    └─ Backend (fork)     │
│         └─ SQLite (.db)  │
└──────────────────────────┘
```

### Network Mode (NAS)
The BPERP backend runs on the shop's NAS (Zorin OS or other Linux). Workstations run the Electron app as thin clients and connect to the server via HTTP. The SQLite database is stored locally on the NAS (no network filesystem). User profiles, permissions, and appearance settings are stored in the database and loaded automatically on login.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Workstation  │   │  Workstation  │   │  Workstation  │
│  (Windows)    │   │  (Linux)      │   │  (Windows)    │
│  Electron App │   │  Electron App │   │  Electron App │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └──────────┬───────┴──────────────────┘
                  │  http://nas:3000
         ┌────────▼────────┐
         │   NAS           │
         │  Backend + DB   │
         │  (SQLite local) │
         └─────────────────┘
```

See `docs/NAS-SETUP.md` for NAS deployment.

### Auto-Update
The app should auto-refresh data so each workcenter always displays current information. When one user creates a work order or updates inventory, other workstations reflect the change without manual refresh.

## Tech Stack

- **Backend**: Node.js + Express.js (port 3000)
- **Database**: SQLite via `better-sqlite3` (single `.db` file: local disk in Standalone mode, or on the NAS machine’s local disk in Network mode)
- **Frontend**: Vanilla JavaScript (ES6 Modules) + Tailwind CSS (no build step)
- **Desktop**: Electron (Windows & Linux only)
- **Auth**: Token-based with bcrypt password hashing

## Quick Start (Development)

### Prerequisites

- Node.js 18+

### Option A: Browser-Based (fastest)

Run the backend directly and open the app in your browser. No Electron needed.

```bash
cd backend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. The backend serves both the API and frontend. A local SQLite database (`backend/bperp.db`) is created automatically.

### Option B: Electron Standalone

Run the full desktop app locally with the embedded backend. Electron ships its own Node.js; native addons (`better-sqlite3`, `bcrypt`) must be compiled for that runtime, not your system `node`.

```bash
# From project root
npm run setup              # Install root + backend dependencies
npm run rebuild:backend    # Rebuild native modules for Electron (required after backend npm install)
npm start                  # Launch Electron app
```

If you see `NODE_MODULE_VERSION` / `better_sqlite3.node` errors when starting Electron, run `npm run rebuild:backend` again from the repo root. That script removes stale `build/` and `prebuilds/` under `better-sqlite3` and `bcrypt`, then runs `electron-rebuild` with `--build-from-source` so the addon matches Electron’s Node ABI (plain `electron-rebuild` alone can report success while still loading the wrong `.node` file).

The backend runs DB migrations with the same Node binary as the server (`process.execPath`), so under Electron they use embedded Node (not system `node`), keeping `better-sqlite3` ABI consistent.

**Switching between browser and Electron:** After `rebuild:backend`, `cd backend && npm run dev` may fail if your system Node ABI differs from Electron’s. Rebuild for system Node with:

```bash
cd backend && npm rebuild better-sqlite3 bcrypt
```

On first launch, the setup wizard will ask you to choose **Standalone (Local)** or **Network (NAS)** mode. Choose Standalone to run everything on this computer with no NAS required. Create your admin account and you're ready to go.

### Building Installers

`build:win`, `build:linux`, and `pack:win` run **`npm run backend:install:prod`** (`npm install --omit=dev` + `npm prune --omit=dev` in `backend/`) so shipped `resources/backend` does not include Jest, nodemon, TypeScript, etc.; then they rebuild native modules for Electron.

**After a packaging build**, if you need backend tests or `npm run dev` in `backend/` again, run **`npm run backend:install`** once to restore dev dependencies.

```bash
npm run build:win        # Windows NSIS installer → dist-installers/BPERP-*-win-x64.exe
npm run build:linux     # Linux .deb + AppImage (no rpm)
npm run pack:win         # Windows unpacked app only (faster than NSIS; same packaged layout)
```

Output: `dist-installers/` (installer + unpacked app for testing).

### Beta testing (Windows): rebuild on launch

To avoid reinstalling the NSIS build after every change, use the PowerShell launcher from the repo root. It repackages the app, then starts `dist-installers\win-unpacked\BPERP.exe` (faster than a full installer build).

```powershell
.\scripts\launch-beta.ps1              # backend:install:prod + rebuild:backend + pack:win + start unpacked exe
.\scripts\launch-beta.ps1 -Dev         # fastest: Electron from source (no electron-builder)
.\scripts\launch-beta.ps1 -FullInstaller   # same as npm run build:win, then start unpacked exe
.\scripts\launch-beta.ps1 -SkipBackendInstall -SkipNativeRebuild   # fastest repack when only app code changed
```

From **cmd** or double-click: `scripts\launch-beta.cmd` (same flags). If `.ps1` is blocked, use the `.cmd` wrapper or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

`-Dev` is best for rapid UI/backend edits. The default path matches **installed** layout (Electron shell in asar, **`resources/backend`** + **`resources/frontend`** — UI is served by Express from `resources/frontend`, not duplicated inside asar); use it when verifying behavior close to the shipped app.

### Why reinstalling can still show an “old” UI

- **Settings and server URL survive uninstall.** Electron stores config (including **Network mode** `server.url`) under **user data** (on Windows, typically `%APPDATA%\BPERP` or similar—not inside the install folder). The NSIS uninstaller removes the app under `%LOCALAPPDATA%\Programs\...` but usually **does not** delete that folder. After reinstall, the app can still open **Network** mode and load the **HTML/JS from your NAS**, which may be an older `frontend/` tree. To exercise the **new installer’s** UI: **Settings → Server Connection → Clear (Standalone Mode)**, restart, or deploy an updated `frontend/` on the server (see `docs/NAS-SETUP.md`).
- **Standalone mode** should match the installed `resources/frontend`. If it does not, confirm the Start menu shortcut **target** points at the install you updated (not an old `win-unpacked` or dev copy).

In the desktop app, **Settings → About this app** shows the running app version, mode, and server URL (if any)—**but only if the page you’re viewing includes that menu** (i.e. bundled UI or an up-to-date `frontend/` on the server). If the sidebar looks old and **About this app** is missing, check the **window title bar** after rebuilding the desktop app: it should end with `· v… · Standalone` or `· v… · Network · UI from server` after your shop name (branding sets the first part of the title). For diagnostics regardless of page version, press **Alt** to show the menu bar → **Help → About BPERP**, or use the **system tray** icon → **About BPERP**.

### Version field for each installer build

`app.getVersion()` and Windows “Apps & features” use the **`version`** in root [`package.json`](package.json). Before you produce an installer you need to tell apart from a previous build, **bump `version`** (e.g. `1.0.0-beta.2` or a prerelease you agree on as a team). Reusing the same version for multiple installers makes it hard to know which bits are on disk.

## Project Structure

```
ERP-System/
├── .cursor/
│   └── rules/           # Cursor AI project rules (*.mdc)
├── scripts/
│   ├── rebuild-backend-native.js  # Native rebuild for Electron (better-sqlite3, bcrypt)
│   ├── launch-beta.ps1            # Windows: repack + run unpacked (beta testing)
│   └── launch-beta.cmd            # Wrapper (Bypass execution policy for .ps1)
├── backend/
│   ├── db.js            # SQLite wrapper (PostgreSQL-compatible interface)
│   ├── middleware/       # Auth, validation, rate limiting
│   ├── migrations/       # Database migration scripts (SQLite)
│   ├── routes/           # API route handlers (11 modules)
│   ├── scripts/          # NAS deployment (start-server.sh, bperp.service)
│   ├── tests/            # Jest test suites
│   ├── server.js         # Express app entry point
│   └── .env.example      # Environment config template
├── docs/
│   └── NAS-SETUP.md     # NAS deployment guide
├── frontend/
│   ├── js/modules/       # ES6 modules (app, sales, tasks, inventory, etc.)
│   ├── css/              # Tailwind CSS customizations
│   └── index.html        # SPA entry point
├── electron/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Secure IPC bridge
│   ├── offline.html      # Connection error page (remote mode)
│   └── setup-wizard/     # First-run setup UI
└── package.json          # Electron-builder config
```

## New Device Setup

### Standalone (single computer / development)
1. Install BPERP using the Windows or Linux installer (or run from source)
2. On first launch, the setup wizard offers **Standalone (Local)** or **Network (NAS)**
3. Choose Standalone, create your admin account, and launch

### Network (multi-workstation shop)
1. Set up the backend on your NAS first (see `docs/NAS-SETUP.md`)
2. Install BPERP on each workstation
3. Choose Network mode in the setup wizard and enter the **Server URL** (e.g. `http://192.168.1.100:3000`)
4. Test the connection, create the admin user if prompted, and launch
5. User logs in — their profile, permissions, and appearance settings load automatically from the database
6. Change server URL anytime via Settings > Server Connection

## End-to-End Testing (Installer)

1. **Thin client (NAS):** Start the backend on the NAS or test machine: `cd backend && npm start`. **Standalone:** skip this; the app starts its own backend.
2. Run the installer: `dist-installers\BPERP-1.0.0-beta.1-win-x64.exe` (or `npm start` from a dev clone after `npm run rebuild:backend`).
3. Setup wizard: choose **Network (NAS)** and server URL (e.g. `http://localhost:3000` or NAS IP), or **Standalone (Local)** and create the admin user on this PC.
4. Launch and verify: login, dashboard, inventory, sales, tasks, workcenter, settings
5. Import sample data via Settings > Data Import

## API Endpoints

All endpoints (except login) require `Authorization: Bearer <token>` header.

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check (no auth) |
| `GET /api/setup/status` | Check if setup complete (no auth) |
| `POST /api/users/login` | Authenticate user |
| `GET /api/customers` | List customers |
| `GET /api/inventory/:category` | List inventory items (products/parts/materials/tooling/misc) |
| `GET /api/quotes` | List quotes |
| `GET /api/work-orders` | List work orders |
| `GET /api/tasks` | List tasks (supports filtering) |
| `POST /api/import/preview` | Preview CSV/Excel import |
| `POST /api/import/:entityType` | Import data (customers, materials, tooling, products, parts, etc.) |
| `GET /api/import/template/:type` | Download CSV import template |

## Common Commands

```bash
# Backend development
cd backend && npm run dev          # Start with auto-reload
cd backend && npm test             # Run tests
cd backend && npm run migrate      # Run database migrations
cd backend && npm run migrate:status  # Check migration status

# Electron app (from repo root; run rebuild:backend after backend npm install)
npm run rebuild:backend            # Native modules for Electron (better-sqlite3, bcrypt)
npm start                          # Run desktop app
npm run dev                        # Electron with NODE_ENV=development (works on Windows via cross-env)

# Build installers (rebuilds native modules automatically)
npm run build:win                  # Windows
npm run build:linux                # Linux
npm run pack:win                   # Windows unpacked dir only (see scripts/launch-beta.ps1)
```

## Security

- **Passwords**: bcrypt hashed (12 salt rounds)
- **Rate Limiting**: 5 login attempts/15 min, 100 API requests/min
- **Input Validation**: Zod schemas on all endpoints
- **SQL**: Parameterized queries throughout (no injection risk)
- **Sessions**: Token-based with configurable expiration
