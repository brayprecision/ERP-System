# BPERP Backend

Express.js API server for the BPERP ERP system. It can run **on the NAS** (or any central machine) for Network mode, or **locally** when started by Electron (Standalone) or via `npm run dev` / `npm start` for browser development. SQLite uses a single file at `DB_PATH`.

**NAS deployment:** see `docs/NAS-SETUP.md`.

**Electron:** Native modules must match Electron’s embedded Node. From the **repository root**, run `npm run rebuild:backend` (see `scripts/rebuild-backend-native.js`). After `npm install` in `backend/`, run that again before `npm start` at the root.

**Packaging (repo root):** `npm run build:win`, `build:linux`, and `pack:win` use **`npm run backend:install:prod`** (`npm install --omit=dev` + `npm prune --omit=dev` here) so the copied `resources/backend` tree omits Jest, nodemon, TypeScript, etc. After running those, run **`npm run backend:install`** from the repo root if you need dev dependencies in `backend/` again for tests or `npm run dev`.

## Setup

### Prerequisites

- Node.js 18+

### Installation

```bash
npm install
```

### Environment Configuration

Create a `.env` file:

```env
# Database — path to the SQLite file (local to this machine)
# On NAS: use a path like /home/user/bperp/bperp.db
DB_PATH=./bperp.db

# Server
PORT=3000
NODE_ENV=development

# Session
SESSION_TIMEOUT_HOURS=24
```

If `DB_PATH` is not set, the backend defaults to `./bperp.db` in the backend directory.

### Migrations

Migrations run automatically when the server starts (`server.js` spawns the migration CLI before `initDb`). When the backend process is running **inside Electron** (forked child), that subprocess uses `process.execPath` with `ELECTRON_RUN_AS_NODE=1` so migrations use the **same Node binary** as the API server. Using plain `node` here would mix system Node with Electron’s Node and break `better-sqlite3` (NODE_MODULE_VERSION mismatch).

To run migrations manually:

```bash
npm run migrate
npm run migrate:status
npm run migrate:down
npm run migrate:create -- my_migration_name
```

## Running

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Server runs on `http://localhost:3000` by default and binds to `0.0.0.0` so it accepts connections from other machines on the network.

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run build` | Compile TypeScript |
| `npm run build:watch` | Compile in watch mode |
| `npm run typecheck` | Type check without emit |
| `npm run migrate` | Run pending migrations |
| `npm run migrate:down` | Rollback last migration |
| `npm run migrate:status` | Show migration status |
| `npm run migrate:create` | Create new migration |

## Project Structure

```
backend/
├── middleware/          # Express middleware (JavaScript)
│   ├── auth.js          # Authentication & authorization
│   ├── rateLimit.js     # Rate limiting
│   ├── validation.js    # Zod validation schemas
│   └── index.js         # Exports
├── migrations/
│   ├── migrate.js       # Migration CLI tool
│   └── scripts/         # Migration files
├── routes/              # API route handlers (JavaScript)
│   ├── customers.js
│   ├── import.js        # Data import API
│   ├── inventory.js
│   ├── machines.js
│   ├── maintenance.js
│   ├── orders.js
│   ├── quotes.js
│   ├── tasks.js
│   ├── users.js
│   ├── workcenters.js
│   └── workorders.js
├── db.js                # SQLite wrapper (PostgreSQL-compatible query interface)
├── scripts/             # NAS deployment (start-server.sh, bperp.service)
├── tests/
│   ├── setup.js         # Jest setup
│   ├── helpers/         # Test utilities
│   ├── middleware/      # Middleware tests
│   └── routes/          # Route tests
├── server.js            # Express app entry point
├── package.json
├── tsconfig.json        # TypeScript config
└── jest.config.js       # Jest config
```

## API Overview

### Setup (first-run)

```
GET  /api/setup/status             # Check if admin exists (no auth)
POST /api/setup/init               # Create initial admin (no auth, first-run only)
```

### Authentication & Users

```
POST /api/users/login              # Login, returns session token
POST /api/users/logout             # Logout, invalidates token
GET  /api/users/me                 # Get current user
GET  /api/users/validate           # Validate session token
GET  /api/users                    # List all users (admin only)
GET  /api/users/:id                # Get user details
POST /api/users                    # Create user (admin only)
PUT  /api/users/:id                # Update user
DELETE /api/users/:id              # Delete user (admin only)
PUT  /api/users/:id/permissions    # Update tab permissions (admin only)
PUT  /api/users/:id/appearance     # Update appearance settings
GET  /api/users/roles/defaults     # Get default permissions per role
GET  /api/users/activity/log       # Get user activity log (admin only)
```

**User Roles:**
- `Administrator` - Full access to all features
- `Machinist` - Access to workcenter, inventory, tasks
- `Operator` - Basic access to dashboard, workcenter, tasks

All other endpoints require `Authorization: Bearer <token>` header.

### Customers

```
GET    /api/customers           # List customers
GET    /api/customers/:id       # Get customer
POST   /api/customers           # Create customer
PUT    /api/customers/:id       # Update customer
DELETE /api/customers/:id       # Soft delete customer
GET    /api/customers/:id/contacts  # Get customer contacts
```

### Inventory

```
GET    /api/inventory/products      # List products
GET    /api/inventory/products/:id  # Get product
POST   /api/inventory/products      # Create product
PUT    /api/inventory/products/:id  # Update product
DELETE /api/inventory/products/:id  # Delete product
GET    /api/inventory/products/:id/bom    # Get product BOM
POST   /api/inventory/products/:id/bom   # Add part to BOM
DELETE /api/inventory/products/:id/bom/:partId  # Remove part from BOM

