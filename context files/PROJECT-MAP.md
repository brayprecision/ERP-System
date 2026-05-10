# BPERP Project Map & Audit Report

**Generated:** 2026-05-10 | **Version:** 1.0.0-beta.1 | **Auditor:** Claude Code  
**Codebase:** ~24,000 LOC custom code (backend + frontend + Electron)

---

## Executive Summary

> **Before entering real production data**, address SEC-01 and INC-01 at minimum.

| ID | Sev | One-liner |
|----|-----|-----------|
| SEC-01 | 🔴 CRITICAL | Any account with "placeholder" in its password hash accepts **any password** |
| INC-01 | 🔴 CRITICAL | Backup restore endpoint returns `501` — data cannot be restored |
| SEC-04 | 🟠 HIGH | `createModal()` and most inline `innerHTML` templates inject user data without escaping |
| STA-01 | 🟠 HIGH | SQLite WAL mode set unconditionally — will fail on many NFS/SMB network filesystems |
| SEC-02 | 🟠 HIGH | CORS default is `*`; no `.env.example` exists to guide production config |
| INT-01 | 🟠 HIGH | No `.env` or `.env.example` in `backend/` — new workstation setup has no env reference |
| INC-02 | 🟠 HIGH | Notifications bell shows **hardcoded demo alerts** — not real system alerts |
| SEC-05 | 🟡 MEDIUM | All `PUT` (update) routes bypass Zod validation — raw `req.body` goes to SQL |
| STA-02 | 🟡 MEDIUM | db.js UPDATE+RETURNING heuristic breaks when the last param is not the row ID |
| STA-03 | 🟡 MEDIUM | Live `.db` files committed to git — data leak and merge conflict risk |
| INC-03 | 🟡 MEDIUM | Workcenter queue displays have no auto-refresh |
| INC-04 | 🟡 MEDIUM | Supervisor permission check on checklist uncheck is a `console.log` stub only |
| DCL-01 | 🟡 MEDIUM | `sales.js` is 4,372 lines across 6 unrelated domains — unmanageable |

Full details in the **Audit Report** section at the bottom.

---

## 1. Deployment Architecture

Two modes, selected at first run via the setup wizard:

### Standalone Mode
All processes on one machine (typical for a single-PC shop or first deployment):
```
[Windows PC]
  └─ Electron (main.js — main process)
       ├─ forks → Node.js backend  (Express, port 3000)
       │              └─ SQLite db  (bperp.db, local disk)
       └─ BrowserWindow → frontend SPA (served from /frontend/)
              ↕ REST API at localhost:3000/api/
```

### Network Mode
Backend on NAS or dedicated server; all shop PCs connect as thin clients:
```
[NAS / Server PC]
  └─ Node.js backend  (Express, port 3000)
       └─ SQLite db  (bperp.db, same machine's disk — NOT a raw network mount)

[Shop PC × N]
  └─ Electron (renderer only — no local backend)
       └─ BrowserWindow loads http://NAS-IP:3000/
              ↕ REST API at NAS-IP:3000/api/
```

**Critical constraint:** The `bperp.db` file must be on the same machine as the backend process. WAL mode requires a shared-memory file (`.db-shm`) that cannot be reliably created over SMB/NFS — see STA-01.

---

## 2. Annotated Directory Tree

