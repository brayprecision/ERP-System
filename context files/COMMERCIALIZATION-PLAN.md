# ERP Commercialization Plan (On-Premise Edition)

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
- **Features**: Inventory, Sales (customers/quotes/work orders), Tasks, Maintenance, User management

**Code Quality Score**: ~5-6/10 for production readiness

---

## Phase 1: Critical Security Fixes (Must Have)

### 1. Authentication Hardening

- Replace SHA-256 password hashing with **bcrypt** or **argon2** (`backend/routes/users.js` line ~50)
- Create centralized auth middleware (currently duplicated in each route file)
- Implement refresh tokens with proper rotation
- Add rate limiting on login endpoints (`express-rate-limit`)
- Remove demo mode password bypass

### 2. Input Validation & Sanitization

- Add validation library (Joi, Zod, or express-validator)
- Sanitize all HTML string generation in frontend to prevent XSS
- Validate at both client and server layers

### 3. CORS & Session Security

- Configure CORS to allow only specific origins (currently allows all)
- Add CSRF protection
- Implement secure cookie flags

---

## Phase 2: Architecture Improvements (High Priority)

### 4. Database Consistency

Several routes use **in-memory arrays** instead of PostgreSQL:

- `tasks` (lines 190-280 in `backend/server.js`)
- `workcenters`, `machines`, `maintenance` routes
- `orders` (purchase orders, receiving, shipping)

**Action**: Migrate all in-memory routes to PostgreSQL using existing schema files in `database/`

### 5. Service Layer Architecture

- Extract business logic from route handlers into service classes
- Create shared middleware directory
- Implement dependency injection pattern

### 6. Database Migrations

- Implement migration tool (node-pg-migrate or Knex)
- Fix schema conflicts (users table dropped/recreated in `database/users_schema.sql`)
- Add version tracking
- Create rollback scripts

### 7. API Versioning

- Add `/api/v1/` prefix to all routes
- Document API changes between versions

### 8. TypeScript Migration

**Backend (`backend/`):**

- Add `typescript`, `ts-node`, `@types/node`, `@types/express`
- Create `tsconfig.json` with strict mode
- Gradually convert `.js` files to `.ts`
- Start with new code, migrate existing over time

**Frontend (`frontend/js/`):**

- Add TypeScript compilation step
- Create type definitions for state objects
- Convert modules incrementally (start with `common.js`, `storage.js`)

**Benefits:**

- Catch bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring

---

## Phase 3: Data Import Feature (Critical for Target Market)

### CSV/Spreadsheet Import System

Small shops typically have existing data in spreadsheets. Build import wizards for:

**Priority Entities:**

- **Customers** - company name, contact info, addresses
- **Inventory (Materials)** - part numbers, descriptions, quantities, locations
- **Inventory (Tooling)** - tool IDs, descriptions, conditions
- **Contacts** - names, emails, phones linked to customers

**Import Flow:**

1. Upload CSV/Excel file (.csv, .xlsx)
2. Column mapping UI (match spreadsheet columns to database fields)
3. Preview with validation errors highlighted
4. Import with rollback on failure
5. Summary report (imported, skipped, errors)

**Libraries to use:**

- `papaparse` for CSV parsing
- `xlsx` (SheetJS) for Excel file support
- `multer` for file upload handling

**Google Sheets Integration (optional):**

- OAuth2 connection to Google Sheets API
- Select spreadsheet and sheet
- Same column mapping flow

---

## Phase 4: Native Installers & Packaging

### Desktop Application with Electron

Package the ERP as a desktop app using **Electron**:

**Architecture:**

