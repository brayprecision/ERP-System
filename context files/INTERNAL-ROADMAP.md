# BPERP Internal Roadmap

> **Last Updated**: March 26, 2026
> **Status**: Internal-only | Windows & Linux | SQLite (local or NAS-backed server)
> **Owner**: Bray Precision LLC

---

## Decision Log

**Mar 26, 2026** — **Standalone vs Network deployment.** The setup wizard offers **Standalone (Local)** (Electron forks the backend; SQLite on this machine) for development and single-PC use, and **Network (NAS)** (thin client to a central HTTP server; SQLite on the NAS machine’s **local disk**, not a network-mounted DB file). Added `scripts/rebuild-backend-native.js` so `npm run rebuild:backend` reliably rebuilds `better-sqlite3` / `bcrypt` for Electron. Fixed `server.js` startup migrations to use `process.execPath` + `ELECTRON_RUN_AS_NODE` under Electron so native module ABI stays consistent.

**Feb 27, 2026** — Switched from PostgreSQL to SQLite on NAS. A single SQLite database file
lives on the shop's NAS (network-attached storage). All workstations read/write the same file
over the network share. Eliminates the need to install and maintain a PostgreSQL server.
Setup wizard now asks for the NAS path instead of PostgreSQL connection details.

**Feb 26, 2026** — Finalized internal deployment model. macOS support dropped. Auto-refresh
added as a goal so workcenter displays always show current data.

**Feb 23, 2026** — Scrapped commercial product plan. BPERP is internal-only for Bray Precision.
All licensing, legal, auto-updater, and multi-tenant work permanently dropped.

---

## Deployment Model

**Network (shop):** Workstations run the Electron app as a thin client to one **Express + SQLite** instance on the NAS. The SQLite file lives on the **NAS’s local disk** (recommended); clients use HTTP, not direct file access to the DB. User accounts, permissions, and appearance settings live in that database.

**Standalone (dev / single PC):** Electron forks the backend; SQLite is on the local machine. No NAS required.

```
Network mode (multi-workstation)
  Workstations (Electron)  →  HTTP  →  NAS: Backend + SQLite (local disk)

Standalone mode
  One PC: Electron → fork(backend) → SQLite (local disk)
```

**Important considerations for SQLite (especially multi-user):**
- SQLite allows multiple concurrent readers but one writer at a time; use WAL and busy timeouts (see `backend/db.js`)
- Avoid hosting the primary `.db` file only on a flaky network filesystem; keep it on the machine that runs the backend
- Backups: copy the `.db` file when writes are quiesced (or use server backup APIs when added)

---

## What's Done (Phases 1-4)

### Phase 1: Security — COMPLETE
- [x] bcrypt password hashing (`backend/routes/users.js`)
- [x] Centralized auth middleware (`backend/middleware/auth.js`)
- [x] Rate limiting (`backend/middleware/rateLimit.js`)
- [x] Input validation with Zod (`backend/middleware/validation.js`)
- [x] Demo mode password bypass removed

### Phase 2: Architecture — COMPLETE (needs rework for SQLite)
- [x] All routes migrated from in-memory to PostgreSQL (must be converted to SQLite)
- [x] Database migration system (`backend/migrations/migrate.js`) (must be adapted for SQLite)
- [x] TypeScript foundation (types, middleware converted — not actively migrating)
- [x] Shared middleware directory

### Phase 3: Data Import & Testing — COMPLETE
- [x] CSV/Excel import system (`backend/routes/import.js`)
- [x] 8 entity types: customers, contacts, materials, tooling, products, parts, workcenters, machines
- [x] Jest test framework with test helpers
- [x] Validation and import API tests

### Phase 3.5: UX & Customization — COMPLETE
- [x] User roles (Admin/Machinist/Operator) with tab-level permissions
- [x] Shop branding (logo, name, tagline)
- [x] Backup/restore (localStorage-based — needs upgrade)

### Phase 4: Electron Desktop App — COMPLETE
- [x] Electron wrapper with backend lifecycle management
- [x] Setup wizard (Standalone vs Network, remote server URL + admin; local standalone + admin)
- [x] Linux builds tested (AppImage 122MB, .deb 81MB)
- [x] Windows launcher fixed (Feb 23 — taskkill, node server.js)
- [x] Splash screen, system tray, window state persistence

---

## What's Left

### Priority 1 — SQLite Migration