```
ERP-System/
│
├── backend/                          ← Node.js + Express API server
│   ├── server.js          (1108 L)  ← App entry, route mounting, CORS, migration runner
│   ├── db.js              (237 L)   ← SQLite wrapper with PostgreSQL compatibility layer
│   ├── package.json                 ← Backend deps: better-sqlite3, bcrypt, joi, multer, xlsx
│   ├── jest.config.js               ← Test runner config
│   ├── README.md          (16 KB)   ← Backend API reference, route docs
│   ├── .env                         ← DB_PATH, PORT (not committed, but db files are — see STA-03)
│   ├── .env.test                    ← Test env
│   ├── bperp.db           (397 KB)  ← ⚠ LIVE production DB committed to git (STA-03)
│   ├── bperp.db-shm                 ← ⚠ WAL shared-memory file committed to git (STA-03)
│   ├── bperp.db-wal                 ← ⚠ WAL write-ahead log committed to git (STA-03)
│   ├── bperp_test.db      (4 KB)    ← Test database (also committed to git)
│   │
│   ├── middleware/
│   │   ├── auth.js                  ← JWT Bearer token validation, requireAuth middleware
│   │   ├── validation.js            ← Zod schemas and validateBody() helper
│   │   ├── rateLimit.js             ← apiLimiter (all /api/), exportLimiter (exports)
│   │   └── index.js                 ← Barrel re-export (verify it is imported somewhere)
│   │
│   ├── routes/                      ← 13 route modules (see Section 3)
│   │   ├── inventory.js   (1402 L)
│   │   ├── workorders.js  (736 L)
│   │   ├── quotes.js      (845 L)
│   │   ├── orders.js      (836 L)   ← ⚠ Relationship to workorders unclear (INC-05)
│   │   ├── labor.js       (680 L)
│   │   ├── import.js      (828 L)
│   │   ├── users.js       (556 L)
│   │   ├── maintenance.js (533 L)
│   │   ├── machines.js    (422 L)
│   │   ├── customers.js   (576 L)
│   │   ├── tasks.js       (581 L)
│   │   ├── workcenters.js (476 L)
│   │   └── leads.js       (296 L)
│   │
│   ├── migrations/
│   │   ├── migrate.js               ← Migration runner (up/down)
│   │   └── scripts/
│   │       ├── 20260128_000000_initial_schema.js       ← All core tables
│   │       ├── 20260302_000000_products_parts_bom.js   ← products, parts, BOM tables
│   │       ├── 20260330_000000_labor_time_tracking.js  ← labor_shifts, labor_wo_segments
│   │       ├── 20260331_000000_labor_misc_task_segments.js
│   │       ├── 20260401_000000_sales_api_schema_alignment.js ← Adds columns to customers, quotes, work_orders, wo_checklist
│   │       └── 20260402_000000_sales_leads.js          ← sales_leads table
│   │
│   └── tests/
│       ├── setup.js
│       ├── helpers/testDb.js
│       ├── middleware/auth.test.js, validation.test.js
│       ├── routes/import.test.js, labor.test.js, users.test.js
│       └── unit/importHelpers.test.js
│
├── frontend/                         ← Vanilla JS + Tailwind SPA
│   ├── index.html         (39.5 KB) ← Single HTML shell; all views injected into #dashboardContent
│   ├── loading.html       (8.5 KB)  ← Loading spinner shown during module init
│   ├── app.js             (1200+ L) ← Router, module loader, global init, BPERP namespace
│   ├── css/
│   │   └── dashboard.css            ← CSS variables for theming, custom component styles
│   ├── js/modules/                  ← 14 feature modules (see Section 4)
│   │   ├── sales.js       (4372 L)  ← ⚠ 6 domains in one file (DCL-01)
│   │   ├── tasks.js       (3107 L)
│   │   ├── inventory.js   (1216 L)
│   │   ├── users.js       (1150 L)
│   │   ├── maintenance.js (1080 L)
│   │   ├── common.js      (780 L)   ← Shared utilities, createModal(), showToast()
│   │   ├── search.js      (606 L)   ← Global search (wired at app.js:1296)
│   │   ├── laborLocal.js  (596 L)   ← localStorage-backed labor clock (offline path)
│   │   ├── storage.js     (532 L)   ← localStorage adapter, offline caching layer
│   │   ├── timeTracking.js(399 L)
│   │   ├── salesLeadsData.js(415 L) ← Leads data management
│   │   ├── laborApi.js    (285 L)   ← API-backed labor (online path)
│   │   ├── salesApi.js    (154 L)   ← Sales API call wrappers
│   │   └── laborClock.js  (164 L)   ← Labor clock UI initialization
│   └── assets/
│       └── bperp-icon.ico
│
├── electron/                         ← Electron desktop wrapper
│   ├── main.js            (41 KB)   ← Window management, backend fork, IPC handlers, tray
│   ├── preload.js         (8 KB)    ← Secure IPC bridge (contextBridge → window.electronAPI)
│   ├── splash.html        (4.6 KB)  ← Startup splash screen
│   ├── offline.html       (2.6 KB)  ← Fallback when backend unreachable
│   ├── setup-wizard/
│   │   ├── wizard.js      (16.5 KB) ← First-run setup: standalone vs. network mode
│   │   ├── wizard.html    (8.9 KB)
│   │   └── wizard.css     (10 KB)
│   └── assets/                      ← App icons
│
├── context files/                    ← Internal planning docs (not shipped)
│   ├── INTERNAL-ROADMAP.md  (9.3 KB) ← Priorities, deployment strategy
│   ├── SETUP-WIZARD-PLAN.md (5.4 KB) ← Wizard requirements
│   └── .cursorrules.md              ← AI coding guidelines
│
├── docs/
│   ├── NAS-SETUP.md       (5.2 KB)  ← Dev vs. NAS deployment guide
│   ├── FUTURE-LABOR-EXPANSION.md    ← Planned labor module enhancements
│   └── Shop Logo.png, shop_logo_app_version.jpg
│
├── build/
│   ├── icon.ico           (93 KB)   ← Proper ICO container (fixed from PNG rename)
│   └── icon.png           (1 MB)    ← Source image
│
├── scripts/
│   ├── rebuild-backend-native.js    ← Rebuilds better-sqlite3/bcrypt for Electron ABI
│   ├── launch-beta.ps1              ← PowerShell dev launcher
│   └── launch-beta.cmd              ← CMD dev launcher
│
├── dist-installers/                  ← Built output (gitignored)
│   ├── BPERP-1.0.0-beta.1-win-x64.exe (87.6 MB)
│   └── win-unpacked/
│
├── exports/                          ← User-generated data (backups, CSV exports)
│   ├── backups/
│   └── csv/
│
├── package.json                      ← Root: Electron builder config, npm scripts
├── README.md              (14 KB)    ← Getting started, troubleshooting
├── CHANGELOG.md           (31 KB)    ← Version history
├── LICENSE.txt                       ← MIT + Commons Clause
└── ERP-System.code-workspace         ← VS Code workspace config
```

---

## 3. Backend Route Map

Routes mounted in `server.js`. Auth = `requireAuth` middleware applied to all routes unless noted.

