# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Settings → Archive** — Single place under Settings for **Archived quotes**, **Archived work**, and **Archived customers**. Sales sidebar no longer lists archived quotes/work. **Delete customer** from the active list soft-deletes (API already did); archived customers appear in Archive. **Permanent delete** (administrators only, double confirmation) via `DELETE /api/customers/:id/permanent` or offline localStorage.

### Documentation

- **Electron native modules** — README (`Native modules (Electron vs system Node)`), `backend/README.md`, and `.cursor/rules/bperp-reference.mdc` explain why `better-sqlite3` / `bcrypt` hit `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED` under Electron, when to run `npm run rebuild:backend` from the repo root, and that root `postinstall` does not replace that step for `backend/` installs.

### Changed

- **Sales — API-backed when signed in** — Customers, quotes, and work orders load and mutate via `/api/customers`, `/api/quotes`, `/api/work-orders` (Bearer token). Offline/demo login still uses localStorage demo data for those entities. Checklist step completion calls `PUT /api/work-orders/:woId/checklist/:itemId` and refreshes from the server.
- **SQLite — sales schema alignment** — Migration `20260401_000000_sales_api_schema_alignment.js` adds columns expected by sales routes (customers address fields, quotes header fields, `quote_items` extras, `work_orders` part fields, `wo_checklist` step metadata, etc.).
- **SQLite SQL** — `db.js` translates `CURRENT_DATE` and `date('now') + INTERVAL 'N days'`; list routes use `IN (...)` instead of PostgreSQL `ANY($1::text[])`. Work order stats and WIP queries use SQLite-friendly date functions.
- **Quotes / work orders** — Zod and inline validators allow **positive decimal** quantities (not only integers). `GET /quotes` supports `expand=items`; `GET /work-orders` supports `expand=checklist`. New work orders **seed default checklist** rows on create.

### Added

- **Labor — misc task timers** — **All Tasks** misc rows: **Start** / **Stop** labor tied to the task id (same shift rules as WO: one active timer; switching stops the other). SQLite table `labor_misc_task_segments`; API `POST /api/labor/misc-segment/start|stop`, `activeMiscSegments` on status, `miscSegments` on history, `currentMiscSegment` on presence. **Time Tracking** expanded days include a misc-task table; **Dashboard** “On the floor” shows misc title when no WO segment. Offline: `bperp_labor_local` stores `miscSegments` (schema v2).

- **Time Tracking — edit shop shift** — In each expanded **Shop shift — clock in / clock out** table, **Edit** opens a modal to correct times (datetime-local). **Operators** may edit their own shifts only; **Administrators** and **Machinists** may edit anyone visible on the list. **PATCH `/api/labor/shift/:id`** with a server session; **`laborLocal.updateShiftTimes`** when offline. Closing an open shift from the editor ends open WO segments on that shift at the new clock-out time; WO rows are not otherwise auto-adjusted.

- **Tasks — Shop shift bar** — A **Shop shift** bar appears above the main content on any **Tasks** route (`tasks-*`) and on **Work In Progress** (`workcenter-wip`), with the same **Clock In / Clock Out** control and hints as the sidebar time clock.

- **Time clock — shift hints** — When **on shift**, the hint shows **On shift · since …** (with time). When **not on shift**, it shows **Last clock out: …** or **Last clock in: …** (or **No shifts recorded yet**), from recent history (`getLaborShiftSummary` / `laborLocal.getLastShiftSummary`).

- **Electron — no auto clock-out on quit** — Closing the main window no longer runs labor clock-out or waits on the renderer; **open shifts stay open** so time is not ended just because the app closes (e.g. while developing). Legacy IPC `labor-clock-out-done` remains a no-op in main.

- **Dashboard — On the floor** — Card above **Quick Actions** lists users currently on shop shift, shift start time, and active WO process step (or no job timer). Uses **`GET /api/labor/presence`** with a server session, or **`laborLocal.getShopPresence()`** when offline. Refreshes on the same interval as other auto-refresh (30s). Operators see themselves only; Administrators and Machinists see everyone on shift.

