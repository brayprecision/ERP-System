# Release Audit — BPERP 1.0.0-beta.2

**Date:** 2026-05-11  
**Branch:** Auto_Updater  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Target version:** 1.0.0-beta.2  
**Current version in package.json:** 1.0.0-beta.1 (bump required)

---

## Pass / Fail Summary

| Check | Result | Notes |
|---|---|---|
| Backend unit tests | PARTIAL PASS | 1 of 6 suites run; 63 tests pass. 5 suites blocked by native module ABI mismatch |
| TypeScript typecheck | WARN | tsconfig.json points to deleted `src/` directory — stale config, not a code error |
| ESLint / Prettier | N/A | No lint config exists in repo |
| Production build (pack:win) | PASS | Installer produced: `BPERP-1.0.0-beta.1-win-x64.exe` |
| Secret scan — tracked files | PASS | No credentials, API keys, or private keys found |
| Secret scan — git history | PASS (minor note) | Deleted: `Sales Prospect List.pdf` — still in git history, not credentials |
| npm audit — root (build tools) | WARN | 19 vulns: Electron 28.1.0 has 17 CVEs; all require breaking upgrade |
| npm audit — backend (production) | WARN | 8 vulns: `xlsx` HIGH with no fix; `express-rate-limit` bypass fixable |
| Electron security — nodeIntegration | PASS | `false` on all 3 windows |
| Electron security — contextIsolation | PASS | `true` on all 3 windows |
| Electron security — sandbox | WARN | Not explicitly set; relies on Electron 28 default |
| Electron security — CSP | FAIL | No Content-Security-Policy in any of the 4 HTML files |
| Electron security — openExternal | WARN | Exposed in preload without URL allowlist |
| Electron security — remote content | PASS | App loads from localhost only |
| Product completeness | PASS | All 13 routes + 14 frontend modules present; no placeholder UI |
| Known Issues docs | WARN | README "Known Issues" section is outdated |

**Overall confidence for internal beta release: MODERATE — ship after resolving the 2 blocking items below.**

---

## Blocking Issues

### 1. Missing Content-Security-Policy (CSP) in all HTML files

**Files:**
- [electron/splash.html](../electron/splash.html)
- [electron/setup-wizard/wizard.html](../electron/setup-wizard/wizard.html)
- [electron/offline.html](../electron/offline.html)
- [frontend/index.html](../frontend/index.html)

**Risk:** If any renderer-side code has an XSS vulnerability, there is no CSP to limit script execution. Electron's built-in protections (contextIsolation, nodeIntegration=false) are the only mitigation.