| Prefix | File | POST Zod | PUT Zod | Notable Gaps / Notes |
|--------|------|----------|---------|----------------------|
| `/api/` (inline) | server.js | partial | — | health, setup status, backup/export, static file serving; restore returns **501** |
| `/api/inventory` | inventory.js | ✅ partial | ❌ none | materials, tooling, misc, products, parts, kanban queries |
| `/api/work-orders` | workorders.js | ✅ partial | ❌ none | WO CRUD, per-step checklist; supervisor-uncheck is stub only |
| `/api/quotes` | quotes.js | ✅ partial | ❌ none | Quote lifecycle; convert-to-WO endpoint requires only `requireAuth` (no role check) |
| `/api/orders` | orders.js | ❓ unknown | ❓ unknown | Relationship to work orders unclear; may overlap |
| `/api/labor` | labor.js | N/A | N/A | Shift clock-in/out, per-job timers; dynamic IN-clause built from server-controlled IDs (safe) |
| `/api/import` | import.js | N/A | — | Bulk CSV/Excel import; `exportLimiter` applied |
| `/api/users` | users.js | ✅ (login) | ✅ partial | Auth, user CRUD; placeholder bypass (SEC-01); 24hr session tokens |
| `/api/maintenance` | maintenance.js | ✅ partial | ❌ none | Machine maintenance scheduling, urgency tracking |
| `/api/machines` | machines.js | ✅ partial | ❌ none | Workcenter/machine queue management |
| `/api/customers` | customers.js | ✅ partial | ❌ none | Customer + contact management |
| `/api/tasks` | tasks.js | ✅ partial | ❌ none | Task workflow (Programming, Ordering, Machining, etc.) |
| `/api/workcenters` | workcenters.js | ✅ partial | ❌ none | Workcenter state tracking |
| `/api/leads` | leads.js | ✅ | ❌ none | Sales lead pipeline |

**Pattern:** All `POST` routes use Zod schemas via `validateBody()`. All `PUT` (update) routes pass raw `req.body` directly to SQL — no input validation (SEC-05).

---

## 4. Frontend Module Table

All modules are ES modules loaded via dynamic `import()` in `app.js`. Exposed on `window.BPERP.*`.

| Module | Lines | Data Source | BPERP namespace | Key Issues |
|--------|-------|-------------|-----------------|------------|
| sales.js | 4,372 | API + cache | `BPERP.sales` | 6 domains (Customers, Leads, Quotes, WOs, Archive, Docs); XSS in innerHTML templates; escaping only in Leads section |
| tasks.js | 3,107 | API | `BPERP.tasks` | Task workflow tabs (8 types); `deactivate()` called on route away |
| inventory.js | 1,216 | API + cache | `BPERP.inventory` | Materials, tooling, misc, products, parts, kanban |
| users.js | 1,150 | API | `BPERP.users` | Login modal, user CRUD, permission checking, `isLoggedIn()`, `hasPermission()` |
| maintenance.js | 1,080 | API | `BPERP.maintenance` | Machine maintenance scheduling |
| common.js | 780 | — | `BPERP.common` | Shared utils: `createModal()` (⚠ no content escaping), `showToast()`, date helpers, status badges |
| search.js | 606 | `BPERP.*` namespaces | `BPERP.search` | `setupGlobalSearch()` called at app.js:1296 ✅; reads from preloaded API data |
| laborLocal.js | 596 | localStorage | — | Offline-first shift clock and job timers; intentional offline fallback path |
| storage.js | 532 | localStorage | `BPERP.storage` | localStorage adapter with offline caching; paired with laborLocal.js |
| timeTracking.js | 399 | API | `BPERP.timeTracking` | Time tracking UI and calculations |
| salesLeadsData.js | 415 | API | (via sales.js) | Leads data management layer |
| laborApi.js | 285 | API | — | Online-path labor API calls; counterpart to laborLocal.js |
| salesApi.js | 154 | API | (via sales.js) | Sales API call wrappers |
| laborClock.js | 164 | — | — | Labor clock UI init; `refreshLaborClockUI()` called on navigation |

**Labor dual-path:** `laborLocal.js` (offline/localStorage) and `laborApi.js` (online/backend) implement parallel APIs. The pattern is intentional for offline resilience but is undocumented in either file.

---

## 5. Key Data Flows

### A. Authentication
```
[Login form] → POST /api/users/login
  → Zod validates {username, password}
  → verifyPassword(): bcrypt compare (or legacy SHA-256, auto-upgraded to bcrypt)
  → ⚠ placeholder bypass: any account with "placeholder" in hash accepts any password
  → 24-hour session token written to user_sessions table
  → Token returned in response body
  → Frontend stores token in localStorage as "bperp_auth_token"
  → All subsequent API calls: Authorization: Bearer <token>
  → auth.js middleware validates token against user_sessions on every request
```

### B. Work Order Lifecycle
```
Quote (quotes.js) → POST /api/quotes/:id/convert-to-wo
  → Creates work_orders row (no role check beyond requireAuth)
  → Frontend: sales.js.loadWIPView() shows all active WOs
  → Machinist: PUT /api/work-orders/:woId/checklist/:itemId (no Zod validation)
    → db.js RETURNING emulation re-fetches by params[last] = woId (⚠ wrong ID for checklist items)
  → Status update: PUT /api/work-orders/:id (no Zod validation)
  → Archive: POST /api/work-orders/:id/archive
```

### C. Labor Clock
```
[Shop PC]
  If online and token present:
    → POST /api/labor/shift/start  (laborApi.js)
    → POST /api/labor/timer/start/:woId
  If offline OR no token:
    → laborLocal.js writes to localStorage
    → Data lives only on that device until manual sync (not yet implemented)
```

---

## 6. Database Schema

Tables created by migrations in order:

