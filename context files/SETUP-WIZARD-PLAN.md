# Plan: Streamline Setup Wizard for NAS-Based SQLite Deployment

## Context

All workstations (Windows & Linux) read/write a single SQLite database file stored on the
shop's NAS. Setup needs to be fast and foolproof — install the app, point it at the NAS
database path, log in. User profiles, permissions, and appearance settings load automatically
from the database.

The setup wizard has several UX problems and was previously designed for PostgreSQL. It needs
to be updated for the SQLite-on-NAS model:

1. **Username with space causes lock-up**: User typed "John Smith" as username → alert rejected it → after dismissing the alert, input fields become unresponsive. Root cause: `alert()` in Electron steals focus and doesn't reliably return it. Also, form inputs use `change` events (fire on blur) not `input` events, so config state can be stale.
2. **DB connection UI is wrong**: Shows PostgreSQL host/port/user/password fields. For SQLite on NAS, we just need a file/folder path.
3. **Too many steps / unnecessary options**: Welcome screen is filler. Embedded PostgreSQL and SQLite radio options don't apply. For NAS model, user just needs to pick or enter a path.
4. **Validation happens too late**: All errors shown via `alert()` only when clicking Next, no inline feedback.

---

## Changes

### Files to modify
- `electron/setup-wizard/wizard.html`
- `electron/setup-wizard/wizard.js`
- `electron/setup-wizard/wizard.css` (minor additions for inline errors)
- `electron/preload.js` (add NAS path browse/test IPC)
- `electron/main.js` (add IPC handler for path validation and folder browse)

### 1. Reduce to 3 steps: Database Path → Admin → Finish

Remove the Welcome step (step 1). Renumber:
- Step 1: Database Location (NAS path)
- Step 2: Admin Account
- Step 3: Summary & Launch

Update `totalSteps = 3`, progress bar HTML (remove Welcome circle), step-content sections.

### 2. Replace PostgreSQL form with NAS path input

Remove all PostgreSQL connection fields (host, port, dbName, dbUser, dbPassword) and the
DB type radio options. Replace with:

- A text input for the NAS path (e.g. `\\NAS\bperp\bperp.db` or `/mnt/nas/bperp/bperp.db`)
- A "Browse..." button that opens a native folder/file dialog via Electron IPC
- A "Test Path" button that verifies the path is writable
- Platform-appropriate placeholder text (UNC path on Windows, mount path on Linux)

### 3. Replace all `alert()` with inline error messages

Add an `.error-message` element below each form field. On validation failure, show the message
inline with red styling instead of calling `alert()`. This fixes the Electron focus-stealing bug.

**wizard.js changes:**
- Add `showFieldError(fieldId, message)` and `clearFieldError(fieldId)` helpers
- `validateStep()` calls these instead of `alert()`
- Clear errors when user starts typing (via `input` event)

**wizard.css additions:**
```css
.form-group .error-message {
    color: var(--error);
    font-size: 11px;
    margin-top: 4px;
}
.form-group input.error {
    border-color: var(--error);
}
```

### 4. Fix form input event listeners — use `input` not `change`

Change all input listeners from `change` to `input` so config state updates on every keystroke,
not just on blur. This prevents stale state when user types and immediately clicks Next.

### 5. Allow spaces in usernames (relax validation)

Change regex to `/^[a-zA-Z0-9_ .]+$/` (letters, numbers, underscores, spaces, dots).
Update hint text. The backend `POST /api/setup/init` doesn't enforce a username regex.

### 6. Improve NAS path error messages

When path test fails, translate common errors into actionable messages:
- Path doesn't exist → "Could not find this path. Make sure the NAS is connected and the share is mounted."
- Permission denied → "Cannot write to this location. Check folder permissions on the NAS."
- Not a valid path → "Enter a valid file path (e.g. \\\\NAS\\bperp\\bperp.db)"

### 7. Require successful path test before proceeding

Disable Next button on step 1 until path test succeeds. If user changes the path, reset the
test status (require re-test).

### 8. Add IPC handlers for NAS path

**electron/preload.js** — expose:
- `browseDatabasePath()` — opens native folder dialog, returns selected path
- `testDatabasePath(dbPath)` — checks path exists and is writable, returns `{success, error}`

**electron/main.js** — implement:
- `browse-db-path` handler using `dialog.showOpenDialog` (directory selection)
- `test-db-path` handler that checks `fs.accessSync(path, fs.constants.W_OK)`

---

## Verification

1. Run `npm start` from project root
2. Setup wizard should show 3 steps (no Welcome)
3. Enter or browse for NAS path → should show friendly error or success
4. Next button should be disabled until path test passes
5. On Admin step, type a username with spaces → should be accepted
6. Type invalid data → inline errors should appear (no alert popups)
7. Complete setup → should launch main window
