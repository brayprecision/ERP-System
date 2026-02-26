# Plan: Streamline Setup Wizard for Multi-Workstation Deployment

## Context

All workstations (Windows & Linux) connect to a single shared PostgreSQL server on the network.
Setup needs to be fast and foolproof — install the app, enter the DB connection, log in. User
profiles, permissions, and appearance settings load automatically from the database.

The setup wizard has several UX problems making it painful for deployment across workstations:

1. **Username with space causes lock-up**: User typed "John Smith" as username → alert rejected it → after dismissing the alert, input fields become unresponsive. Root cause: `alert()` in Electron steals focus and doesn't reliably return it. Also, form inputs use `change` events (fire on blur) not `input` events, so config state can be stale.
2. **DB connection test error is confusing**: Error just shows raw PostgreSQL message, no guidance.
3. **Too many steps / unnecessary options**: Welcome screen is filler. Embedded PostgreSQL and SQLite options don't work. For the network database model, the DB type choice is unnecessary — it's always external PostgreSQL.
4. **Validation happens too late**: All errors shown via `alert()` only when clicking Next, no inline feedback.

---

## Changes

### Files to modify
- `electron/setup-wizard/wizard.html`
- `electron/setup-wizard/wizard.js`
- `electron/setup-wizard/wizard.css` (minor additions for inline errors)

### 1. Reduce to 3 steps: Database → Admin → Finish

Remove the Welcome step (step 1). It's informational filler that adds a click for no value. Renumber:
- Step 1: Database Connection
- Step 2: Admin Account
- Step 3: Summary & Launch

Update `totalSteps = 3`, progress bar HTML (remove Welcome circle), step-content sections.

### 2. Remove non-functional DB type options

Remove all DB type radio options (Embedded, SQLite, External) on all platforms. The app always connects to an external PostgreSQL server on the network. Just show the connection form directly with a brief header explaining what's needed.

### 3. Replace all `alert()` with inline error messages

Add an `.error-message` element below each form field. On validation failure, show the message inline with red styling instead of calling `alert()`. This fixes the Electron focus-stealing bug.

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

Change all input listeners from `change` to `input` so config state updates on every keystroke, not just on blur. This prevents stale state when user types and immediately clicks Next.

Lines 101-114 of wizard.js: change `addEventListener('change', ...)` to `addEventListener('input', ...)`.

### 5. Allow spaces in usernames (relax validation)

The regex `^[a-zA-Z0-9_]+$` rejects spaces. For internal use there's no security reason to block them. Change to `^[a-zA-Z0-9_ ]+$` and `trim()` before saving. Also update the hint text.

Alternatively, auto-convert spaces to underscores on blur and show feedback. More forgiving UX.

**Approach**: Allow spaces — change regex to `/^[a-zA-Z0-9_ .]+$/` (letters, numbers, underscores, spaces, dots). Update hint: "Letters, numbers, spaces, underscores, and dots". The backend `POST /api/setup/init` (server.js:186-261) doesn't enforce a username regex, so no backend change needed.

### 6. Improve DB connection error messages

When `testConnection` fails, translate common PostgreSQL errors into actionable messages:
- `ECONNREFUSED` → "Could not connect to PostgreSQL at [host]:[port]. Make sure PostgreSQL is running."
- `password authentication failed` → "Wrong password for user '[user]'."
- `database "X" does not exist` → "Database '[name]' doesn't exist. Create it in pgAdmin or psql first."
- Other → Show raw message with "Check your connection settings" guidance.

### 7. Require successful connection test before proceeding

Currently, a failed test doesn't block Next. Change: disable Next button on step 1 until connection test succeeds. Re-enable after successful test. If user changes any DB field, reset the test status (require re-test).

---

## Verification

1. Run `npm start` from project root
2. Setup wizard should show 3 steps (no Welcome)
3. Enter DB connection details, test → should show friendly error or success
4. Next button should be disabled until test passes
5. On Admin step, type a username with spaces → should be accepted
6. Type invalid data → inline errors should appear (no alert popups)
7. Complete setup → should launch main window
