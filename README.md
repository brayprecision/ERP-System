# BPERP - Manufacturing ERP System

Internal ERP system for Bray Precision LLC. Manages inventory, sales, tasks, workcenters, and maintenance for the shop floor.

## Status

**Version:** 1.0.0-beta.1 | **Internal Use Only** | **Windows & Linux**

### What's Working
- Inventory Management (Materials, Tooling, Misc items with low-stock alerts)
- Sales Management (Customers, Contacts, Quotes with lifecycle, Work Orders with checklists)
- Task Management (11 workflow types, assignments, history)
- Workcenter Management (machine queues, job routing, state tracking)
- Maintenance Tracking (preventive/corrective scheduling, runtime tracking)
- User Management (Admin/Machinist/Operator roles, tab-level permissions)
- Shop Branding (logo, name, tagline)
- Data Import (CSV/Excel bulk import for all major entities)
- Electron Desktop App (Windows & Linux)

### Known Issues
- **Backup/Restore** only saves browser localStorage, not a real PostgreSQL dump
- **Search** module exists but cross-module search isn't fully wired

### TODO (pick up here)
1. Build and test the Windows installer: `npx electron-builder --win --publish never`
2. Create `backend/.env` from `backend/.env.example` with real DB credentials
3. Run `cd backend && npm run migrate` on the target machine
4. Import shop data via CSV import (Settings > Data Import)
5. Fix Backup/Restore to use `pg_dump` via Electron IPC
6. Wire up cross-module search in `frontend/js/modules/search.js`
7. Implement auto-refresh so workcenter displays show current data
8. Ensure user profiles (appearance, permissions) load from database on login — no manual setup on new devices

## Architecture

### Network Database Model
All workstations connect to a single shared PostgreSQL server on the local network. There is no local database — every device pulls from the same source of truth. When a new device is set up, the installer only needs the network database connection details. User profiles, permissions, and appearance settings are stored in the database and loaded automatically on login.

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
         │  PostgreSQL DB   │
         │  (Network Host)  │
         │  All shared data │
         └─────────────────┘
```

### Auto-Update
The app should auto-refresh data so each workcenter always displays current information. When one user creates a work order or updates inventory, other workstations reflect the change without manual refresh.

## Tech Stack

- **Backend**: Node.js + Express.js (port 3000)
- **Database**: PostgreSQL (40+ tables, shared across all devices on the network)
- **Frontend**: Vanilla JavaScript (ES6 Modules) + Tailwind CSS (no build step)
- **Desktop**: Electron (Windows & Linux only)
- **Auth**: Token-based with bcrypt password hashing

## Quick Start (Development)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (accessible on the network)

### Setup

```bash
# Install dependencies
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your network database credentials

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

```bash
npm run backend:install
npx electron-builder --win --publish never        # Windows NSIS installer
npx electron-builder --linux deb --publish never   # Linux .deb
npx electron-builder --linux AppImage --publish never  # Linux AppImage
```

## Project Structure

```
ERP-System/
├── backend/
│   ├── middleware/      # Auth, validation, rate limiting
│   ├── migrations/      # Database migration scripts
│   ├── routes/          # API route handlers (11 modules)
│   ├── tests/           # Jest test suites
│   ├── server.js        # Express app entry point
│   └── .env.example     # Environment config template
├── frontend/
│   ├── js/modules/      # ES6 modules (app, sales, tasks, inventory, etc.)
│   ├── css/             # Tailwind CSS customizations
│   └── index.html       # SPA entry point
├── electron/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Secure IPC bridge
│   └── setup-wizard/    # First-run setup UI
├── database/
│   └── *.sql            # Schema reference files
└── package.json         # Electron-builder config
```

## New Device Setup

1. Install BPERP using the Windows or Linux installer
2. On first launch, the setup wizard asks for the network database connection details
3. The app connects to the shared PostgreSQL server, runs any pending migrations
4. User logs in — their profile, permissions, and appearance settings load automatically from the database
5. No manual configuration needed beyond the database connection

## API Endpoints

All endpoints (except login) require `Authorization: Bearer <token>` header.

| Endpoint | Description |
|----------|-------------|
| `POST /api/users/login` | Authenticate user |
| `GET /api/customers` | List customers |
| `GET /api/inventory/:category` | List inventory items (materials/tooling/misc) |
| `GET /api/quotes` | List quotes |
| `GET /api/work-orders` | List work orders |
| `GET /api/tasks` | List tasks (supports filtering) |
| `POST /api/import/preview` | Preview CSV/Excel import |
| `POST /api/import/:entityType` | Import data (customers, materials, tooling, etc.) |
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
```

## Security

- **Passwords**: bcrypt hashed (12 salt rounds)
- **Rate Limiting**: 5 login attempts/15 min, 100 API requests/min
- **Input Validation**: Zod schemas on all endpoints
- **SQL**: Parameterized queries throughout (no injection risk)
- **Sessions**: Token-based with configurable expiration
