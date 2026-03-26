# BPERP Backend - NAS Setup Guide

This guide explains how to run the BPERP backend on your NAS (Zorin OS or other Linux) so workstations can connect as thin clients.

**Local-only development** does not require a NAS: use **Standalone (Local)** in the Electron setup wizard, or run `cd backend && npm run dev` and open `http://localhost:3000`. Use this document when you are ready for **Network (NAS)** mode and multiple workstations.

## Architecture

- **NAS**: Runs the backend server. SQLite database is stored locally (no network filesystem).
- **Workstations**: Run the BPERP Electron app and connect to `http://nas-ip:3000`.

### Workstations: reinstalling the desktop app

Uninstalling BPERP on a PC **does not** remove Electron **user data** (where the app stores **Server URL** and other settings). After reinstall, the workstation can immediately use **Network** mode again and load the UI from the NAS. That is correct for production, but if the NAS still has an **old** `frontend/` folder, the UI will look outdated even with a fresh installer. **Update `frontend/` on the NAS** whenever you ship UI changes (see step 1 below). To test the **bundled** UI from a new installer instead, clear **Server URL** under **Settings → Server Connection** (or use Standalone) and restart the app.

## Prerequisites

- Node.js 18+ installed on the NAS
- Network access from workstations to the NAS

## Quick Start (Manual)

1. **Copy the backend and frontend to your NAS**

   The server serves the UI from a `frontend/` folder **next to** `backend/` (same parent directory as in the repo). Copy both folders, e.g.:

   ```
   /home/youruser/bperp/
     backend/
     frontend/
   ```

   If you deploy only `backend/` and omit `frontend/`, the app will not load correctly. If `frontend/` is an **older copy** of the project, the browser will show an outdated sidebar (for example, missing **Products** and **Parts** under Inventory). After pulling UI changes from git, copy the updated `frontend/` directory to the NAS and restart the backend.

2. **Install dependencies**

   ```bash
   cd /home/youruser/bperp/backend
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env and set:
   # DB_PATH=/home/youruser/bperp/bperp.db   (or your preferred path)
   # PORT=3000
   # NODE_ENV=production
   ```

4. **Create the database directory** (if using a custom path)

   ```bash
   mkdir -p /home/youruser/bperp
   ```

5. **Start the server**

   ```bash
   npm start
   ```

   Or use the start script:

   ```bash
   chmod +x scripts/start-server.sh
   DB_PATH=/home/youruser/bperp/bperp.db ./scripts/start-server.sh
   ```

6. **Verify**

   From a workstation, open `http://<nas-ip>:3000/api/health` in a browser. You should see `{"status":"ok","timestamp":"..."}`.

## Running as a Service (systemd)

To run the backend automatically on boot:

1. **Copy the service file**

   ```bash
   sudo cp backend/scripts/bperp.service /etc/systemd/system/
   ```

2. **Edit the service file**

   ```bash
   sudo nano /etc/systemd/system/bperp.service
   ```

   Update these values:
   - `User=YOUR_USER` → your Linux username
   - `WorkingDirectory=/path/to/ERP-System/backend` → full path to the backend folder
   - `Environment="DB_PATH=/path/to/bperp/bperp.db"` → where to store the database

3. **Enable and start**

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable bperp
   sudo systemctl start bperp
   ```

4. **Check status**

   ```bash
   sudo systemctl status bperp
   journalctl -u bperp -f   # View logs
   ```

## Migrations

Migrations run automatically when the server starts. No manual step required.

## Firewall

Ensure port 3000 is open on the NAS so workstations can connect:

```bash
# Ubuntu/Zorin (ufw)
sudo ufw allow 3000/tcp
sudo ufw reload
```

## Workstation Setup

1. Install BPERP using the Windows or Linux installer.
2. On first launch, the setup wizard asks for the **Server URL** (e.g. `http://192.168.1.100:3000`).
3. Test the connection, create the admin user if prompted, and launch.

## Troubleshooting

- **Connection refused**: Check that the backend is running (`systemctl status bperp`) and the firewall allows port 3000.
- **Database errors**: Ensure the `DB_PATH` directory exists and is writable by the service user.
- **CORS errors**: The backend allows all origins by default. Set `CORS_ORIGIN` in `.env` to restrict if needed.
- **Missing Inventory tabs (e.g. Products / Parts)**: Workstations that use **Server URL** (remote mode) load the UI from the NAS, not from the Electron installer. Update `frontend/` on the server to match your current repo, restart the backend, then reload the app (the server sends `Cache-Control: no-cache` for `index.html`). To confirm, open `http://<nas-ip>:3000/` in a browser and search the page source for `inventory-products`.