**Fix:** Add to each `<head>`:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*;">
```
Adjust `connect-src` for network/NAS mode to include the configured server URL.

**Effort:** ~20 minutes across 4 files.

---

### 2. `better-sqlite3` ABI mismatch prevents 5 of 6 test suites from running

**Root cause:** `backend/node_modules/better-sqlite3` was compiled for Node.js v18 (ABI 119). The dev machine runs Node.js v24 (ABI 137). `npm rebuild` fails because **ClangCL build tools are not installed** in VS Build Tools 2022.

**Result:** Only `importHelpers.test.js` (63 tests, no SQLite dependency) runs. The remaining 5 suites covering auth middleware, validation, routes, users, and labor all fail with:
> `The module was compiled against a different Node.js version... NODE_MODULE_VERSION 119 vs 137`

**This does NOT affect the packaged Electron app** — `rebuild-backend-native.js` correctly rebuilds for Electron's ABI. But it means auth, validation, and route logic are unverified by automated tests in the current dev environment.

**Fix options:**
- Install ClangCL: VS Build Tools 2022 → Modify → "Desktop development with C++" → add LLVM/Clang component
- OR: Run tests in a Docker container / WSL2 with Node.js 18 + build tools (matches the pre-built binary ABI)

**Effort:** 30–60 minutes to install ClangCL and verify.

---

## Non-Blocking Issues (Recommended Fixes)

### Security

#### S1 — Electron 28.1.0 has 17 known CVEs
Electron ≤ 39.8.4 has advisories including ASAR integrity bypass, service worker IPC spoofing, use-after-free in several callbacks, and unquoted executable path on Windows. Fix requires upgrading to Electron ≥ 40.x (breaking change in electron-builder config and possibly IPC APIs).

**Risk for this deployment:** MODERATE — the app uses contextIsolation=true and nodeIntegration=false, which mitigates the most severe renderer-side CVEs. The app also runs entirely offline/LAN. Upgrade is strongly recommended before any broader rollout.

**Advisory:** `npm audit fix --force` in root will install Electron 42.x — test thoroughly before shipping.

#### S2 — `xlsx` (backend) has HIGH vulnerability with no fix available
`xlsx@0.18.5`: prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9). No patched version exists. Used in the CSV/Excel import feature (`backend/routes/import.js`).

**Risk:** Import is an admin-only feature and the input comes from trusted shop staff uploading their own files. Risk is low in practice. Watch for a maintained fork (`exceljs`, `xlsx-js-style`, `@e965/xlsx`).

#### S3 — `express-rate-limit` bypass via IPv6-mapped IPv4 (GHSA-46wh-pxpv-q5gq)
Clients can send requests as `::ffff:127.0.0.1` (IPv6-mapped IPv4) to bypass per-IP rate limiting. Fix: `npm audit fix` in backend updates `express-rate-limit` to ≥ 8.5.1.

**Fix:** `cd backend && npm audit fix` — non-breaking, run before release.

#### S4 — `openExternal(url)` exposed in preload without allowlist
[electron/preload.js](../electron/preload.js) exposes `window.electronAPI.openExternal(url)` with no protocol or domain check. A malicious page loaded in the renderer could call this to open arbitrary URLs in the default browser.

**Risk for this deployment:** LOW — the renderer loads from localhost only. Worth adding a `url.startsWith('https://') || url.startsWith('http://')` guard.

#### S5 — Business document in git history
`Sales Prospect List.pdf` was committed in `a8058ff` and deleted in the same commit. It remains accessible via `git show a8058ff:Sales\ Prospect\ List.pdf`. If the repo ever becomes public, this is a privacy concern. Run `git filter-repo` to scrub if needed.

### Code Quality

#### Q1 — Stale `tsconfig.json` points to deleted `src/` directory
`backend/tsconfig.json` has `"include": ["src/**/*"]` but `src/` was deleted during the SQLite migration cleanup (Mar 2, 2026). Running `tsc --noEmit` gives `TS18003: No inputs were found`. The backend is plain JS so this doesn't block functionality, but it means TypeScript type checking produces no output at all.

**Fix:** Either update `tsconfig.json` to point to the JS route files (with `"allowJs": true, "checkJs": true`) or remove/archive the tsconfig.

#### Q2 — No ESLint or Prettier configuration
No linting enforcement beyond TypeScript strict mode (which is currently non-functional per Q1). Code style is consistent but not enforced.

#### Q3 — `console.log` statements not gated by `NODE_ENV`
Production logs appear in Electron DevTools. Notable instances: `electron/preload.js:245-256` (preload loaded messages), `frontend/js/app.js:123,138,162` (module loading), `backend/db.js:43` (DB connect). These are helpful for debugging but verbose in production.

#### Q4 — README "Known Issues" section is outdated
[README.md](../README.md) states "Backup/Restore not yet fully implemented" — it is now fully implemented (`backend/server.js:568-733`). Update before release.

#### Q5 — Version mismatch: `backend/package.json` = `1.0.0`
Root `package.json` is `1.0.0-beta.1`; `backend/package.json` is `1.0.0`. Both should be bumped to `1.0.0-beta.2` before release.

---

## Production Build Results

```
Command:   npm run pack:win
Status:    SUCCESS
Output:    dist-installers/BPERP-1.0.0-beta.1-win-x64.exe
           dist-installers/win-unpacked/BPERP.exe
Electron:  28.3.3
Platform:  win32 x64
Native:    better-sqlite3 rebuilt for Electron ABI via scripts/rebuild-backend-native.js
```

The build pipeline works end-to-end. The custom `rebuild-backend-native.js` script correctly uses prebuilt Electron-compatible binaries rather than compiling from source, avoiding the ClangCL dependency at packaging time.

---

## Test Results

```
Suite: tests/unit/importHelpers.test.js
Status: PASS
Tests:  63 passed, 0 failed