```
┌─────────────────────────────────────────┐
│           Electron Shell                │
│  ┌─────────────────────────────────┐   │
│  │   Frontend (Chromium webview)   │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │   Backend (Express - bundled)   │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │   PostgreSQL (embedded/bundled) │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Key Components:**

- **electron-builder** - Creates installers for all platforms
- **PostgreSQL** - Bundle with installer OR guide user to install separately
- **Auto-updater** - Check for updates (for maintenance subscribers)

**Platform Installers:**

- **Windows**: `.exe` installer (NSIS or MSI)
- **macOS**: `.dmg` with drag-to-Applications
- **Linux**: `.deb` (Debian/Ubuntu) and `.rpm` (Fedora/RHEL)

**Alternative: Simpler Approach**

If Electron adds too much complexity, consider:

- Distribute as a standalone Node.js app with bundled runtime
- Use `pkg` to compile Node.js app into single executable
- Provide PostgreSQL installer separately with setup guide

### First-Run Setup Wizard

- Database connection configuration
- Create admin user
- License key activation
- Optional: Import existing data

### Local Logging

- Replace `console.log` with **Winston** or **Pino**
- Log to rotating files (not cloud services)
- Log levels: error, warn, info, debug
- Include request IDs for tracing
- Add "Export Logs" feature for support tickets

---

## Phase 5: Quality Assurance

### Testing Infrastructure

Currently **no tests exist**. Add:

- Unit tests with **Vitest** (works well with Vite build system)
- API integration tests with **Supertest**
- E2E tests with **Playwright** (can test the Electron app)
- Focus on critical paths: auth, data import, license validation

### Frontend Improvements

**Code Splitting (Recommended):**

Large files should be split for maintainability:

- `frontend/js/modules/sales.js` - 2000+ lines (split into customers.ts, quotes.ts, workorders.ts)
- `frontend/js/modules/tasks.js` - 1822 lines (split into workflow.ts, assignments.ts)

**Build System:**

Add a build step for TypeScript and bundling:

- **Vite** (recommended) - fast builds, good TypeScript support
- Minification for production builds
- Source maps for debugging
- Bundle for Electron distribution

**Accessibility (Nice to Have):**

- Add ARIA attributes to interactive elements
- Keyboard navigation for forms and modals
- Screen reader labels

---

## Phase 6: Business Requirements

### Licensing System (On-Premise)

**License Key Structure:**

- Generate keys with embedded metadata (expiry, user count, features)
- Offline validation (no phone-home required for basic license)
- Optional online check for maintenance subscription status

**Implementation:**

- Use cryptographic signing (RSA or Ed25519)
- License file stored locally
- Validate on app startup
- Grace period for expired maintenance (app still works, no updates)

**Tiers (example):**

- **Starter**: 1-3 users, core features
- **Professional**: 4-10 users, all features
- **Shop**: 11-20 users, all features + priority support

### Update System

**For Maintenance Subscribers:**

- Check for updates on startup (optional, can disable)
- Download and apply updates in-app
- Database migration runs automatically
- Changelog display

**For Non-Subscribers:**

- App continues working indefinitely
- No updates, security patches require re-purchase or subscription

### Legal & Compliance

- **EULA** (End User License Agreement) - displayed during install
- **Privacy Policy** - especially for telemetry if any
- **Refund Policy** - typical for software sales
- No GDPR data processing agreement needed (data stays on customer's machine)

### Documentation

- **Installation Guide** - step-by-step with screenshots
- **User Manual** - feature documentation with examples
- **Admin Guide** - backup, restore, user management
- **Data Import Guide** - CSV templates and column mapping
- **Troubleshooting/FAQ**

### Branding

- Configurable company logo in app settings
- Theme customization (already partially implemented)
- Remove "BPERP" hardcoded references, make configurable

---

## Implementation Roadmap

```
Phase 1: Security Foundation
├── Password hashing (bcrypt)
├── Auth middleware
└── Input validation

Phase 2: Architecture
├── Migrate in-memory routes to PostgreSQL
├── Database migrations system
└── Add TypeScript

Phase 3: Features and Quality
├── CSV/Spreadsheet import
├── Test framework
└── Core tests

Phase 4: Packaging
├── Electron wrapper
├── Native installers
├── Setup wizard
└── Auto-updater

Phase 5: Commercialization
├── License key system
├── Maintenance validation
├── Documentation
└── EULA and legal
```

---

## Effort Estimation by Priority

| Priority | Category | Items | Effort |
|----------|----------|-------|--------|
| P0 | Security | Password hashing, auth middleware, input validation | Medium |
| P1 | Architecture | Migrate in-memory routes, migrations, TypeScript | High |
| P1 | Features | CSV/Excel import, column mapping UI, validation | High |
| P2 | Packaging | Electron wrapper, native installers, setup wizard, updater | High |
| P2 | Quality | Test framework, unit tests, structured logging | Medium |
| P3 | Commercial | License keys, maintenance check, docs, legal | Medium |

---

## Summary

This plan transforms BPERP from a prototype into a sellable on-premise ERP for small machine shops. The key additions are:

1. **Security hardening** - Production-grade auth and validation
2. **Data import** - Let customers bring existing spreadsheet data
3. **Native installers** - Easy installation without technical knowledge
4. **Offline licensing** - One-time purchase with optional maintenance
5. **TypeScript** - Long-term maintainability

The target customer can install the software on their Windows/Mac/Linux machine, import their customer list and inventory from spreadsheets, and start using the system immediately.
