# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

#### Shop Branding (White-Label Support)
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
- Updated `COMMERCIALIZATION-PLAN.md` with progress tracking

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