| Task | Status | Notes |
|------|--------|-------|
| Replace `pg` with `better-sqlite3` in backend | DONE | `backend/db.js` wrapper with PG-compatible interface |
| Convert all SQL queries from PostgreSQL to SQLite | DONE | `db.js` translates $N params, ILIKE, NOW(), RETURNING, etc. |
| Adapt migration system for SQLite | DONE | `backend/migrations/migrate.js` updated for SQLite |
| Rewrite initial migration for SQLite schema | DONE | `backend/migrations/scripts/` |
| Add busy timeout and retry logic for write contention | DONE | WAL mode + 5000ms busy_timeout in `db.js` |
| Update setup wizard to ask for NAS path | DONE | Browse for folder / enter path instead of PG credentials |
| Update `.env.example` for SQLite config | DONE | `DB_PATH` instead of PG host/port/user/password |
| Clean up obsolete PG/macOS files | DONE | Removed database/*.sql, backend/src/, shell scripts, pg dep |

### Priority 2 — Deploy

| Task | Status | Notes |
|------|--------|-------|
| Build Windows installer | DONE | `npm run build:win` runs `@electron/rebuild -f -w better-sqlite3,bcrypt -m backend -v 28.3.3` before packaging |
| Test Windows installer end-to-end | NOT DONE | Setup wizard, backend start, all modules |
| Import existing shop data | NOT DONE | Use CSV import (Settings > Data Import) |
| Test multi-device workflow | NOT DONE | Two machines, same NAS DB file, verify data syncs |

### Priority 3 — Network & Multi-Device

| Task | Status | Notes |
|------|--------|-------|
| Auto-refresh data on workstations | NOT DONE | Polling so workcenter displays stay current |
| User profiles load from DB on login | PARTIAL | Verify new device experience with SQLite on NAS |

### Priority 4 — Fix Known Gaps

| Task | Status | Files |
|------|--------|-------|
| Backup/Restore: copy SQLite file | NOT DONE | Simple file copy instead of pg_dump |
| Wire up cross-module search | NOT DONE | `frontend/js/modules/search.js`, `frontend/js/app.js` |

### Priority 5 — Polish (As Time Allows)

| Task | Notes |
|------|-------|
| Remove license/activation placeholders from setup wizard | `electron/setup-wizard/wizard.html` |
| Add dashboard summary report (open quotes, low stock, overdue tasks) | Enhancement |
| Improve error messages in frontend | UX polish |

---

## Permanently Dropped

These items are no longer relevant:

- ~~License key system (generation, validation, tiers)~~
- ~~Auto-updater for maintenance subscribers~~
- ~~EULA, Privacy Policy, legal docs~~
- ~~API versioning (`/api/v1/` prefix)~~
- ~~TypeScript migration of remaining routes~~ (JS works fine)
- ~~Frontend TypeScript + Vite build system~~
- ~~E2E tests (Playwright)~~
- ~~Service layer / dependency injection~~
- ~~Frontend code splitting / minification~~
- ~~User manual / installation guide for external customers~~
- ~~macOS support~~
- ~~Commercial distribution / resale~~
- ~~PostgreSQL as database~~ (replaced by SQLite on NAS, Feb 27)

---

## Architecture Reference

```
Electron Main Process (electron/main.js)
    ↓ fork()
Express Backend (backend/server.js on localhost:3000)
    ├── Routes: customers, inventory, tasks, users, workcenters, maintenance, etc.
    ├── Middleware: auth, rate limiting, validation
    ├── Migrations: schema versioning
    └── Database: SQLite file on NAS (shared by all workstations)
        ↓ Serves static
Vanilla Frontend (frontend/index.html + ES6 modules)
    ├── Modules: inventory, sales, tasks, users, storage, search, maintenance
    └── Styling: Tailwind CSS via CDN
```

## Key Paths

| Component | Path |
|-----------|------|
| Backend entry | `backend/server.js` |
| API routes | `backend/routes/*.js` |
| Middleware | `backend/middleware/*.js` |
| DB wrapper | `backend/db.js` |
| Frontend entry | `frontend/js/app.js` |
| Frontend modules | `frontend/js/modules/*.js` |
| Electron main | `electron/main.js` |
| Setup wizard | `electron/setup-wizard/` |
| Migrations | `backend/migrations/scripts/` |
| Build config | `package.json` (build section) |
| Env config | `backend/.env.example` |

## Common Commands

```bash
# Development
cd backend && npm run dev          # Start backend with auto-reload
npm start                          # Run Electron app

# Database
cd backend && npm run migrate      # Run migrations (needs SQLite adaptation)
cd backend && npm run migrate:status  # Check status

# Testing
cd backend && npm test             # Run Jest tests

# Building installers (from repo root; backend:install:prod + rebuild:backend + electron-builder)
npm run build:win
npm run build:linux                  # AppImage + deb
npm run pack:win                     # Windows unpacked only

# Test unpacked Windows build: dist-installers/win-unpacked/BPERP.exe
# After packaging, run `npm run backend:install` if backend dev deps are missing.
```