- **Time Tracking — shift times** — Each day’s expanded history includes a **Shop shift — clock in / clock out** table so saved shift start/end times are explicit (open shifts show “On shift” for clock out).

- **Docs** — [`docs/FUTURE-LABOR-EXPANSION.md`](docs/FUTURE-LABOR-EXPANSION.md) outlines future **quoting** and **product design** time tracking (not implemented).

- **Labor — localStorage when no server session** — If the auth token is `offline_token_*` (demo/offline login), shifts and WO segments are stored in **`bperp_labor_local`** with the same shapes as `/api/labor/*`. **Time clock**, **Time Tracking**, and workcenter process timers use the same code paths as online mode. Included in client-side backup/restore. No automatic sync to SQLite when the user later signs in with a real session.

- **Labor / time tracking** — SQLite tables `labor_shifts` and `labor_work_order_segments`; REST `/api/labor/*` (shift clock-in/out, segment start/stop with auto shift, history, team list). Sidebar **Time clock**; **Tasks → Time Tracking** (expandable user cards, last 30 days). Workcenter **Begin Process** starts a segment before updating the checklist; **Clock Out** / **Complete Process** stop the segment; **Resume Process** after a process clock-out. **Administrator** and **Machinist** see all users on Time Tracking; **Operator** sees self only. With a real JWT, labor persists to SQLite; 401 messages clarify invalid session.

- **Tasks — Machining + Machines** — Starting **Machining** (Begin) opens a prompt to choose the **machine profile** (or enter a name if none exist). That choice is stored on the step and drives **Machines** → each profile’s expanded view: **Current jobs (machining)** lists work orders with that step in progress on that machine (above **Maintenance**).

- **Tasks — Rollback step** — **Rollback step** (light purple) appears above **Issue** on each workflow workcenter card and on **Ordering** (next to cert / New Task). It clears **Begin** / in-progress on the current step when set, otherwise un-completes the latest completed checklist step for that part (or the resolved line on multi-part WOs).

- **Tasks — Work order follow-up** — On each workcenter card (workflow tabs and **Ordering**), **New Task** opens a modal with work order context; the task is stored with the work order and part/step reference and appears on **All Tasks** with that reference under the title.

- **Inventory — Kanban** — Sidebar entry **Kanban** (above Products) lists all inventory categories combined, showing only **Low Stock** and **Critical** items (same status rules as other inventory views). Includes a **Type** column, edit/delete routed to the correct store, search/sort filters, and client-side **Export**.

- **Inventory — Reorder link** — Optional **Reorder link** (URL) on add/edit for all inventory types; table column between **Supplier** and **Unit Price** opens the link in a new tab (http/https only). Included in Kanban CSV export and in search matching.

- **Inventory — Add Product** — **Add Product** opens the same modal as edit, including **Bill of Materials** (add/remove parts, qty per assembly), not the generic add form.

- **Inventory — Min reorder qty** — **Min reorder qty** on add/edit for all types (stored per item). Shown only on the **Kanban** table (after **Reorder Pt**). Kanban **Unit Price** column is **Reorder Cost** = unit price × min reorder qty; other inventory tabs still show **Unit Price** only.

- **Tasks (UI)** — Inventory-style search, status filter, sort direction (Asc/Desc), and **Clear** on **All Tasks**, workflow step tabs, **Ordering**, and **Completed Work** (urgency filter on Completed). Removed the All Tasks banner that said tasks were derived from WIP checklists. **Misc tasks** can be **recurring** (weekly weekday, or monthly Nth weekday); completing one advances **next due** and keeps the task open. *(Tasks tab still uses localStorage + WIP data; it does not call `/api/tasks`.)*
- **Machines** — Sidebar label **Machines** (route still `tasks-maintenance`). **WIP-style** expandable cards: chevron header toggles **Maintenance** and **Upgrades**; left border color = maintenance urgency (green / yellow / red). **Maintenance:** add modal (replaces placeholder), **Complete**, **Edit**, **Remove** (delete confirm). **Upgrades:** add / edit / complete / delete. Data: localStorage `bperp_machines`. Demo **upgrade** sample on CNC Mill 1. Card header **Edit** / History / Delete fixed (toggle target only on title row; `data-machine-id`).

