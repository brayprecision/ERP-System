# BPERP Internal Roadmap

> **Last Updated**: February 23, 2026
> **Status**: Internal-only — commercialization plan scrapped
> **Owner**: Bray Precision LLC

---

## Decision Log

**Feb 23, 2026** — Decided to scrap the commercial product plan. BPERP will be used
internally at Bray Precision only. All licensing, legal, auto-updater, and multi-tenant
work is permanently dropped.

---

## What's Done (Phases 1-4)

### Phase 1: Security — COMPLETE
- [x] bcrypt password hashing (`backend/routes/users.js`)
- [x] Centralized auth middleware (`backend/middleware/auth.js`)
- [x] Rate limiting (`backend/middleware/rateLimit.js`)
- [x] Input validation with Zod (`backend/middleware/validation.js`)
- [x] Demo mode password bypass removed

### Phase 2: Architecture — COMPLETE
- [x] All routes migrated from in-memory to PostgreSQL
- [x] Database migration system (`backend/migrations/migrate.js`)
- [x] TypeScript foundation (types, middleware converted)
- [x] Shared middleware directory

### Phase 3: Data Import & Testing — COMPLETE
- [x] CSV/Excel import system (`backend/routes/import.js`)
- [x] 6 entity types: customers, contacts, materials, tooling, workcenters, machines
- [x] Jest test framework with test helpers
- [x] Validation and import API tests

### Phase 3.5: UX & Customization — COMPLETE
- [x] User roles (Admin/Machinist/Operator) with tab-level permissions
- [x] Shop branding (logo, name, tagline)
- [x] Backup/restore (localStorage-based — needs upgrade)

### Phase 4: Electron Desktop App — COMPLETE
- [x] Electron wrapper with backend lifecycle management
- [x] Setup wizard (database config, admin creation)
- [x] Linux builds tested (AppImage 122MB, .deb 81MB)
- [x] Windows launcher fixed (Feb 23 — taskkill, node server.js)
- [x] Splash screen, system tray, window state persistence

---

## What's Left (Internal Use)

### Priority 1 — Deploy

| Task | Status | Notes |
|------|--------|-------|
| Build Windows installer | NOT DONE | `npx electron-builder --win --publish never` |
| Test Windows installer end-to-end | NOT DONE | Setup wizard, backend start, all modules |
| Create production `.env` | NOT DONE | Copy from `backend/.env.example` |
| Run migrations on production DB | NOT DONE | `cd backend && npm run migrate` |
| Import existing shop data | NOT DONE | Use CSV import (Settings > Data Import) |

### Priority 2 — Fix Known Gaps

| Task | Status | Files |
|------|--------|-------|
| Backup/Restore: use `pg_dump` | NOT DONE | `electron/main.js`, `frontend/js/modules/common.js` |
| Wire up cross-module search | NOT DONE | `frontend/js/modules/search.js`, `frontend/js/app.js` |
| Test macOS build (if needed) | NOT DONE | Needs `icon.icns` from `electron/assets/generate-icons.sh` |

### Priority 3 — Polish (As Time Allows)

| Task | Notes |
|------|-------|
| Remove license/activation placeholders from setup wizard | `electron/setup-wizard/wizard.html` |
| Add dashboard summary report (open quotes, low stock, overdue tasks) | Enhancement |
| Improve error messages in frontend | UX polish |

---

## Permanently Dropped

These items were from the commercialization plan and are no longer relevant:

- ~~License key system (generation, validation, tiers)~~
- ~~Auto-updater for maintenance subscribers~~
- ~~EULA, Privacy Policy, legal docs~~
- ~~API versioning (`/api/v1/` prefix)~~
- ~~TypeScript migration of remaining routes~~ (JS works fine)
- ~~Frontend TypeScript + Vite build system~~
- ~~E2E tests (Playwright)~~
- ~~Service layer / dependency injection~~
- ~~Frontend code splitting / minification~~
- ~~User manual / installation guide for customers~~

---

## Architecture Reference

```
Electron Main Process (electron/main.js)
    ↓ fork()
Express Backend (backend/server.js on localhost:3000)
    ├── Routes: customers, inventory, tasks, users, workcenters, maintenance, etc.
    ├── Middleware: auth, rate limiting, validation
    ├── Migrations: schema versioning
    └── Database: PostgreSQL
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
| Type definitions | `backend/src/types/index.ts` |
| Frontend entry | `frontend/js/app.js` |
| Frontend modules | `frontend/js/modules/*.js` |
| Electron main | `electron/main.js` |
| Setup wizard | `electron/setup-wizard/` |
| Database schemas | `database/*.sql` |
| Build config | `package.json` (build section) |
| Env config | `backend/.env.example` |

## Common Commands

```bash
# Development
cd backend && npm run dev          # Start backend with auto-reload
npm start                          # Run Electron app

# Database
cd backend && npm run migrate      # Run migrations
cd backend && npm run migrate:status  # Check status

# Testing
cd backend && npm test             # Run Jest tests

# Building installers
npx electron-builder --win --publish never
npx electron-builder --linux deb --publish never
npx electron-builder --linux AppImage --publish never
```
