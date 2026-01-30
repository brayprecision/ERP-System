# ERP Commercialization Plan (On-Premise Edition)

> **Last Updated**: January 30, 2026  
> **Status**: Phase 4 Complete

## Business Model Summary

- **Deployment**: On-premise (customer installs on their own hardware)
- **Target Market**: Sole proprietors to 20-person machine shops
- **Pricing**: One-time license purchase + optional yearly maintenance/updates
- **Key Feature**: CSV/spreadsheet import for existing business data
- **Tech Decisions**: Keep vanilla JS, add TypeScript, native installers

---

## Current State Assessment

The ERP system is a **functional prototype** built with:

- **Backend**: Express.js 4.18.2 + PostgreSQL (40+ tables)
- **Frontend**: Vanilla ES6 modules + Tailwind CSS (SPA)
- **Features**: Inventory, Sales (customers/quotes/work orders), Tasks, Maintenance, User management with role-based permissions, Shop branding (white-label support)

**Code Quality Score**: ~7/10 for production readiness (improved from 5-6/10)

---

## Phase 1: Critical Security Fixes ✅ COMPLETED

### 1. Authentication Hardening ✅

- [x] ~~Replace SHA-256 password hashing with **bcrypt**~~ → `backend/routes/users.js`
- [x] ~~Create centralized auth middleware~~ → `backend/middleware/auth.js`
- [x] ~~Add rate limiting on login endpoints~~ → `backend/middleware/rateLimit.js`
- [x] ~~Remove demo mode password bypass~~ → Removed from `users.js`
- [ ] Implement refresh tokens with proper rotation (deferred - not critical for v1)

### 2. Input Validation & Sanitization ✅

- [x] ~~Add validation library~~ → **Zod** (`backend/middleware/validation.js`)
- [x] ~~Validate at server layer~~ → Schemas for login, users, customers, materials, quotes, work orders, tasks
- [ ] Sanitize all HTML string generation in frontend (ongoing)

### 3. CORS & Session Security ✅

- [x] ~~Configure CORS to allow specific origins~~ → Enhanced in `server.js`
- [ ] Add CSRF protection (deferred - lower priority for on-premise)
- [ ] Implement secure cookie flags (deferred)

**Files Created/Modified:**
- `backend/middleware/auth.js` - Centralized authentication
- `backend/middleware/rateLimit.js` - Rate limiters (login, API, export, import)
- `backend/middleware/validation.js` - Zod schemas and validation middleware
- `backend/middleware/index.js` - Central exports
- `backend/routes/users.js` - bcrypt integration, auth middleware

---

## Phase 2: Architecture Improvements ✅ COMPLETED

### 4. Database Consistency ✅

All in-memory routes migrated to PostgreSQL:

- [x] ~~`tasks`~~ → `backend/routes/tasks.js` (full PostgreSQL)
- [x] ~~`workcenters`~~ → `backend/routes/workcenters.js` (full PostgreSQL)
- [x] ~~`machines`~~ → `backend/routes/machines.js` (full PostgreSQL)
- [x] ~~`maintenance`~~ → `backend/routes/maintenance.js` (full PostgreSQL)
- [x] ~~`orders`~~ → `backend/routes/orders.js` (POs, receiving, shipping, inspection)

### 5. Service Layer Architecture (Partial)

- [x] ~~Create shared middleware directory~~ → `backend/middleware/`
- [ ] Extract business logic into service classes (deferred - routes work well)
- [ ] Implement dependency injection pattern (deferred)

### 6. Database Migrations ✅

- [x] ~~Implement migration tool~~ → Custom `backend/migrations/migrate.js`
- [x] ~~Fix schema conflicts~~ → Consolidated in initial migration
- [x] ~~Add version tracking~~ → `schema_migrations` table
- [x] ~~Create rollback scripts~~ → `migrate.js down` command

