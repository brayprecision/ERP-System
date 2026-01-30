# BPERP - Business Process ERP System

A comprehensive ERP system designed for small machine shops (1-20 employees).

## Features

- **Inventory Management** - Materials, tooling, and miscellaneous items
- **Sales Management** - Customers, quotes, and work orders
- **Task Management** - Work assignments, scheduling, and tracking
- **Workcenter Management** - Machine queues and job routing
- **Maintenance Tracking** - Preventive and corrective maintenance
- **User Management** - Role-based access control with three user levels:
  - **Administrator** - Full access to all features including user management
  - **Machinist** - Access to workcenter, inventory, and tasks
  - **Operator** - Basic access to dashboard, workcenter, and tasks
- **Shop Branding** - Customize logo, shop name, and tagline for white-label deployment
- **Backup & Restore** - Full system backup with offline support

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript (ES6 Modules) + Tailwind CSS
- **Desktop**: Electron (cross-platform native app)
- **Authentication**: Token-based with bcrypt password hashing

## Desktop Application

BPERP is available as a standalone desktop application for easy deployment.

### Download

- **Linux**: `BPERP-1.0.0-beta.1-linux-x86_64.AppImage` (122 MB)
- **Windows**: Coming soon
- **macOS**: Coming soon

### Running the AppImage (Linux)

```bash
chmod +x BPERP-1.0.0-beta.1-linux-x86_64.AppImage
./BPERP-1.0.0-beta.1-linux-x86_64.AppImage
```

The first time you run BPERP, a setup wizard will guide you through:
1. Database configuration (connect to your PostgreSQL server)
2. Admin user creation
3. Initial setup

### Building from Source

```bash
# Install dependencies
npm install
npm run backend:install

# Build for your platform
npm run build:linux   # Linux (AppImage, deb, rpm)
npm run build:win     # Windows (requires Windows or Wine)
npm run build:mac     # macOS (requires macOS)
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ERP-System.git
cd ERP-System
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Configure environment:
```bash
# Copy the example env file
cp .env.example .env

# Edit with your database credentials
nano .env
```

4. Set up the database:
```bash
# Run migrations
npm run migrate
```

5. Start the server:
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

6. Open `frontend/index.html` in your browser or serve it:
```bash
# From project root
python -m http.server 8080 --directory frontend
# Then open http://localhost:8080
```

## Project Structure

```
ERP-System/
??? backend/
?   ??? middleware/      # Auth, validation, rate limiting
?   ??? migrations/      # Database migrations
?   ??? routes/          # API route handlers
?   ??? src/             # TypeScript source files
?   ??? tests/           # Jest test suites
?   ??? server.js        # Express app entry point
?   ??? package.json
??? frontend/
?   ??? js/
?   ?   ??? modules/     # ES6 modules (app, common, sales, tasks, etc.)
?   ??? index.html       # SPA entry point
?   ??? style.css        # Custom styles (Tailwind via CDN)
??? database/
?   ??? *.sql            # Schema files (reference)
??? README.md
```

## API Documentation

### Authentication

All API endpoints (except login) require authentication via Bearer token:

```
Authorization: Bearer <session_token>
```

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/users/login` | Authenticate user |
| `GET /api/customers` | List customers |
| `GET /api/inventory/:category` | List inventory items |
| `GET /api/quotes` | List quotes |
| `GET /api/work-orders` | List work orders |
| `GET /api/tasks` | List tasks with filtering |
| `POST /api/import/preview` | Preview CSV/Excel import |
| `POST /api/import/:entityType` | Import data |

### Data Import

Import data from CSV or Excel files:

```bash
# Get import template
curl http://localhost:3000/api/import/template/customers -o customers_template.csv

# Preview import
curl -X POST http://localhost:3000/api/import/preview \
  -F "file=@customers.csv" \
  -F "entityType=customers"

# Execute import
curl -X POST http://localhost:3000/api/import/customers \
  -H "Authorization: Bearer <token>" \
  -F "file=@customers.csv"
```

Supported entity types: `customers`, `contacts`, `materials`, `tooling`, `workcenters`, `machines`

## Development

### Available Scripts

```bash
# Backend
npm start              # Start production server
npm run dev            # Start with nodemon (auto-reload)
npm test               # Run tests
npm run test:coverage  # Run tests with coverage
npm run migrate        # Run database migrations
npm run migrate:down   # Rollback last migration
npm run build          # Compile TypeScript
npm run typecheck      # Type check without emitting
```

### TypeScript

The project is being migrated to TypeScript. New code should be written in TypeScript:

```
backend/src/           # TypeScript source
backend/dist/          # Compiled JavaScript
```

Type definitions are available in `backend/src/types/`.

### Testing

Tests use Jest and Supertest:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/routes/import.test.js
```

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Zod schemas for all inputs
- **Token-based Auth**: Secure session management

## License

Proprietary - All rights reserved

## Support

For support inquiries, contact [support@example.com]
