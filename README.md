# BPERP — Manufacturing ERP

Open source ERP for machine shops. Manage inventory, quotes, work orders, tasks, and shop floor operations in one place.

**License:** Free to use and modify, including commercially. You may not sell or rebrand it as a software product. See [LICENSE.txt](LICENSE.txt).

## Features

- **Inventory** — Products, parts, materials, tooling, and misc items. Kanban view for low-stock alerts with reorder quantities and costs. Bill of Materials on product assemblies.
- **Sales** — Customers, contacts, and leads. Quotes with full lifecycle tracking. Work orders with per-step checklists.
- **Task Management** — Workflow tabs, ordering queue, and completed work views. Recurring misc tasks (weekly or monthly).
- **Labor & Time Tracking** — Shop shift clock-in/out, per-job process timers tied to work order steps, and full time history. Dashboard shows who is on the floor and what they're working on.
- **Workcenter Management** — Machine queues, job routing, and state tracking across the shop floor.
- **Machine Maintenance** — Maintenance and upgrade tasks per machine with urgency indicators.
- **User Management** — Admin, Machinist, and Operator roles with tab-level permissions.
- **Shop Branding** — Set your shop name, logo, and tagline.
- **Data Import** — Bulk CSV/Excel import for customers, inventory, machines, and more.
- **Desktop App** — Electron app for Windows and Linux with a first-run setup wizard.

## Getting Started

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Windows:** Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) with the **"Desktop development with C++"** workload — required to compile native modules (`bcrypt`, `better-sqlite3`). Alternatively: `npm install --global windows-build-tools` (run PowerShell as Administrator).
- **Linux:** Install a C++ toolchain for native module compilation:
  ```bash
  sudo apt install build-essential python3-setuptools
  ```

### Option 1: Run in the browser (fastest)

The quickest way to try BPERP. No desktop install needed.

```bash
git clone https://github.com/brayprecision/ERP-System.git
cd ERP-System/backend
npm install
npm run dev
```

> **Windows: `npm` blocked by execution policy?** Run this once in PowerShell as Administrator, then retry:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

Open `http://localhost:3000`. A local SQLite database (`backend/bperp.db`) is created automatically on first run.

> **Startup fails with `ERR_DLOPEN_FAILED`, "No native build was found", or "compiled against a different Node.js version"?**
> ```bash
> cd backend
> npm rebuild better-sqlite3 bcrypt
> ```
> Then run `npm run dev` again. This compiles the native modules from source for your current Node.js version. Requires a C++ toolchain (see Prerequisites above).

### Option 2: Desktop app (Electron)

```bash
git clone https://github.com/brayprecision/ERP-System.git
cd ERP-System
npm run setup              # Install root + backend dependencies
npm run rebuild:backend    # Build native modules for Electron's Node
npm start                  # Launch the desktop app
```

> **`npm start` fails with `ERR_DLOPEN_FAILED`?** Run `npm run rebuild:backend` again from the repo root.

> **Want to switch back to browser mode?** After running Electron, native modules are built for Electron's Node. Rebuild for your system Node before using `npm run dev`:
> ```bash
> cd backend && npm rebuild better-sqlite3 bcrypt
> ```

## First-Time Setup

On first launch, a setup wizard asks you to choose a deployment mode:

**Standalone (Local)** — Everything runs on one computer. SQLite database stored locally. Best for single-user use, development, or evaluation.

**Network (NAS)** — The backend runs on a server. Workstations connect as thin clients over HTTP. User profiles and permissions are stored centrally and load automatically on login.

Choose **Standalone** to get up and running immediately — create an admin account and the app launches.

## Multi-Workstation Setup (NAS)

To run BPERP across multiple shop computers sharing the same data, deploy the backend on your NAS or a dedicated Linux server and connect each workstation via **Network** mode in the setup wizard.

See [docs/NAS-SETUP.md](docs/NAS-SETUP.md) for the full guide.

## Known Issues

- **Backup/Restore** is not yet fully implemented — a proper backup will copy the SQLite `.db` file directly.
- **Cross-module search** is not fully wired yet.