**Migration Commands:**
```bash
npm run migrate          # Run pending migrations
npm run migrate:down     # Rollback last migration
npm run migrate:status   # Show migration status
npm run migrate:create   # Create new migration
```

**Files Created:**
- `backend/migrations/migrate.js` - CLI migration tool
- `backend/migrations/scripts/20260128_000000_initial_schema.js` - Initial schema

### 7. API Versioning

- [ ] Add `/api/v1/` prefix (deferred - breaking change, do before v1.0 release)

### 8. TypeScript Migration ✅ IN PROGRESS

**Backend (`backend/src/`):**

- [x] ~~Add TypeScript and type definitions~~ → `typescript`, `ts-node`, `@types/*`
- [x] ~~Create `tsconfig.json`~~ → Strict mode enabled
- [x] ~~Create shared type definitions~~ → `src/types/index.ts` (500+ lines)
- [x] ~~Convert middleware to TypeScript~~ → `src/middleware/*.ts`
- [x] ~~Convert one route as example~~ → `src/routes/tasks.ts`
- [ ] Convert remaining routes (can be done incrementally)

**TypeScript Structure:**
```
backend/src/
├── types/
│   ├── index.ts       # All entity types (User, Task, Customer, etc.)
│   └── database.ts    # DB row types, transform utilities
├── middleware/
│   ├── auth.ts        # Authentication middleware
│   ├── validation.ts  # Zod schemas with type inference
│   ├── rateLimit.ts   # Rate limiters
│   └── index.ts       # Exports
└── routes/
    ├── tasks.ts       # Example fully-typed route
    └── index.ts       # Exports
```

**Build Commands:**
```bash
npm run build         # Compile TypeScript to dist/
npm run build:watch   # Watch mode
npm run typecheck     # Type check without emit
```

**Frontend TypeScript:**
- [ ] Add TypeScript compilation step
- [ ] Convert modules incrementally

---

## TypeScript Migration Schedule

### Migration Strategy

The migration follows an **incremental approach** - existing JavaScript continues to work while TypeScript files are added alongside. The `allowJs: true` setting in tsconfig enables this hybrid mode.

### Backend Migration Status

#### Phase A: Foundation ✅ COMPLETED

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| TypeScript setup | ✅ Done | `tsconfig.json` | Strict mode, ES2020 target |
| Type definitions | ✅ Done | `src/types/index.ts` | 500+ lines, all entities |
| Database types | ✅ Done | `src/types/database.ts` | Row types, transformers |

#### Phase B: Middleware ✅ COMPLETED

| Component | Status | JS File | TS File | Notes |
|-----------|--------|---------|---------|-------|
| Auth middleware | ✅ Done | `middleware/auth.js` | `src/middleware/auth.ts` | Full typing |
| Validation | ✅ Done | `middleware/validation.js` | `src/middleware/validation.ts` | Zod + inferred types |
| Rate limiting | ✅ Done | `middleware/rateLimit.js` | `src/middleware/rateLimit.ts` | All limiters typed |
| Index exports | ✅ Done | `middleware/index.js` | `src/middleware/index.ts` | Central exports |

#### Phase C: Routes - In Progress

| Route | Status | JS File | TS File | Priority | Complexity |
|-------|--------|---------|---------|----------|------------|
| tasks | ✅ Done | `routes/tasks.js` | `src/routes/tasks.ts` | Example | High |
| users | 🔲 Pending | `routes/users.js` | - | High | High |
| customers | 🔲 Pending | `routes/customers.js` | - | High | Medium |
| inventory | 🔲 Pending | `routes/inventory.js` | - | High | Medium |
| quotes | 🔲 Pending | `routes/quotes.js` | - | Medium | Medium |
| workorders | 🔲 Pending | `routes/workorders.js` | - | Medium | Medium |
| workcenters | 🔲 Pending | `routes/workcenters.js` | - | Medium | Medium |
| machines | 🔲 Pending | `routes/machines.js` | - | Medium | Medium |
| maintenance | 🔲 Pending | `routes/maintenance.js` | - | Low | High |
| orders | 🔲 Pending | `routes/orders.js` | - | Low | High |
| import | 🔲 Pending | `routes/import.js` | - | Low | Medium |

