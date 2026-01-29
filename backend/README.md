# BPERP Backend

Express.js API server for the BPERP ERP system.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
npm install
```

### Environment Configuration

Create a `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bperp
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development

# Session
SESSION_TIMEOUT_HOURS=24
```

### Database Setup

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create -- my_migration_name
```

## Running

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Server runs on `http://localhost:3000` by default.

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
├── src/                 # TypeScript source
│   ├── types/           # Type definitions
│   ├── middleware/      # Typed middleware
│   └── routes/          # Typed routes
├── dist/                # Compiled TypeScript output
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
GET    /api/inventory/:category     # List items (material/tooling/misc)
GET    /api/inventory/:category/:id # Get item
POST   /api/inventory/:category     # Create item
PUT    /api/inventory/:category/:id # Update item
DELETE /api/inventory/:category/:id # Soft delete item
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

## TypeScript

### Type Definitions

All entity types are defined in `src/types/index.ts`:

```typescript
import { User, Task, Customer, Material, WorkOrder } from './src/types';
```

Database row types (snake_case) are in `src/types/database.ts`:

```typescript
import { TaskRow, CustomerRow, snakeToCamel } from './src/types/database';
```

### Writing New Routes in TypeScript

See `src/routes/tasks.ts` for a complete example:

```typescript
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Task, ApiResponse } from '../types';

export default function createRouter(pool: Pool): Router {
    const router = Router();
    
    router.get('/:id', async (
        req: Request<{ id: string }>,
        res: Response<ApiResponse<Task>>
    ) => {
        // Handler implementation
    });
    
    return router;
}
```

### Building

```bash
# Compile TypeScript to dist/
npm run build

# Type check without emitting
npm run typecheck

# Watch mode
npm run build:watch
```

## Testing

### Test Types

**Unit Tests (No Database Required)**
- Validation schema tests
- Import helper function tests
- Can run without PostgreSQL

**Integration Tests (Database Required)**  
- API endpoint tests
- Authentication flow tests
- Requires running PostgreSQL with test database

### Running Tests

```bash
# Unit tests only (no database needed)
npm test -- tests/middleware/validation.test.js tests/unit/

# All tests (requires database)
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific file
npm test -- tests/routes/import.test.js
```

### Test Database Setup

For integration tests, create a test database:

```sql
CREATE DATABASE bperp_test;
```

Configure `.env.test`:
```env
DB_NAME=bperp_test
DB_USER=postgres
DB_PASSWORD=your_password
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
    up: async (pool) => {
        await pool.query(`
            ALTER TABLE customers ADD COLUMN new_field VARCHAR(100);
        `);
    },
    down: async (pool) => {
        await pool.query(`
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

- **Passwords**: Hashed with bcrypt (10 salt rounds)
- **Sessions**: Random tokens stored in `user_sessions` table
- **Rate Limiting**: Configurable per-endpoint limits
- **Input Validation**: Zod schemas with strict mode
- **SQL Injection**: Parameterized queries throughout