GET    /api/inventory/parts         # List parts
GET    /api/inventory/parts/:id     # Get part
POST   /api/inventory/parts         # Create part
PUT    /api/inventory/parts/:id     # Update part
DELETE /api/inventory/parts/:id     # Delete part

GET    /api/inventory/materials     # List materials
GET    /api/inventory/tooling      # List tooling
GET    /api/inventory/misc         # List misc items
```

### Tasks

```
GET    /api/tasks              # List tasks (with filtering)
GET    /api/tasks/stats        # Get task statistics
GET    /api/tasks/my-tasks     # Get user's tasks
GET    /api/tasks/:id          # Get task with history
POST   /api/tasks              # Create task
PUT    /api/tasks/:id          # Update task
PUT    /api/tasks/:id/status   # Update task status
PUT    /api/tasks/:id/assign   # Assign task
POST   /api/tasks/:id/issue    # Report issue
DELETE /api/tasks/:id          # Soft delete task
```

### Data Import

```
GET  /api/import/supported-types        # List importable entities
GET  /api/import/template/:entityType   # Download CSV template
POST /api/import/preview                # Preview import with validation
POST /api/import/customers              # Import customers
POST /api/import/materials              # Import materials
POST /api/import/tooling                # Import tooling
POST /api/import/products               # Import products
POST /api/import/parts                 # Import parts
POST /api/import/workcenters            # Import workcenters
POST /api/import/machines               # Import machines
```

## Middleware

### Authentication (`middleware/auth.js`)

```javascript
const { requireAuth, requireAdmin, requireRole, requireSelfOrAdmin } = require('./middleware/auth')(pool);

// Require any authenticated user
router.get('/protected', requireAuth, handler);

// Require administrator role
router.post('/admin-only', requireAdmin, handler);

// Require specific roles
router.get('/ops', requireRole('Administrator', 'Machinist'), handler);

// Require self or admin (for profile updates)
router.put('/users/:id', requireSelfOrAdmin('id'), handler);
```

### Rate Limiting (`middleware/rateLimit.js`)

```javascript
const { loginLimiter, apiLimiter, importLimiter } = require('./middleware/rateLimit');

// 5 login attempts per 15 minutes
router.post('/login', loginLimiter, handler);

// 100 requests per minute
router.use('/api', apiLimiter);

// 20 imports per hour
router.post('/import', importLimiter, handler);
```

### Validation (`middleware/validation.js`)

```javascript
const { validateBody, schemas } = require('./middleware/validation');

router.post('/users', validateBody(schemas.createUser), handler);
router.post('/login', validateBody(schemas.login), handler);
router.post('/customers', validateBody(schemas.customer), handler);
```

## Testing

### Test Types

**Unit Tests (No Database Required)**
- Validation schema tests
- Import helper function tests

**Integration Tests (Database Required)**
- API endpoint tests
- Authentication flow tests
- Uses a temporary SQLite database (no external setup needed)

### Running Tests

```bash
# Unit tests only (no database needed)
npm test -- tests/middleware/validation.test.js tests/unit/

# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific file
npm test -- tests/routes/import.test.js
```

### Test Database Setup

Configure `.env.test`:
```env
DB_PATH=./bperp_test.db
```

Run migrations on test database:
```bash
NODE_ENV=test npm run migrate
```

### Writing Tests

Tests use Jest and Supertest. Test helpers are in `tests/helpers/testDb.js`:

```javascript
const { getPool, clearTables, createTestUser, createTestSession } = require('./helpers/testDb');

describe('My API', () => {
    let pool;
    
    beforeAll(async () => {
        pool = getPool();
    });
    
    beforeEach(async () => {
        await clearTables(pool, ['users', 'customers']);
    });
    
    it('should do something', async () => {
        const user = await createTestUser(pool);
        const session = await createTestSession(pool, user.id);
        
        const response = await request(app)
            .get('/api/customers')
            .set('Authorization', `Bearer ${session.token}`);
            
        expect(response.status).toBe(200);
    });
});
```

## Migrations

### Creating Migrations

```bash
npm run migrate:create -- add_new_feature
```

This creates a file like `migrations/scripts/20260129_123456_add_new_feature.js`:

```javascript
module.exports = {
    up(client) {
        client.query(`
            ALTER TABLE customers ADD COLUMN new_field TEXT;
        `);
    },
    down(client) {
        // SQLite doesn't support DROP COLUMN before 3.35.0
        // For older versions, recreate the table without the column
        client.query(`
            ALTER TABLE customers DROP COLUMN new_field;
        `);
    }
};
```

### Running Migrations

```bash
# Apply all pending
npm run migrate

# Rollback last
npm run migrate:down

# Check status
npm run migrate:status
```

## Security

- **Passwords**: Hashed with bcrypt (12 salt rounds)
- **Sessions**: Random tokens stored in `user_sessions` table
- **Rate Limiting**: Configurable per-endpoint limits
- **Input Validation**: Zod schemas with strict mode
- **SQL Injection**: Parameterized queries throughout