**Recommended Order:** users → customers → inventory → quotes → workorders → workcenters → machines → maintenance → orders → import

#### Phase D: Server & Config - Not Started

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| Main server | 🔲 Pending | `server.js` → `server.ts` | Last to convert |
| Jest config | 🔲 Pending | `jest.config.js` → `jest.config.ts` | Optional |
| Migration tool | 🔲 Pending | `migrations/migrate.js` | Optional |

### Frontend Migration Status

#### Phase E: Frontend Foundation - Not Started

| Component | Status | Notes |
|-----------|--------|-------|
| Vite setup | 🔲 Pending | Add build system first |
| Type definitions | 🔲 Pending | Define state shapes |
| tsconfig (frontend) | 🔲 Pending | Browser-focused config |

#### Phase F: Frontend Modules - Not Started

| Module | Status | File | Complexity |
|--------|--------|------|------------|
| storage | 🔲 Pending | `js/modules/storage.js` | Low (start here) |
| common | 🔲 Pending | `js/modules/common.js` | Medium |
| app | 🔲 Pending | `js/app.js` | High |
| sales | 🔲 Pending | `js/modules/sales.js` | Very High (2000+ lines) |
| tasks | 🔲 Pending | `js/modules/tasks.js` | High (1800+ lines) |
| inventory | 🔲 Pending | `js/modules/inventory.js` | Medium |
| maintenance | 🔲 Pending | `js/modules/maintenance.js` | Medium |
| users | 🔲 Pending | `js/modules/users.js` | Medium |
| search | 🔲 Pending | `js/modules/search.js` | Low |

**Recommended Order:** storage → common → search → users → inventory → maintenance → tasks → sales → app

### Migration Progress Summary

| Category | Total | Completed | Remaining | % Done |
|----------|-------|-----------|-----------|--------|
| **Backend Types** | 2 | 2 | 0 | 100% |
| **Backend Middleware** | 4 | 4 | 0 | 100% |
| **Backend Routes** | 11 | 1 | 10 | 9% |
| **Backend Config** | 3 | 0 | 3 | 0% |
| **Frontend Setup** | 3 | 0 | 3 | 0% |
| **Frontend Modules** | 9 | 0 | 9 | 0% |
| **Overall** | 32 | 7 | 25 | **22%** |

### Type Definitions Created

The following types are defined in `src/types/index.ts`:

**User & Auth:**
- `User`, `UserRole`, `AppearanceSettings`, `TabPermissions`
- `UserSession`, `LoginCredentials`, `CreateUserInput`
- `AuthenticatedRequest`, `AuthMiddleware`

**Business Entities:**
- `Customer`, `Contact`, `CreateCustomerInput`
- `Material`, `Tooling`, `MiscItem`, `CreateMaterialInput`
- `Quote`, `QuoteItem`, `QuoteStatus`
- `WorkOrder`, `WOChecklistItem`, `WorkOrderStatus`

**Operations:**
- `Task`, `TaskHistory`, `TaskType`, `TaskStatus`, `TaskPriority`
- `Workcenter`, `WorkcenterQueueItem`, `WorkcenterType`, `QueueStatus`
- `Machine`, `MachineType`, `MachineStatus`, `MaintenanceStatus`
- `MaintenanceTask`, `MaintenanceTaskDefinition`, `MaintenanceCategory`

**Orders & Shipping:**
- `PurchaseOrder`, `POItem`, `POStatus`, `POItemType`
- `InspectionTask`, `InspectionType`, `InspectionStatus`
- `ShippingTask`, `ShippingStatus`, `ShippingItem`
- `ReceivingTask`, `ReceivingStatus`, `ExpectedItem`, `ReceivedItem`