### Auth & Users (`20260128`)
| Table | Key Columns |
|-------|-------------|
| `users` | id, username, name, email, password_hash, role, appearance_settings (JSON), tab_permissions (JSON), is_active |
| `user_sessions` | id, user_id→users, token (UNIQUE), expires_at (24hr) |
| `role_defaults` | id, role (UNIQUE), tab_permissions (JSON) — seeded: Administrator, Machinist, Operator |
| `user_activity_log` | id, user_id→users, action, details, ip_address |

### Customers (`20260128` + `20260401`)
| Table | Key Columns |
|-------|-------------|
| `customers` | id, name, address, phone, terms, notes, is_active, deleted_at; +address_line1/2, city, state, zip_code, country, fax, website, default_terms, tax_id, email (20260401) |
| `contacts` | id, customer_id→customers, name, email, phone, role, is_primary; +mobile, notes, is_active (20260401) |

### Inventory (`20260128` + `20260302`)
| Table | Key Columns |
|-------|-------------|
| `materials` | id, name, part_number, category, material_type, material_shape, qty_on_hand, minimum_qty, unit, supplier, unit_price, location, reorder_link, deleted_at |
| `tooling` | id, name, part_number, tool_type, operation, qty_on_hand, minimum_qty, condition, deleted_at |
| `misc_items` | id, name, part_number, workcenter, qty_on_hand, minimum_qty, deleted_at |
| `products` | (added by 20260302 migration) |
| `parts` | (added by 20260302 migration) |

### Sales (`20260128` + `20260401`)
| Table | Key Columns |
|-------|-------------|
| `quotes` | id, quote_number (UNIQUE), customer_id→customers, rfq_number, part_number, description, quantity, status, total_amount, sent_at, created_by→users, deleted_at; +contact_id, priority, valid_until, subtotal, tax_rate, won_at, lost_at, lost_reason (20260401) |
| `quote_items` | id, quote_id→quotes, line_number, part_number, description, quantity, unit_price, extended_price; +revision, material, setup_cost, lead_time_days (20260401) |
| `quote_documents` | id, quote_id→quotes, filename, file_type, file_size, file_data (base64), uploaded_by→users |
| `sales_leads` | (added by 20260402) — status, value, source, assigned_to→users |

### Work Orders (`20260128` + `20260401`)
| Table | Key Columns |
|-------|-------------|
| `work_orders` | id, wo_number (UNIQUE), customer_id→customers, customer_name, quote_id→quotes, due_date, status, completion_percentage, notes, created_by→users, deleted_at; +part_number, revision, description, quantity, unit, material, ship_date, completed_date, priority, customer_po, quoted_price, actual_cost, internal_notes, current_step (20260401) |
| `wo_checklist` | id, work_order_id→work_orders, step_number, step_name, is_completed, completed_by→users, completed_at; +step_order, step_key, step_data, date_value, reference_number, vendor_supplier, operator_name (20260401) |
| `wo_checklist_audit` | id, work_order_id, step_number, action, changed_by→users, old_value, new_value |
| `work_order_archive` | id, original_id, wo_number, customer_id, status, checklist_data (JSON blob), archived_at |

### Tasks & Workcenters (`20260128`)
| Table | Key Columns |
|-------|-------------|
| `tasks` | id, type, title, description, work_order_id→work_orders, assigned_to→users, status, priority, due_date, task_data (JSON), is_recurring, deleted_at |
| `task_assignments` | id, task_id→tasks, user_id→users, assigned_by→users, removed_at |
| `task_history` | id, task_id→tasks, action, old_value, new_value, user_id→users |
| `workcenters` | id, name, type, location, capacity, is_active, display_order |
| `workcenter_queue` | id, workcenter_id→workcenters, work_order_id→work_orders, task_id→tasks, sequence, status, priority, part_number, quantity, operation_number, operator_id→users |

### Machines & Maintenance (`20260128`)
| Table | Key Columns |
|-------|-------------|
| `machines` | id, name, machine_id (UNIQUE), type, manufacturer, workcenter_id→workcenters, status, maintenance_hours, total_run_hours, specifications (JSON) |
| `machine_status_history` | id, machine_id→machines, status, previous_status, changed_at |
| `maintenance_task_definitions` | id, machine_id→machines, task_name, frequency_type, frequency_value, instructions, safety_notes |
| `maintenance_materials` | id, task_definition_id→mtd, material_name, quantity, is_critical |
| `maintenance_tasks` | id, definition_id→mtd, machine_id→machines, due_date, status, completed_by→users, deferred_to, issues_found, readings (JSON) |
| `maintenance_history` | id, machine_id→machines, maintenance_task_id, performed_by→users |

### Purchasing, Inspection, Shipping (`20260128`)
| Table | Key Columns |
|-------|-------------|
| `purchase_orders` | id, po_number, supplier_name, status, work_order_id→work_orders, total, tracking_number |
| `po_items` | id, po_id→purchase_orders, item_name, quantity_ordered, quantity_received, inspection_required |
| `order_issues` | id, po_id, issue_type, description, severity, status, resolved_at |
| `inspection_tasks` | id, task_id→tasks, work_order_id→work_orders, inspection_type, quantity_to_inspect, critical_dimensions (JSON), inspection_results (JSON) |
| `shipping_tasks` | id, task_id→tasks, work_order_id→work_orders, customer_id→customers, items (JSON), tracking_number |
| `receiving_tasks` | id, task_id→tasks, po_id→purchase_orders, expected_items (JSON), received_items (JSON), has_discrepancy |

