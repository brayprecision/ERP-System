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
2. Create `backend/.env` from `backend/.env.example` with `DB_PATH` pointing to the NAS
3. Run `cd backend && npm run migrate` on the target machine
4. Import shop data via CSV import (Settings > Data Import)
5. Fix Backup/Restore to copy the SQLite DB file via Electron IPC
6. Wire up cross-module search in `frontend/js/modules/search.js`
7. Implement auto-refresh so workcenter displays show current data
8. Ensure user profiles (appearance, permissions) load from database on login — no manual setup on new devices

## Architecture

### Shared SQLite on NAS
All workstations share a single SQLite database file hosted on the shop's NAS. There is no database server to install or maintain — just a file on a network share. When a new device is set up, the installer only needs the NAS database path. User profiles, permissions, and appearance settings are stored in the database and loaded automatically on login.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Workstation  │   │  Workstation  │   │  Workstation  │
│  (Windows)    │   │  (Linux)      │   │  (Windows)    │
│  Electron App │   │  Electron App │   │  Electron App │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └──────────┬───────┴──────────────────┘
                  │
         ┌────────▼────────┐
         │   NAS / Share    │
         │   bperp.db       │
         │  (SQLite file)   │
         └─────────────────┘
```

### Auto-Update
The app should auto-refresh data so each workcenter always displays current information. When one user creates a work order or updates inventory, other workstations reflect the change without manual refresh.

## Tech Stack

- **Backend**: Node.js + Express.js (port 3000)
- **Database**: SQLite via `better-sqlite3` (single `.db` file on NAS, shared across all devices)
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
# Edit .env — set DB_PATH to the SQLite database location

# Run migrations
npm run migrate

# Start dev server (auto-reload)
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
│   ├── tests/            # Jest test suites
│   ├── server.js         # Express app entry point
│   └── .env.example      # Environment config template
├── frontend/
│   ├── js/modules/       # ES6 modules (app, sales, tasks, inventory, etc.)
│   ├── css/              # Tailwind CSS customizations
│   └── index.html        # SPA entry point
├── electron/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Secure IPC bridge
│   └── setup-wizard/     # First-run setup UI
└── package.json          # Electron-builder config
```

## New Device Setup

1. Install BPERP using the Windows or Linux installer
2. On first launch, the setup wizard asks for the NAS database path (or local path for testing)
3. Create the admin user and password
4. The app opens the shared SQLite database and runs any pending migrations
5. User logs in — their profile, permissions, and appearance settings load automatically from the database
6. No manual configuration needed beyond the database path

## End-to-End Testing (Installer)

1. Run the installer: `dist-installers\BPERP-1.0.0-beta.1-win-x64.exe`
2. Complete setup wizard: choose a local DB path (e.g. `C:\temp\bperp.db`) for testing
3. Create admin user and launch
4. Verify: login, dashboard, inventory, sales, tasks, workcenter, settings
5. Import sample data via Settings > Data Import

## API Endpoints

All endpoints (except login) require `Authorization: Bearer <token>` header.

| Endpoint | Description |
|----------|-------------|
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