**API:**
- `ApiResponse<T>`, `PaginatedResponse<T>`, `StatsResponse<T>`
- `ImportPreviewResult`, `ImportResult`, `ImportError`, `ImportEntityType`

### Converting a Route: Step-by-Step

To convert a JavaScript route to TypeScript:

1. **Create the file**: `src/routes/{name}.ts`

2. **Add imports**:
```typescript
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { EntityType, ApiResponse } from '../types';
```

3. **Define row types** (database format):
```typescript
interface EntityRow {
    id: number;
    field_name: string;  // snake_case from DB
    // ...
}
```

4. **Define input/output types**:
```typescript
interface CreateEntityInput {
    fieldName: string;  // camelCase for API
}
```

5. **Type the route factory**:
```typescript
export default function createRouter(pool: Pool): Router {
    const router = Router();
    // ...
    return router;
}
```

6. **Type each handler**:
```typescript
router.get('/:id', async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse<Entity>>
) => { ... });
```

7. **Run type check**: `npm run typecheck`

8. **Build**: `npm run build`

---

## Phase 3: Data Import Feature ✅ COMPLETED

### CSV/Spreadsheet Import System ✅

- [x] ~~CSV parsing~~ → `papaparse`
- [x] ~~Excel support~~ → `xlsx` (SheetJS)
- [x] ~~File upload handling~~ → `multer`
- [x] ~~Column mapping with aliases~~ → Smart header matching
- [x] ~~Validation with detailed errors~~ → Row-level error reporting
- [x] ~~Preview before import~~ → `/api/import/preview` endpoint
- [x] ~~Template generation~~ → `/api/import/template/:entityType`

**Supported Entity Types:**
- `customers` - Company name, address, phone, terms, notes
- `contacts` - Name, email, phone, role, customer link
- `materials` - Part number, description, quantity, location, supplier
- `tooling` - Tool ID, description, condition, location
- `workcenters` - Name, type, description, capacity
- `machines` - Name, type, manufacturer, model, serial number

**API Endpoints:**
```
POST   /api/import/preview              # Preview with validation
POST   /api/import/customers            # Import customers
POST   /api/import/materials            # Import materials
POST   /api/import/tooling              # Import tooling
POST   /api/import/workcenters          # Import workcenters
POST   /api/import/machines             # Import machines
GET    /api/import/template/:entityType # Download CSV template
GET    /api/import/supported-types      # List supported types
```

**Files Created:**
- `backend/routes/import.js` - Full import system

### Testing Infrastructure ✅ PARTIAL

- [x] ~~Test framework~~ → Jest configured
- [x] ~~API integration tests~~ → Supertest setup
- [x] ~~Test helpers~~ → `backend/tests/helpers/testDb.js`
- [x] ~~Unit tests for validation~~ → `backend/tests/middleware/validation.test.js`
- [x] ~~Integration tests for import~~ → `backend/tests/routes/import.test.js`
- [ ] E2E tests with Playwright
- [ ] Increase test coverage