## Building Installers

The build scripts handle installing production dependencies and rebuilding native modules for Electron automatically.

```bash
npm run build:win        # Windows NSIS installer → dist-installers/BPERP-*-win-x64.exe
npm run build:linux      # Linux .deb + AppImage → dist-installers/
npm run pack:win         # Windows unpacked app only (faster; good for testing)
npm run pack:linux       # Linux unpacked dir only
```

After a build, restore dev dependencies if you need to run tests or `npm run dev` again:

```bash
npm run backend:install
```

### Linux installer notes

- **`.deb` (recommended):** `sudo apt install ./BPERP-*-linux-amd64.deb` — `apt` pulls in all required system libraries automatically. Works on Ubuntu, Debian, Linux Mint, and Zorin OS.
- **AppImage:** `chmod +x BPERP-*-linux-x86_64.AppImage` then run it. If it fails to mount, install `libfuse2` or `libfuse2t64` for your distribution, or use the `.deb` instead.

### Beta testing (Windows)

Use the PowerShell launcher to repack and run without building a full NSIS installer each time:

```powershell
.\scripts\launch-beta.ps1                                    # Repack + launch unpacked .exe
.\scripts\launch-beta.ps1 -Dev                               # Fastest: Electron from source, no repack
.\scripts\launch-beta.ps1 -FullInstaller                     # Full NSIS build + launch
.\scripts\launch-beta.ps1 -SkipBackendInstall -SkipNativeRebuild  # Repack when only app code changed
```

From cmd or double-click: `scripts\launch-beta.cmd`. If `.ps1` is blocked by execution policy, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Troubleshooting

### Setup wizard hangs or the window stays blank

- Open **Help → View Logs** in the app, or find `bperp.log` in the Electron user data folder (shown under **Settings → About this app**). Look for `Starting backend`, `Admin user created`, or `Setup failed`.
- **Standalone hangs:** Usually a native module ABI problem or port 3000 is in use. Run `cd backend && npm run dev` directly to see the server output.
- **Network mode:** The wizard times out the connection check after 8 seconds. Confirm the server URL is reachable from this machine (`http://<server-ip>:3000/api/health` should return `{"status":"ok"}`).
- **Enable DevTools on first run:** `BPERP_DEBUG_SETUP=1 npm start`

### Reinstalling shows an old UI

Electron stores config (server URL, settings) under user data, not inside the install folder — uninstalling does not clear it. If the app still loads an old UI from a NAS server after reinstall, go to **Settings → Server Connection → Clear (Standalone Mode)** and restart, or update `frontend/` on the server.

## Project Structure

```
ERP-System/
├── backend/
│   ├── db.js            # SQLite wrapper
│   ├── middleware/       # Auth, validation, rate limiting
│   ├── migrations/       # Schema migrations
│   ├── routes/           # API route handlers
│   ├── scripts/          # NAS deployment (systemd service file)
│   ├── tests/            # Jest test suites
│   └── server.js         # Express entry point
├── docs/
│   └── NAS-SETUP.md     # Multi-workstation deployment guide
├── electron/
│   ├── main.js           # Electron main process
│   ├── preload.js        # IPC bridge
│   └── setup-wizard/     # First-run setup UI
├── frontend/
│   ├── js/modules/       # ES6 app modules
│   ├── css/              # Tailwind CSS
│   └── index.html        # SPA entry point
├── scripts/
│   ├── rebuild-backend-native.js  # Native rebuild for Electron
│   ├── launch-beta.ps1            # Windows beta launcher
│   └── launch-beta.cmd
└── package.json          # Electron-builder config
```

## Tech Stack

- **Backend:** Node.js + Express.js (port 3000)
- **Database:** SQLite via `better-sqlite3` (single `.db` file — local in Standalone, on the server in Network mode)
- **Frontend:** Vanilla JavaScript (ES6 modules) + Tailwind CSS (no build step)
- **Desktop:** Electron (Windows & Linux)
- **Auth:** Token-based sessions with bcrypt password hashing