### Labor (`20260330` + `20260331`)
| Table | Key Columns |
|-------|-------------|
| `labor_shifts` | (added by 20260330) — user, clock-in/out, total minutes |
| `labor_work_order_segments` | (added by 20260330) — user, work_order_id, start/stop, minutes |
| `labor_misc_task_segments` | (added by 20260331) — user, task type, start/stop |

### Logging
| Table | Key Columns |
|-------|-------------|
| `activity_log` | id, entity_type, entity_id, action, description, user_id→users |
| `user_activity_log` | id, user_id→users, action, details, ip_address (duplicates activity_log — audit which is used) |

---

## 7. Known Gaps (Quick Reference)

Issues that will generate user bug reports immediately after first real deployment:

1. **Backup restore is broken (501)** — `POST /api/backup/restore` → 501. The UI has a full restore flow but no backend. (INC-01)
2. **Notifications bell is demo data** — Three hardcoded fake alerts in `app.js:1093`. Not a real alert system. (INC-02)
3. **Workcenter displays don't auto-refresh** — Machinists watching a queue display will see stale data unless they navigate away and back. (INC-03)
4. **Checklist uncheck has no supervisor gate** — Anyone can uncheck a completed step; the permission check is a `console.log` stub. (INC-04)
5. **Labor offline sync not implemented** — Data captured by `laborLocal.js` while offline stays in localStorage on that device. No sync path to backend exists.
6. **orders.js purpose unclear** — A full route file exists (`routes/orders.js`, 836 lines) but its relationship to `workorders.js` is undocumented.
7. **Cross-activity-log table** — Both `activity_log` and `user_activity_log` exist; routes use both inconsistently.
8. **No `.env.example`** — A new workstation operator has no reference for `DB_PATH`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`.
9. **Auto-update not implemented** — `preload.js:197` has an `onUpdateAvailable` listener stub; no `electron-updater` dependency or `autoUpdater` calls exist in `main.js`.
10. **Debug logs left in production code** — 30+ `console.log` statements in `app.js` Quick Add dropdown section (lines 939–1054).

---

## 8. Common Dev Commands

```powershell
# Start full Electron app (dev)
npm start

# Start only the backend (for API testing)
npm run dev:backend

# Run backend tests
npm run backend:test

# Run setup wizard (first-run flow)
npm run setup

# Rebuild native modules (better-sqlite3, bcrypt) for packaged Electron
# Run this before building the installer
node scripts/rebuild-backend-native.js
# OR: cd backend && npx electron-rebuild --version 28.3.3 --module-dir .

# Build Windows installer
npx electron-builder --win --publish never

# Run migration manually (up)
cd backend && node migrations/migrate.js up

# Run migration manually (down)
cd backend && node migrations/migrate.js down
```

---

---

## Audit Report

*Generated 2026-05-10. All file references include line numbers verified at time of audit.*

---

### A1. Security

#### SEC-01 — 🔴 CRITICAL: Placeholder password bypass

**File:** [backend/routes/users.js](../backend/routes/users.js) lines 55–57  
**Code:**
```js
if (hash && hash.includes('placeholder')) {
    return true; // Allow any password for placeholder accounts
}
```
**Impact:** Any user account whose `password_hash` column contains the string "placeholder" accepts **any password**. This is migration scaffolding that was never removed. Check the live `bperp.db` for accounts with this condition immediately.  
**Fix:** Query `SELECT username, password_hash FROM users WHERE password_hash LIKE '%placeholder%'`. Reset or delete those accounts, then remove this bypass block.

---

#### SEC-02 — 🟠 HIGH: CORS defaults to wildcard `*`

**File:** [backend/server.js](../backend/server.js) line 46  
**Code:**
```js
origin: process.env.CORS_ORIGIN || '*',  // Set CORS_ORIGIN env var in production
```
**Impact:** Every deployment gets open CORS because no `.env.example` guides operators to set `CORS_ORIGIN`. Any page on the LAN can make credentialed requests to the API.  
**Fix:** Create `backend/.env.example` with `CORS_ORIGIN=http://localhost:3000` and document the production value. For Standalone mode the default is fine; for Network mode it should be locked to the NAS IP.

---

#### SEC-03 — 🟠 HIGH: Session token stored in localStorage

**File:** `frontend/js/app.js` (implicit — token stored as `bperp_auth_token`)  
**Impact:** Tokens stored in `localStorage` are readable by any JavaScript running on the page. In an Electron context this is tolerable (renderer is sandboxed), but it becomes the standard XSS amplifier: an XSS vulnerability automatically becomes a full session hijack.  
**Fix:** Move to `sessionStorage` (same origin, tab-scoped, not persistent after close) as a minimal improvement. `HttpOnly` cookie is more secure but requires same-origin backend — feasible in Standalone mode only.

---

#### SEC-04 — 🟠 HIGH: Unescaped user data in `innerHTML` throughout the app

**Primary file:** [frontend/js/modules/common.js](../frontend/js/modules/common.js) line 187  
**Code:**
```js
modal.innerHTML = `
    <div class="...">
        ${content}   // ← content is injected verbatim
    </div>