**Test Commands:**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests only
```

**Files Created:**
- `backend/jest.config.js` - Jest configuration
- `backend/tests/setup.js` - Test environment setup
- `backend/tests/helpers/testDb.js` - Database test helpers
- `backend/tests/middleware/validation.test.js` - Validation tests
- `backend/tests/routes/import.test.js` - Import API tests

---

## Phase 3.5: User Experience & Customization ✅ COMPLETED

### Users & Permissions System ✅

- [x] ~~Role-based access control~~ → Administrator, Machinist, Operator
- [x] ~~Tab-level permissions~~ → Per-user access to Dashboard, Workcenter, Inventory, Sales, Tasks, Settings
- [x] ~~User appearance settings~~ → Theme preferences saved to user profile
- [x] ~~User management UI~~ → `frontend/js/modules/users.js`
- [x] ~~Login/logout flow~~ → Session-based auth with demo mode support
- [x] ~~Permission checking~~ → Sidebar hides inaccessible sections

**Database Tables:**
- `users` - Enhanced with `appearance_settings`, `tab_permissions` (JSONB)
- `user_sessions` - Token management with expiration
- `role_defaults` - Default permissions per role
- `user_activity_log` - Audit trail for user actions

### Shop Branding (White-Label Support) ✅

- [x] ~~Customizable shop name~~ → Displayed in sidebar and browser tab
- [x] ~~Custom logo upload~~ → Base64 storage, supports PNG/JPG up to 2MB
- [x] ~~Tagline customization~~ → Short description below shop name
- [x] ~~Live preview~~ → See changes before saving
- [x] ~~Admin-only access~~ → Only administrators can modify branding
- [x] ~~Backup integration~~ → Branding preserved in backups

**Files Created/Modified:**
- `frontend/js/modules/users.js` - Full user management module
- `frontend/js/app.js` - ShopBranding manager, permission checking
- `database/users_schema.sql` - Enhanced user tables
- `backend/routes/users.js` - User API endpoints

### Backup & Restore Enhancements ✅

- [x] ~~Offline backup support~~ → Creates client-side backup when server unavailable
- [x] ~~User profiles in backups~~ → Includes users, roles, permissions
- [x] ~~Shop branding in backups~~ → Logo and settings preserved
- [x] ~~Full restore functionality~~ → Restores localStorage with confirmation

---

## Phase 4: Native Installers & Packaging ✅ COMPLETE

### Desktop Application with Electron ✅ MOSTLY COMPLETE

- [x] ~~Electron wrapper~~ → `electron/main.js` (fully functional)
- [x] ~~Bundled backend~~ → Backend spawned as child process with lifecycle management
- [x] ~~Splash screen~~ → `electron/splash.html` with animated loading
- [x] ~~System tray integration~~ → Minimize to tray, tray menu
- [x] ~~App menu~~ → File, Edit, View, Help menus
- [x] ~~Window state persistence~~ → Size/position saved across sessions
- [x] ~~Single instance lock~~ → Prevents multiple instances
- [ ] PostgreSQL installer integration (deferred - requires external PostgreSQL)
- [ ] Auto-updater for maintenance subscribers

**Files Created:**
- `electron/main.js` - Main process (700+ lines)
- `electron/preload.js` - Secure IPC bridge
- `electron/splash.html` - Loading screen

### Platform Installers ✅ CONFIGURED

Electron-builder configuration complete in `package.json`:

- [x] ~~Windows `.exe` installer~~ → NSIS installer configured
- [x] ~~macOS `.dmg`~~ → DMG configured (needs icon.icns)
- [x] ~~Linux `.deb` and `.rpm`~~ → All three formats configured
- [x] ~~AppImage~~ → Configured with LICENSE.txt

**Build Commands:**
```bash
npm run build:win     # Windows installer
npm run build:mac     # macOS DMG
npm run build:linux   # Linux packages (AppImage, deb, rpm)
npm run build:all     # All platforms
```

**Assets Created:**
- `electron/assets/icon.ico` - Windows icon
- `electron/assets/icon.png` - Source PNG for icon generation
- `electron/assets/generate-icons.sh` - Script to generate platform icons
- `LICENSE.txt` - Proprietary license for installers

### First-Run Setup Wizard ✅ COMPLETE

- [x] ~~Database configuration~~ → External PostgreSQL, embedded (placeholder), SQLite (placeholder)
- [x] ~~Admin user creation~~ → Full form with password strength indicator
- [x] ~~Connection testing~~ → Test database connection before proceeding
- [x] ~~Database migrations~~ → Run migrations during setup
- [ ] License activation (Phase 6)
- [ ] Data import option (can be done post-setup)

**Files Created:**
- `electron/setup-wizard/wizard.html` - 4-step wizard UI
- `electron/setup-wizard/wizard.js` - Wizard logic
- `electron/setup-wizard/wizard.css` - Wizard styling

**Backend Endpoints Added:**
- `POST /api/setup/init` - Create initial admin user (first-run only)
- `GET /api/setup/status` - Check if setup is needed

### Logging ✅ COMPLETE

- [x] ~~File-based logging~~ → Logs to `bperp.log` in user data folder
- [x] ~~Timestamp and level~~ → `[timestamp] [LEVEL] message`
- [x] ~~Backend output capture~~ → Backend stdout/stderr logged
- [x] ~~View logs from Help menu~~ → Opens logs folder
- [x] ~~Get logs via IPC~~ → `getLogs()` returns last 100 lines
- [ ] Log rotation (manual cleanup for now)

### Build Results ✅

**Linux AppImage** - Successfully built and fully tested:
- File: `dist-installers/BPERP-1.0.0-beta.1-linux-x86_64.AppImage`
- Size: 122 MB
- Backend with all dependencies included
- Frontend served from extraResources
- Icons auto-generated from source PNG

**Build Commands:**
```bash
# Build Linux AppImage (tested, works)
npx electron-builder --linux AppImage --publish never