- **Window title** — Main window title appends `· v<version> · Standalone` or `· … · Network · UI from server` after the renderer `document.title` (shop branding) using `page-title-updated` + `preventDefault`, so branding is not overwritten and version/mode stay visible when an outdated remote `frontend/` hides newer Settings items.

- **Desktop diagnostics** — IPC `get-app-info` and Settings → **About this app** (Electron only): app version, packaged vs dev, Standalone vs Network, server URL when set, runtime versions, and user data path (survives uninstall). System tray includes **About BPERP**; Help → About uses the same dialog (mode + user data path). README and `docs/NAS-SETUP.md` document why reinstall can still show an old UI and when to bump `package.json` `version` per installer build.

- **Beta launcher (Windows)** — `scripts/launch-beta.ps1` (and `launch-beta.cmd` with `-ExecutionPolicy Bypass`) runs `pack:win` (or `build:win` with `-FullInstaller`) and starts `dist-installers\win-unpacked\BPERP.exe`; `-Dev` runs Electron from the repo without packaging. New npm script `pack:win` (unpacked Windows build, faster than NSIS). `npm run dev` now uses `cross-env` so `NODE_ENV=development` works on Windows.

- **Server Connection (desktop)** — When a server URL is set, Settings → Server Connection explains that the UI (sidebar, pages, scripts) is loaded from that server; if Inventory items such as Products or Parts are missing, deploy the latest `frontend` folder on the server. Standalone mode shows a short note that the bundled local UI is used.

- **Standalone mode** — Setup wizard now offers a choice between Standalone (Local) and Network (NAS) modes. Standalone runs the backend and SQLite database entirely on the local machine, with no NAS or network dependency. Network mode preserves the existing NAS deployment workflow.
- **`scripts/rebuild-backend-native.js`** — Invoked by `npm run rebuild:backend`; removes stale `better-sqlite3` / `bcrypt` native build artifacts, then runs `electron-rebuild --build-from-source` for the installed Electron version.
- **Local development workflow** — `cd backend && npm run dev` starts the full app at `http://localhost:3000` with zero configuration. A `backend/.env` with sensible defaults is provided (gitignored).

### Changed

- **Tasks (workcenter buttons)** — **Rollback step** uses **light purple**; **New Task** uses **orange** (including the WO-linked task modal title icon).

- **Tasks — Workcenter cards** — Per-part **Part Progress** percentage bar is removed from individual workcenter workflow tabs (Programming, Processing, Machining, etc.). The **Current** line now shows whether that operation is **Started** or **not started** (e.g. “Programming Started”). **Work In Progress** still shows overall order progress.

- **Dashboard** — Removed the top summary metric cards; **Quick Actions** is now directly under the page title. The former **Inventory** quick action is **Kanban** and navigates to the Inventory Kanban view (`inventory-kanban`).

- **Inventory (UI)** — Status is derived from reorder point and quantity: **No Kanban** when reorder point is zero; **Good** when stock is above reorder; **Low Stock** when at or below reorder (with stock); **Critical** when stock is zero and reorder is set. Removed ratio-based **Monitor** status.

- **README** — New **Inventory (browser UI)** subsection: Inventory tab uses **localStorage** (not the REST inventory API yet); summarizes Kanban, reorder link, min reorder qty / reorder cost on Kanban, and BOM on product add/edit.

- **Machines page** — Removed the four top summary cards (scheduled today, overdue, completed this week, upcoming this week); urgency is shown only on each card’s left border and in row copy.

- **Desktop packaging trim** — Installers no longer embed `frontend/` inside `app.asar` (Express already serves UI from `resources/frontend`). `build:win`, `build:linux`, and `pack:win` use new script **`npm run backend:install:prod`** (`npm install --omit=dev` + `npm prune --omit=dev` in `backend/`) so test/tooling deps are not shipped in `resources/backend`. Linux artifacts are **AppImage + deb** only (rpm target removed). README and `scripts/launch-beta.ps1` updated; run `npm run backend:install` after a packaging build if you need backend dev/test deps locally again.