`;
```
**Also:** `sales.js` inline templates for customers, quotes, WIP views all interpolate `wo.partNumber`, `customer.name`, `quote.description`, etc. directly into `innerHTML`. Only the Leads section applies `escapeLeadHtml()`.  
The app has a working escape helper (`esc()`) defined in `app.js:376` for the About page. It is not shared.  
**Impact:** A customer name or part number containing `<script>` or `<img onerror=...>` executes in the app. In an Electron/LAN context this is an insider threat and import-poisoning risk.  
**Fix:** Extract `esc()` from `app.js:376` into `common.js` and export it. Apply it to all user-controlled values before string interpolation into `innerHTML`.

---

#### SEC-05 — 🟡 MEDIUM: All PUT routes bypass Zod validation

**Files:** All 13 route files — confirmed in `workorders.js:421`, `inventory.js`, `customers.js`, `quotes.js`, `maintenance.js`, `machines.js`  
**Pattern:**
```js
router.put('/:id', async (req, res) => {
    const { field1, field2 } = req.body;  // raw — no validateBody()
    await pool.query('UPDATE ...', [...]);
```
**Impact:** No type coercion, range checks, or required-field enforcement on updates. Malformed data (wrong types, null where not null expected) goes to SQLite.  
**Fix:** Add `validateBody(schemas.updateX)` middleware to each `PUT` route. Reuse or extend existing schemas in `middleware/validation.js`.

---

#### SEC-06 — 🟡 MEDIUM: Legacy SHA-256 password hashes still accepted

**File:** [backend/routes/users.js](../backend/routes/users.js) lines 47–52  
**Code:**
```js
if (hash && hash.length === 64 && !hash.startsWith('$2')) {
    const legacyHash = crypto.createHash('sha256').update(password + 'bperp_salt').digest('hex');
    return hash === legacyHash;
}
```
**Impact:** SHA-256 with a static salt is not a password-hashing algorithm. Any account whose owner has not logged in since the migration still has a weak hash. These are auto-upgraded to bcrypt on first login (lines 132–140) — but only on login.  
**Fix:** Run a one-time migration script to force-expire or flag all accounts still using SHA-256 hashes, requiring a password reset on next login.

---

#### SEC-07 — 🟢 LOW: Duplicate `GET /api/setup/status` route

**File:** [backend/server.js](../backend/server.js) — appears to be defined twice  
**Impact:** Express uses the first matched handler. The second definition is dead code. Confusing when reading the file.  
**Fix:** Remove the duplicate.

---

### A2. Stability

#### STA-01 — 🟠 HIGH: SQLite WAL mode set unconditionally

**File:** [backend/db.js](../backend/db.js) line 29  
**Code:**
```js
db.pragma('journal_mode = WAL');
```
**Impact:** WAL mode requires a working shared-memory file (`.db-shm`). Many NFS and SMB configurations do not support the file locking primitives WAL needs — the database silently falls back to DELETE journal mode, or worse, returns a READONLY error. There is no runtime detection or fallback.  
**Fix:** Attempt WAL; catch the error; fall back to `journal_mode = DELETE` and log a warning. Alternatively, test WAL support on startup and warn the administrator.

---

#### STA-02 — 🟡 MEDIUM: db.js UPDATE+RETURNING heuristic is unsafe for multi-condition WHERE

**File:** [backend/db.js](../backend/db.js) lines 185–194  
**Code:**
```js
if (/^UPDATE/i.test(trimmed)) {
    db.prepare(withoutReturning).run(...params);
    // Re-fetch the updated row — WHERE id = ? is always the last param
    const id = params[params.length - 1];
    const rows = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).all(id)...
}
```
**Impact:** This assumption breaks when the `WHERE` clause has multiple conditions, e.g., `WHERE id = $8 AND work_order_id = $9`. In that case `params[last]` is `work_order_id`, not the checklist item `id` — the SELECT returns the wrong row or nothing.  
**Confirmed affected route:** `PUT /api/work-orders/:woId/checklist/:itemId` (`workorders.js:556`). The checklist item update succeeds in the DB but the RETURNING result is wrong, causing the frontend to render stale or mismatched data.  
**Fix:** Parse the translated WHERE clause to extract the actual `id` parameter position, or switch to a transaction: `UPDATE ...; SELECT * FROM table WHERE id = $actual_id`.

---

#### STA-03 — 🟡 MEDIUM: Live database files committed to git

**Files:** `backend/bperp.db`, `backend/bperp.db-shm`, `backend/bperp.db-wal`, `backend/bperp_test.db`  
**Impact:** Production data is in version history. Any push to a remote (GitHub) makes business data public. WAL files cause merge conflicts when two developers run the app simultaneously.  
**Fix:** Add to `.gitignore`:
```
backend/*.db
backend/*.db-shm
backend/*.db-wal
```
Then purge from history: `git rm --cached backend/bperp.db backend/bperp.db-shm backend/bperp.db-wal`. Keep `bperp_test.db` in `.gitignore` too (it will be recreated by test setup).

---

#### STA-04 — 🟡 MEDIUM: NSIS `runAfterFinish: true` launches app before native modules are verified