# Build Windows (requires Windows or Wine)
npx electron-builder --win --publish never

# Build macOS (requires macOS)
npx electron-builder --mac --publish never
```

### End-to-End Test Results ✅

All tests passed on January 30, 2026:

| Test | Result |
|------|--------|
| AppImage launches | ✅ Pass |
| Setup wizard displays | ✅ Pass |
| PostgreSQL connection | ✅ Pass |
| Database migrations | ✅ Pass |
| Backend server starts | ✅ Pass |
| Frontend serves correctly | ✅ Pass |
| User authentication | ✅ Pass |
| API endpoints respond | ✅ Pass |
| Main window displays | ✅ Pass |
| System tray works | ✅ Pass |

### Bugs Fixed During Testing

1. **Export directory path** - Changed from read-only app bundle to `~/.bperp-data`
2. **Frontend serving** - Moved to extraResources for backend access

### Remaining Optional Tasks

1. **Windows build** - Requires Windows machine or Wine

2. **macOS build** - Requires macOS for DMG and icon.icns

3. **Embedded PostgreSQL** (optional) - Bundle portable PostgreSQL for zero-config install

4. **Auto-updater** (optional) - Implement electron-updater for maintenance subscribers

---

## Phase 5: Quality Assurance 🔲 PARTIAL

### Testing (continued from Phase 3)

- [x] ~~Unit test framework~~ → Jest
- [x] ~~API tests~~ → Supertest
- [ ] E2E tests with Playwright
- [ ] Critical path coverage (auth, import, license)

### Frontend Improvements

- [ ] Code splitting (large files)
- [ ] Build system (Vite)
- [ ] Minification
- [ ] Accessibility improvements

---

## Phase 6: Business Requirements 🔲 NOT STARTED

### Licensing System

- [ ] License key generation
- [ ] Offline validation
- [ ] Tier support (Starter/Professional/Shop)

### Update System

- [ ] Update checker
- [ ] Download and apply updates
- [ ] Changelog display

### Legal & Documentation

- [ ] EULA
- [ ] Privacy Policy
- [ ] Installation Guide
- [ ] User Manual
- [ ] Data Import Guide

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Security | ✅ Complete | 90% |
| Phase 2: Architecture | ✅ Complete | 85% |
| Phase 2.5: TypeScript Migration | 🔄 In Progress | 22% |
| Phase 3: Data Import & Testing | ✅ Complete | 90% |
| Phase 3.5: UX & Customization | ✅ Complete | 100% |
| Phase 4: Packaging | ✅ Complete | 100% |
| Phase 5: Quality Assurance | 🔲 Partial | 30% |
| Phase 6: Business Requirements | 🔲 Not Started | 0% |

**Overall Progress: ~80%** (Core functionality complete, Linux AppImage fully tested, Windows/Mac builds need respective platforms)

### TypeScript Migration Progress

| Category | Completed | Total | Progress |
|----------|-----------|-------|----------|
| Backend Types | 2 | 2 | ✅ 100% |
| Backend Middleware | 4 | 4 | ✅ 100% |
| Backend Routes | 1 | 11 | 🔄 9% |
| Backend Config | 0 | 3 | 🔲 0% |
| Frontend | 0 | 12 | 🔲 0% |
| **Total** | **7** | **32** | **22%** |

---

## Key Dependencies Added

```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "express-rate-limit": "^8.2.1",
    "zod": "^4.3.6",
    "papaparse": "^5.4.1",
    "xlsx": "^0.18.5",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "ts-node": "^10.x",
    "@types/node": "^20.x",
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "@types/bcrypt": "^5.x",
    "@types/multer": "^1.x",
    "@types/pg": "^8.x",
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