- **Cursor rules** — Replaced monolithic `context files/.cursorrules.md` with focused `.mdc` rules under `.cursor/rules/` (`bperp-project-overview`, `bperp-reference`, `bperp-architecture`, `bperp-backend`, `bperp-frontend`, `bperp-electron`, `bperp-database-schema`, `bperp-domain-quality`); the old file was removed after the split. `documentation-updates.mdc` references `bperp-database-schema.mdc` for schema edits.
- **Documentation** — README (architecture, TODO, Common Commands, end-to-end testing), `backend/README.md` (Electron + migrations), `docs/NAS-SETUP.md` (local dev vs NAS), and `context files/INTERNAL-ROADMAP.md` updated for Standalone/Network modes, native rebuild, and Electron migration spawning.
- **NAS setup docs** — Clarified that both `backend/` and `frontend/` must be deployed side-by-side; outdated `frontend/` on the server explains missing UI such as Products/Parts under Inventory when using remote Server URL.

### Fixed

- **Tasks — Ordering** — Multi-part work orders used OR when aggregating “material/tooling ordered/received,” so if **any** line had received, **Receive Material / Receive All** were disabled for the whole job while other lines still needed receiving; aggregation now uses **every line item** (`every()`). Checklist updates also resolve steps by **`stepKey`** when `id` does not match (e.g. after import), and line item id **0** is handled when updating steps.

- **Inventory (UI)** — Filter/sort results were cached by item count and filters only, so switching tabs (e.g. Kanban vs Products) could show the wrong list when counts matched. Cache key now includes the active inventory view.

- **Tasks (All Tasks)** — `workflow-start` on the combined task table now runs the same handler as `workflow-begin` (was registered only for workflow tab cards). Export uses an imported `exportToCSV` client path. Multi-part work orders pass `data-item-id` so Start/Complete/Issue target the correct line item (`getNextWorkflowStepWithLineItem` in `sales.js`).

- **Migrations under Electron** — `server.js` no longer runs `spawnSync('node', ...)` for migrations (system Node could load a different ABI than the Electron-forked server). Migrations now use `process.execPath` with `ELECTRON_RUN_AS_NODE=1` when `process.versions.electron` is set, matching the embedded Node used for `initDb` and the API.
- **Electron native rebuild** — `npm run rebuild:backend` now runs [`scripts/rebuild-backend-native.js`](scripts/rebuild-backend-native.js): clears `better-sqlite3` / `bcrypt` `build` and `prebuilds` folders, then `electron-rebuild --build-from-source` against the installed Electron version. Fixes cases where `electron-rebuild` completed but Electron still loaded a system-Node `better_sqlite3.node` (NODE_MODULE_VERSION mismatch).
- **Routing** — `inventory-products` and `inventory-parts` are included in permission category mapping and page titles (was inconsistent with other inventory routes).

- **Machines** — Navigating to **Machines** (`tasks-maintenance`) now deactivates the Tasks module auto-refresh. Previously, after visiting a Tasks workcenter, the periodic Tasks refresh could repaint the main area with the old workcenter while the sidebar still showed **Machines**.

### Added

#### Products and Parts Inventory
- **Products tab** — Finished assemblies for sale; full CRUD with inventory tracking
- **Parts tab** — Individual components with purchased/manufactured source; full CRUD
- **Product BOM** — Bill of Materials links parts to products (qty per assembly); BOM editor in product edit modal
- **Schema for future** — `parts.source`, `part_materials` table for Kanban and manufactured-parts BOM explosion
- **Backend** — CRUD API, BOM routes, validation, export, import for products and parts
- **Cache fix** — Cache-Control no-cache for index.html; Electron loadURL cache-bust to prevent stale UI

#### Priority 1 — Windows Installer Build
- **@electron/rebuild integration** — `npm run build:win` and `npm run build:linux` now run `electron-rebuild -f -w better-sqlite3,bcrypt -m backend -v 28.3.3` before packaging, so native modules are built for Electron 28's Node runtime (fixes NODE_MODULE_VERSION 137 vs 119 mismatch)
- **Deployment docs** — README updated with build commands and end-to-end testing checklist