Suite: tests/middleware/auth.test.js     → FAIL (better-sqlite3 ABI mismatch)
Suite: tests/middleware/validation.test.js → FAIL (better-sqlite3 ABI mismatch)
Suite: tests/routes/import.test.js      → FAIL (better-sqlite3 ABI mismatch)
Suite: tests/routes/users.test.js       → FAIL (better-sqlite3 ABI mismatch)
Suite: tests/routes/labor.test.js       → FAIL (better-sqlite3 ABI mismatch)

Root cause: better-sqlite3 compiled for Node.js ABI 119 (v18); system is ABI 137 (v24).
Fix: Install ClangCL in VS Build Tools 2022, then run: cd backend && npm rebuild
```

---

## Vulnerability Summary

### Root (build tools only — not shipped in installer)

| Severity | Count | Notable packages |
|---|---|---|
| High | 14 | Electron 28.1.0 (17 CVEs), lodash, tar, minimatch, fast-uri, @xmldom/xmldom |
| Moderate | 1 | brace-expansion |
| Low | 4 | Various |

**Note:** The majority of these are in `electron-builder` devDependencies and are not included in the packaged installer. The Electron runtime itself (28.3.3) is the exception — it IS shipped.

### Backend (production — shipped in installer)

| Severity | Count | Notable packages |
|---|---|---|
| High | 5 | xlsx (no fix), express-rate-limit, path-to-regexp, picomatch (Jest devDep), minimatch (Jest devDep) |
| Moderate | 2 | ip-address, brace-expansion |
| Low | 1 | qs |

**Trivy:** Not installed on this machine; npm audit used as fallback.

---

## Recommended Fixes Before Release

**Do before shipping:**
1. Add CSP `<meta>` tag to all 4 HTML files (20 min) — see Blocking Issue #1
2. Run `cd backend && npm audit fix` — fixes express-rate-limit, path-to-regexp, picomatch, brace-expansion (non-breaking)
3. Bump version to `1.0.0-beta.2` in root `package.json` and `backend/package.json`
4. Update README "Known Issues" section

**Do soon after:**
5. Install ClangCL so backend tests can run, then verify all 6 suites pass
6. Upgrade Electron to ≥ 40.x (requires testing the full app)
7. Replace `xlsx` with a maintained alternative (exceljs or @e965/xlsx)
8. Add URL validation to `openExternal` in preload.js

---

## Git History Note

No credentials, tokens, or private keys were found in any tracked file or deleted-file history. One business document (`Sales Prospect List.pdf`) was committed and deleted in the same commit `a8058ff`. It remains recoverable from git history — run `git filter-repo --path "Sales Prospect List.pdf" --invert-paths` to remove it permanently if the repo ever becomes public.

---

## Release Notes (commits since initial commit — no prior tags exist)

- Auto updater work
- Project Audit and Revision
- Backup db file add
- Fix Electron build: use prebuilt native modules, prevent frontend caching after reinstall
- feat(sales): persist Leads in SQLite with CRUD, archive tab, and offline parity
- sales: SQLite/API alignment, salesApi module, Settings Archive, customer soft+permanent delete
- feat(labor): Tasks shop clock bar, shift hints, no auto clock-out on Electron quit
- feat(tasks): machining machine picker, rollback, WO tasks; fix Machines nav
- feat(ui): Tasks filters & recurring misc; Machines WIP-style cards and maintenance CRUD
- feat(dev): standalone wizard, Electron native rebuild, migration fix
- Add Products and Parts inventory with BOM support
- feat: Option A - Central backend on NAS restructure
- Ditch Postgres → SQLite on NAS

---

## Confidence Level for Release

**Internal beta (shop LAN, trusted users): MODERATE-HIGH**

The application is functionally complete for a beta. The production build works, no secrets are exposed, and the core security model (contextIsolation + nodeIntegration=false) is sound. The primary concerns are:

- CSP is missing (fix is quick and straightforward)
- Most backend tests can't run in the current dev environment due to the ABI mismatch
- Electron 28.x has known CVEs that should be addressed in a follow-up release

**Recommended action:** Fix the 2 blocking items and the `npm audit fix` (S3), then release `1.0.0-beta.2` to the shop. Plan Electron upgrade for `1.0.0-beta.3`.