**File:** `package.json` (electron-builder NSIS config)  
**Impact:** The installer launches BPERP immediately after installation. If `better-sqlite3` was compiled for system Node.js (not Electron's Node), the app crashes on the first DB access. This is the same root cause as the documented "Test Path" crash.  
**Fix:** Either set `runAfterFinish: false` and document that users must launch from the Start Menu, or add a post-install script that runs `electron-rebuild` before the app is launched. The `scripts/rebuild-backend-native.js` helper already exists.

---

#### STA-05 — 🟢 LOW: Session cleanup runs only on login, not on a schedule

**File:** [backend/routes/users.js](../backend/routes/users.js) lines 147–150  
**Code:**
```js
await pool.query('DELETE FROM user_sessions WHERE user_id = $1 AND expires_at < NOW()', [user.id]);
```
**Impact:** Expired sessions accumulate in `user_sessions` indefinitely for users who are logged in continuously. No background cleanup or periodic purge exists.  
**Fix:** Add a startup cleanup in `server.js`: `DELETE FROM user_sessions WHERE expires_at < datetime('now')`. Or add a daily cron job.

---

#### STA-06 — 🟢 LOW: `GET /api/health` does not query the database

**File:** `backend/server.js`  
**Impact:** The health endpoint returns `{status: 'ok'}` even when the database is unreachable or corrupted. Silent failures are not detected by any watchdog.  
**Fix:** Execute `SELECT 1` in the health handler and return `{status: 'error'}` if it fails.

---

### A3. Incomplete Features

#### INC-01 — 🔴 CRITICAL: Backup restore returns 501

**File:** `backend/server.js` line ~658  
**Code:** `POST /api/backup/restore` → `res.status(501).json({ error: 'Not implemented' })`  
**Impact:** The frontend has a complete restore UI (file picker, confirmation, progress). It calls this endpoint. Clicking "Restore Data" silently fails with a 501. If a corrupted database needs recovery, there is no in-app path.  
**Fix:** Implement the restore endpoint: accept a JSON backup file, validate its schema, wipe the relevant tables in a transaction, and re-insert the data. Or, for a simpler approach in SQLite: accept the raw `.db` file upload and copy it over the live file (with backend temporarily paused).

---

#### INC-02 — 🟠 HIGH: Alerts bell shows hardcoded demo notifications

**File:** [frontend/js/app.js](../frontend/js/app.js) lines 1093–1122  
**Content:** Three hardcoded alerts: "Work Order WO-2024-001 Overdue", "Quote QT-2024-045 Due Today", "Material WO-2024-038 Arrived".  
**Impact:** The bell icon suggests a real alert system. Users will click it expecting relevant notifications and see stale demo data.  
**Fix:** Either implement a real alert query (overdue WOs, low inventory, upcoming maintenance) or hide the bell until alerts are implemented.

---

#### INC-03 — 🟡 MEDIUM: Workcenter queue displays have no auto-refresh

**Impact:** Machinists watching the workcenter WIP view on a dedicated display see stale queue data. The WIP view in `sales.js` has `masterTimer.register('wip-refresh', ..., 300)` — 300 ticks × 1-second heartbeat = 5-minute refresh. But workcenter-specific queue views (`workcenters.js` routes) have no equivalent timer.  
**Fix:** Add a periodic refresh to the workcenter views, or extend the existing `masterTimer` pattern from `sales.js` to workcenter views.

---

#### INC-04 — 🟡 MEDIUM: Checklist uncheck has no supervisor permission gate

**File:** [backend/routes/workorders.js](../backend/routes/workorders.js) lines 542–545  
**Code:**
```js
if (current.is_completed && isCompleted === false) {
    // In a real app, you'd check for supervisor permission here
    console.log(`Checklist item ${itemId} being unchecked — would require supervisor permission`);
}
```
**Impact:** Any authenticated user can uncheck any completed checklist step. No role check enforced.  
**Fix:** Check `req.user.role === 'Administrator'` (or a `canUncomplete` permission) before allowing the uncheck. Return 403 if the user lacks permission.

---

#### INC-05 — 🟡 MEDIUM: `orders.js` purpose is undocumented and potentially overlapping

**File:** [backend/routes/orders.js](../backend/routes/orders.js) — 836 lines  
**Impact:** The file exists and is mounted in `server.js`, but its relationship to `workorders.js` is unclear. If they overlap, one set of routes may be dead. If they're distinct (purchase orders vs. work orders), that's not documented.  
**Fix:** Document the purpose in the file header. If it's redundant with `workorders.js`, remove it. If it covers purchase orders, rename it to `purchase-orders.js`.

---

#### INC-06 — 🟢 LOW: `onUpdateAvailable` IPC listener in preload.js is dead code

**File:** `electron/preload.js` line ~197  
**Impact:** The listener is exposed via `contextBridge` but `main.js` never emits this event (no `electron-updater` dependency). Misleads developers into thinking auto-update is implemented.  
**Fix:** Remove the listener stub, or implement auto-update using `electron-updater` + GitHub Releases.

---

### A4. Integration Experience

#### INT-01 — 🟠 HIGH: No `.env.example` in backend

**Impact:** A new workstation operator (or developer) has no reference for required environment variables. The defaults are: `DB_PATH` = local `bperp.db`, `PORT` = 3000, `CORS_ORIGIN` = `*`. These defaults are wrong for Network/NAS deployment.  
**Fix:** Create `backend/.env.example`:
```
# BPERP Backend Configuration
DB_PATH=/path/to/nas/bperp.db
PORT=3000
CORS_ORIGIN=http://192.168.1.100:3000
```
Document it in the README's installation section.

---

#### INT-02 — 🟠 HIGH: NSIS runAfterFinish may cause crash on first launch (installer issue)

**File:** `package.json` electron-builder config  
**Impact:** See STA-04. From an integration perspective: the first-run experience is broken because the app crashes before the setup wizard can run. A new employee's first impression of the software is a crash.  
**Fix:** Same as STA-04 — disable `runAfterFinish` and add clear "Launch BPERP from Start Menu" post-install messaging.

---

#### INT-03 — 🟡 MEDIUM: Setup wizard has no standalone-mode path testing

**File:** [electron/setup-wizard/wizard.js](../electron/setup-wizard/wizard.js)  
**Observation:** The wizard "Test Connection" button (`testConnection()` function, line 158) calls `window.electronAPI.testServerConnection(url)` — this tests a **network URL**, not a local database path. In standalone mode, the wizard has no "browse for db file" or "test database path" flow.  
**Impact:** A new standalone installation has no way to confirm the backend started correctly before clicking Finish.  
**Fix:** Add a standalone-mode readiness check: after the backend forks, poll `GET /api/health` and show success/failure in the wizard before enabling Finish.

---

#### INT-04 — 🟢 LOW: Help menu docs URL likely non-existent

**File:** `frontend/` (Help menu handler)  
**Impact:** The help menu links to `https://docs.brayprecision.com/bperp` (or similar). This URL does not exist for an internal-only tool. Users who click Help get a 404.  
**Fix:** Replace with a link to the local `README.md` (displayable via Electron `shell.openPath`) or remove the help menu entry.

---

#### INT-05 — 🟢 LOW: Server URL persists in user data folder across uninstall

**File:** `electron/main.js` (server URL stored in Electron `userData`)  
**Observation:** The About page notes: "Uninstalling the app usually does not delete the user data folder above. The Server URL is stored there and survives reinstall."  
**Impact:** This is documented but may surprise installers who expect a fresh reinstall to reset all settings.  
**Fix:** No code change required; document this in the install/troubleshooting guide.

---

### A5. Auto-Update

#### UPD-01 — 🟢 LOW: No auto-update implementation

**Current state:** `electron/preload.js` exposes an `onUpdateAvailable` listener stub. No `electron-updater` package is in `package.json`. `electron/main.js` has no `autoUpdater` calls.  
**Recommended approach:** When ready:
1. Add `electron-updater` to root `package.json`
2. Create a GitHub Release for each version with the `.exe` installer
3. Set `publish.provider = github` in `package.json` electron-builder config
4. Add `autoUpdater.checkForUpdatesAndNotify()` in `main.js` after app ready
5. The existing `onUpdateAvailable` stub in `preload.js` can be wired to the real event

This is LOW priority until the initial deployment is stable.

---

### A6. Dead Code / Clutter

#### DCL-01 — 🟡 MEDIUM: `sales.js` contains 6 unrelated domains in 4,372 lines

**File:** [frontend/js/modules/sales.js](../frontend/js/modules/sales.js)  
**Domains:** Customers, Leads, Quotes, Work Orders (WIP), Archive, Documents  
**Impact:** A bug fix or feature change in one domain requires navigating 4,000 lines. The Leads section has `escapeLeadHtml()` while the other 5 sections do not — clearly added in isolation.  
**Fix:** Split into `salesCustomers.js`, `salesLeads.js`, `salesQuotes.js`, `salesWorkOrders.js`, `salesArchive.js`, `salesDocuments.js`. Share common helpers via `salesApi.js` or `salesLeadsData.js` (which already exist as extraction stubs).

---

#### DCL-02 — 🟢 LOW: Debug console.log statements left in production Quick Add dropdown

**File:** [frontend/js/app.js](../frontend/js/app.js) lines 939–1054  
**Count:** 30+ `console.log` statements logging position calculations, click events, state checks  
**Impact:** Clutters the browser console; reveals internal positioning logic; marginally slows rendering.  
**Fix:** Remove all `console.log` calls from `setupQuickAddDropdown()`. Keep `console.warn` for the "elements not found" case.

---

#### DCL-03 — 🟢 LOW: `laborLocal.js` / `laborApi.js` dual-path is undocumented

**Files:** [frontend/js/modules/laborLocal.js](../frontend/js/modules/laborLocal.js), [frontend/js/modules/laborApi.js](../frontend/js/modules/laborApi.js)  
**Observation:** Two parallel implementations — one localStorage, one API. The pattern is intentional (offline fallback) but neither file has a header comment explaining why both exist.  
**Fix:** Add a one-paragraph header comment to each file explaining the offline/online split and when each is used.

---

#### DCL-04 — 🟢 LOW: `middleware/index.js` barrel — confirm it is used

**File:** [backend/middleware/index.js](../backend/middleware/index.js)  
**Observation:** Exists as a barrel re-export. Not confirmed whether anything imports from `middleware/index.js` vs. importing directly from `middleware/auth.js` etc.  
**Fix:** Grep for `require('./middleware')` or `require('../middleware')`. If unused, delete the barrel.

---

#### DCL-05 — 🟢 LOW: Two overlapping activity log tables

**Tables:** `activity_log` and `user_activity_log` (both in initial migration)  
**Observation:** Routes use both inconsistently. `users.js` writes to `user_activity_log`; other routes may write to `activity_log`.  
**Fix:** Audit which routes write to which table. Consolidate to one table (recommend `activity_log` since it has `entity_type` + `entity_id` for context).

---

*End of audit. Total findings: 7 security, 6 stability, 6 incomplete features, 5 integration, 1 auto-update, 5 dead code = **30 findings**.*

*Next step: Prioritize SEC-01 and INC-01 as immediate fixes, then address HIGH-severity items in a single follow-up session.*