### Changed
- **Project direction** — BPERP is internal-only for Bray Precision LLC.
  - Windows & Linux only (macOS dropped)
  - All workstations share a single network PostgreSQL database
  - User profiles load from the database — no manual setup on new devices
  - Auto-refresh so workcenter displays always show current data
  - Clean, simple installer for easy multi-device deployment
  - Focus is on stability, deployment, and fixing remaining gaps (backup, search)

### Fixed

#### Windows Launcher (`launch-bperp-gui.ps1`)
- **Backend server now starts correctly** - Launcher previously started only a static file
  server (`npx serve`) on port 8080, leaving the Node.js/Express backend never running and
  all API calls failing. Now starts `node server.js` from the backend directory on port 3000,
  which serves both the API and the frontend statically via `express.static`.
- Browser now opens to `http://localhost:3000/loading.html` (was port 8080).

#### Electron — Windows Compatibility
- **Process termination** (`electron/main.js`) — `SIGTERM`/`SIGKILL` signals are silently
  ignored on Windows child processes, causing orphaned backend processes after the app closed.
  Replaced with `taskkill /pid <PID> /T /F` on win32; Unix platforms retain existing behavior.
- **Setup wizard** (`electron/setup-wizard/`) — Wizard defaulted to "Embedded PostgreSQL" on
  Windows, which is unimplemented. On win32 the embedded option is now hidden, external
  PostgreSQL is selected by default with port 5432 pre-filled, and a notice with a direct
  download link to postgresql.org is shown.

### Added

#### Electron Desktop Application (Phase 4 Complete)
- **Linux AppImage** - Fully functional 122MB portable installer
  - Self-contained with all backend dependencies
  - No installation required - just download and run
- **Linux .deb Package** - 81MB installer for Ubuntu/Debian/Zorin
  - Auto-installs PostgreSQL as dependency
  - Double-click install via Software Center
  - Creates app menu entry automatically
- **First-run setup wizard** - 4-step wizard for initial configuration
  - Welcome screen with feature overview
  - Database configuration (external PostgreSQL)
  - Admin user creation with password strength indicator
  - Configuration summary and launch
- **Backend lifecycle management** - Electron manages backend via fork()
  - Uses Electron's bundled Node.js (no system Node required)
  - Automatic startup and shutdown
  - Clean process termination on window close
  - Log capture to file
- **Clean UI** - Hidden menu bar for theme-consistent appearance
  - Access menu with Alt key if needed
- **Splash screen** - Animated loading screen during startup
- **Window state persistence** - Size and position saved across sessions
- **Single instance lock** - Prevents multiple instances
- **Production-ready paths** - Export directories use ~/.bperp-data

**Files Created:**
- `electron/main.js` - Main process (720+ lines)
- `electron/preload.js` - Secure IPC bridge
- `electron/splash.html` - Loading screen
- `electron/setup-wizard/` - Setup wizard (HTML, CSS, JS)
- `LICENSE.txt` - Proprietary license for distribution

**Backend Improvements:**
- `POST /api/setup/init` - Create initial admin user (first-run only)
- `GET /api/setup/status` - Check if setup is needed
- Dynamic export directory based on environment

#### Users & Permissions System
- **User roles** - Three user levels: Administrator, Machinist, Operator
- **Tab-level permissions** - Control access to Dashboard, Workcenter, Inventory, Sales, Tasks, Settings
- **Per-user appearance settings** - Theme preferences saved to user profile
- **User management UI** (`frontend/js/modules/users.js`)
  - Login modal with demo user support
  - User CRUD for administrators
  - Permission editing per user
  - Role-based default permissions
- **Backend user API** (`backend/routes/users.js`)
  - `POST /api/users/login` - Authenticate user
  - `POST /api/users/logout` - End session
  - `GET /api/users/me` - Get current user
  - `GET /api/users` - List all users (admin only)
  - `PUT /api/users/:id/permissions` - Update user tab permissions
  - `PUT /api/users/:id/appearance` - Save appearance settings to profile
- **Database schema** (`database/users_schema.sql`)
  - Enhanced users table with `appearance_settings` and `tab_permissions` (JSONB)
  - `user_sessions` table for token management
  - `role_defaults` table for default permissions per role
  - `user_activity_log` table for audit trail

