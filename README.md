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
2. Set up the backend on the NAS (see `docs/NAS-SETUP.md`)
3. Import shop data via CSV import (Settings > Data Import)
4. Fix Backup/Restore to copy the SQLite DB file via Electron IPC
5. Wire up cross-module search in `frontend/js/modules/search.js`
6. Implement auto-refresh so workcenter displays show current data
7. Ensure user profiles (appearance, permissions) load from database on login — no manual setup on new devices

## Architecture

### Central Backend on NAS (Option A)
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

See `docs/NAS-SETUP.md` for NAS deployment. Standalone mode (local backend, database path) is still supported when no server URL is configured.

### Auto-Update
The app should auto-refresh data so each workcenter always displays current information. When one user creates a work order or updates inventory, other workstations reflect the change without manual refresh.

## Tech Stack

- **Backend**: Node.js + Express.js (port 3000)
- **Database**: SQLite via `better-sqlite3` (single `.db` file on NAS, backend runs on NAS)
- **Frontend**: Vanilla JavaScript (ES6 Modules) + Tailwind CSS (no build step)
- **Desktop**: Electron (Windows & Linux only)
- **Auth**: Token-based with bcrypt password hashing

## Quick Start (Development)

### Prerequisites

- Node.js 18+

### Setup

```bash
# Install dependencies
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env — set DB_PATH for the SQLite database location

# Start dev server (auto-reload; migrations run on startup)
npm run dev
```

The backend serves both the API and frontend on `http://localhost:3000`.

### Running the Electron App

```bash
# From project root
npm install
npm start
```

### Building Installers

`build:win` and `build:linux` automatically install backend deps and rebuild native modules for Electron:

```bash
npm run build:win        # Windows NSIS installer → dist-installers/BPERP-*-win-x64.exe
npm run build:linux     # Linux .deb + AppImage + rpm
```

Output: `dist-installers/` (installer + unpacked app for testing).

## Project Structure

```
ERP-System/
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

1. **NAS**: Set up the backend on your NAS first (see `docs/NAS-SETUP.md`)
2. **Workstation**: Install BPERP using the Windows or Linux installer
3. On first launch, the setup wizard asks for the **Server URL** (e.g. `http://192.168.1.100:3000`)
4. Test the connection, create the admin user if prompted, and launch
5. User logs in — their profile, permissions, and appearance settings load automatically from the database
6. Change server URL anytime via Settings > Server Connection

## End-to-End Testing (Installer)

1. Start the backend on your machine or NAS: `cd backend && npm start`
2. Run the installer: `dist-installers\BPERP-1.0.0-beta.1-win-x64.exe`
3. Complete setup wizard: enter server URL (e.g. `http://localhost:3000` or your NAS IP)
4. Create admin user and launch
5. Verify: login, dashboard, inventory, sales, tasks, workcenter, settings
6. Import sample data via Settings > Data Import

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

# Electron app
npm start                          # Run desktop app
npm run dev                        # Run in dev mode

# Build installers (rebuilds native modules automatically)
npm run build:win                  # Windows
npm run build:linux                # Linux
```

## Security

- **Passwords**: bcrypt hashed (12 salt rounds)
- **Rate Limiting**: 5 login attempts/15 min, 100 API requests/min
- **Input Validation**: Zod schemas on all endpoints
- **SQL**: Parameterized queries throughout (no injection risk)
- **Sessions**: Token-based with configurable expiration