## Architecture

### Standalone mode

```
┌──────────────────────────┐
│  This Computer           │
│  Electron App            │
│    └─ Backend (fork)     │
│         └─ SQLite (.db)  │
└──────────────────────────┘
```

### Network mode (NAS)

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Workstation  │   │  Workstation  │   │  Workstation  │
│  (Windows)    │   │  (Linux)      │   │  (Windows)    │
│  Electron App │   │  Electron App │   │  Electron App │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       └──────────┬───────┴──────────────────┘
                  │  http://nas:3000
         ┌────────▼────────┐
         │   NAS / Server  │
         │  Backend + DB   │
         │  (SQLite local) │
         └─────────────────┘
```

## Native Modules (Electron vs System Node)

`better-sqlite3` and `bcrypt` are native C++ addons compiled for a specific Node.js ABI. The Electron app forks the backend using Electron's embedded Node, which has a different ABI than your system Node.

| Context | Node used | Fix if ABI mismatch |
|---------|-----------|---------------------|
| `cd backend && npm run dev` | System Node | `cd backend && npm rebuild better-sqlite3 bcrypt` |
| `npm start` (Electron) | Electron's embedded Node | `npm run rebuild:backend` from repo root |

`npm run rebuild:backend` (via `scripts/rebuild-backend-native.js`) deletes stale build artifacts and compiles from source for Electron's version. Run it after any `npm install` in `backend/` if you plan to use the Electron app.

## API Reference

All endpoints except `/login` and `/setup` require `Authorization: Bearer <token>`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check (no auth) |
| `GET /api/setup/status` | Check if setup is complete (no auth) |
| `POST /api/users/login` | Authenticate |
| `GET /api/customers` | List active customers |
| `GET /api/customers/archived` | List archived customers |
| `DELETE /api/customers/:id/permanent` | Permanently delete archived customer (Admin) |
| `GET /api/inventory/:category` | List inventory items |
| `GET /api/quotes` | List quotes |
| `GET /api/work-orders` | List work orders |
| `GET /api/tasks` | List tasks |
| `GET /api/labor/status` | Current shift + active timers |
| `POST /api/labor/clock-in` / `clock-out` | Shop shift |
| `PATCH /api/labor/shift/:id` | Edit shift times |
| `POST /api/labor/segment/start` / `stop` | Work order process timer |
| `POST /api/labor/misc-segment/start` / `stop` | Misc task timer |
| `GET /api/labor/history` | Time history (date range) |
| `GET /api/labor/presence` | Who is on the floor (Dashboard) |
| `GET /api/labor/team` | Team visible in Time Tracking |
| `POST /api/import/preview` | Preview CSV/Excel import |
| `POST /api/import/:entityType` | Import data |
| `GET /api/import/template/:type` | Download import template |

## Common Commands

```bash
# Development
cd backend && npm run dev             # Start backend with auto-reload
cd backend && npm test                # Run tests
cd backend && npm run migrate         # Run migrations manually
cd backend && npm run migrate:status  # Check migration status

# Electron (from repo root)
npm run rebuild:backend               # Rebuild native modules for Electron
npm start                             # Launch desktop app
npm run dev                           # Launch with NODE_ENV=development

# Build
npm run build:win                     # Windows installer
npm run build:linux                   # Linux .deb + AppImage
npm run pack:win                      # Windows unpacked (no installer)
```

## Security

- **Passwords:** bcrypt hashed (12 salt rounds)
- **Rate limiting:** 5 login attempts / 15 min, 100 API requests / min
- **Input validation:** Zod schemas on all endpoints
- **SQL:** Parameterized queries throughout
- **Sessions:** Token-based with configurable expiration

## Contributing

Contributions are welcome. Fork the repo, make your changes on a branch, and open a pull request.

Keep pull requests focused — one feature or fix per PR. If you're planning a larger change, open an issue first to discuss the approach.

## License

MIT + Commons Clause — see [LICENSE.txt](LICENSE.txt).

Free to use, modify, and run in your shop. You may not sell this software or offer it as a hosted service.