#### Shop Branding
- **Customizable shop identity** via Settings > Shop Branding
  - Shop name (displayed in sidebar and browser tab)
  - Tagline (short description)
  - Logo upload (base64 storage, supports PNG/JPG up to 2MB)
- **Live preview** before saving changes
- **Admin-only access** - Only administrators can modify branding
- **Click-to-edit** - Click logo area in sidebar to access settings
- **Branding included in backups** - Preserved during backup/restore

#### Backup & Restore Improvements
- **Offline backup support** - Creates client-side backup when server unavailable
- **User profiles in backups** - Includes users, roles, and permissions
- **Shop branding in backups** - Logo and shop settings preserved
- **Theme preferences in backups** - User appearance settings preserved
- **Full restore functionality** - Restores all localStorage data with confirmation

#### Security (Phase 1)
- **bcrypt password hashing** - Replaced SHA-256 with bcrypt for secure password storage
- **Centralized authentication middleware** (`backend/middleware/auth.js`)
  - `requireAuth` - Require authenticated user
  - `requireAdmin` - Require administrator role
  - `requireRole` - Require specific role(s)
  - `requireSelfOrAdmin` - User can modify own profile, or admin can modify any
  - `optionalAuth` - Set user if token valid, continue regardless
- **Rate limiting** (`backend/middleware/rateLimit.js`)
  - Login limiter: 5 attempts per 15 minutes
  - API limiter: 100 requests per minute
  - Import limiter: 20 imports per hour
  - Export limiter: 10 exports per hour
- **Input validation with Zod** (`backend/middleware/validation.js`)
  - Schemas for all user inputs (login, users, customers, materials, etc.)
  - `validateBody`, `validateParams`, `validateQuery` middleware

#### Architecture (Phase 2)
- **Database migration system** (`backend/migrations/`)
  - Custom CLI tool (`migrate.js`) with up/down/status/create commands
  - Migration tracking in `schema_migrations` table
  - Initial migration consolidates all schema files
- **PostgreSQL migration for in-memory routes**
  - Tasks route now uses PostgreSQL
  - Workcenters route now uses PostgreSQL
  - Machines route now uses PostgreSQL
  - Maintenance route now uses PostgreSQL
  - Orders route (POs, receiving, shipping, inspection) now uses PostgreSQL
- **TypeScript foundation** (`backend/src/`)
  - Type definitions for all entities (`src/types/index.ts`)
  - Database row types (`src/types/database.ts`)
  - Typed middleware (`src/middleware/*.ts`)
  - Example typed route (`src/routes/tasks.ts`)
  - Build scripts: `npm run build`, `npm run typecheck`

#### Data Import (Phase 3)
- **CSV/Excel import system** (`backend/routes/import.js`)
  - File upload with multer
  - CSV parsing with papaparse
  - Excel parsing with xlsx (SheetJS)
  - Smart column mapping with aliases
  - Preview with validation before import
  - Template generation for each entity type
- **Supported import entities**:
  - Customers
  - Contacts
  - Materials
  - Tooling
  - Workcenters
  - Machines

#### Testing (Phase 3)
- **Jest test framework** (`backend/jest.config.js`)
- **Test helpers** (`backend/tests/helpers/testDb.js`)
  - Database pool management
  - Table clearing
  - Fixture creation
  - Test user/session creation
- **Initial test suites**
  - Validation middleware tests
  - Import API integration tests

#### Documentation
- Updated `README.md` with setup instructions
- Created `backend/README.md` with API documentation
- Created `.env.example` with all configuration options
- Updated project documentation

### Changed
- Enhanced CORS configuration in `server.js`
- Removed demo mode password bypass from user authentication
- Consolidated database schema into single migration file

### Security
- Removed hardcoded demo credentials
- Added protection against brute force login attacks
- Added input validation on all API endpoints

## [0.1.0] - 2026-01-27

### Added
- Initial prototype with core ERP features
- Inventory management (materials, tooling, misc)
- Customer management
- Quote management
- Work order management
- Task management
- User management with roles
- Workcenter and machine tracking
- Maintenance scheduling
