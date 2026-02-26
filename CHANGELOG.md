# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