---

## Next Steps

### Immediate Priority: TypeScript Migration

1. **Next route to convert**: `users.js` → `src/routes/users.ts`
   - High priority (core authentication)
   - Already has TypeScript middleware counterpart
   
2. **After users**: `customers.js` → `src/routes/customers.ts`

3. **Continue with**: inventory → quotes → workorders

### Short-term: Quality Assurance (Phase 5)

4. Add E2E tests with Playwright
5. Increase unit test coverage to 60%+
6. Test Windows/Mac builds on respective platforms

### Medium-term: Commercialization (Phase 6)

7. Licensing system implementation
8. Auto-updater for maintenance subscribers
9. Documentation and EULA
10. User manual and installation guide

---

## File Structure After Phases 1-3.5

```
backend/
├── middleware/           # JavaScript middleware (runtime)
│   ├── auth.js
│   ├── rateLimit.js
│   ├── validation.js
│   └── index.js
├── migrations/
│   ├── migrate.js       # Migration CLI
│   └── scripts/
│       └── 20260128_000000_initial_schema.js
├── routes/              # JavaScript routes (runtime)
│   ├── customers.js
│   ├── import.js        # Data import
│   ├── inventory.js
│   ├── machines.js
│   ├── maintenance.js
│   ├── orders.js
│   ├── quotes.js
│   ├── tasks.js
│   ├── users.js         # Enhanced: auth, permissions, appearance
│   ├── workcenters.js
│   └── workorders.js
├── src/                 # TypeScript source
│   ├── types/
│   │   ├── index.ts     # All entity types
│   │   └── database.ts  # DB row types
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimit.ts
│   │   ├── validation.ts
│   │   └── index.ts
│   └── routes/
│       ├── tasks.ts     # Example typed route
│       └── index.ts
├── dist/                # Compiled TypeScript
├── tests/
│   ├── setup.js
│   ├── helpers/
│   │   └── testDb.js
│   ├── middleware/
│   │   └── validation.test.js
│   └── routes/
│       └── import.test.js
├── server.js
├── package.json
├── tsconfig.json
└── jest.config.js

frontend/
├── js/
│   ├── app.js           # Enhanced: ShopBranding, permission checks
│   └── modules/
│       ├── common.js    # Enhanced: backup/restore with users
│       ├── inventory.js
│       ├── maintenance.js
│       ├── sales.js
│       ├── search.js
│       ├── storage.js   # Enhanced: user/branding storage keys
│       ├── tasks.js
│       └── users.js     # NEW: User management module
├── css/
│   └── dashboard.css
├── assets/
│   └── bperp-icon.ico
└── index.html           # Enhanced: permission categories, branding IDs

database/
├── schema.sql
├── sales_schema.sql
├── tasks_schema.sql
└── users_schema.sql     # NEW: Enhanced users, sessions, roles
```
