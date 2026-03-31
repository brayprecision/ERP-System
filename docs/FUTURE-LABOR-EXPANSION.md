# Future work — labor & non-WO time

Planned extensions (not implemented yet). Current behavior: **shop shifts** and **work-order process segments** only (`/api/labor/*` and local `bperp_labor_local`).

## Quoting time

- Track time against **quotes** (e.g. estimating, revisions, customer calls) without tying to a work order.
- Likely needs: segment type or `quote_id` + activity key, UI entry points on **Sales → Quotes**, reporting on Time Tracking or a dedicated report.
- Consider whether quotes are **localStorage-only** or SQLite-backed in your deployment before schema work.

## Product design time

- Track **design / engineering** hours (CAD, programming, DFM) that may span multiple WOs or no WO yet.
- Options: link to **parts/products**, **quotes**, or **misc** buckets; optional **project** or **ticket** id later.
- UI: Tasks or a **Design** sub-area; avoid overloading WO-only segments.

## Cross-cutting

- **Sync**: localStorage labor rows → SQLite when a real session exists (migration tool).
- **Dashboard / presence**: extend presence payloads if non-WO activities should appear (“On quote Q-123”).
- **Permissions**: who can log design vs shop floor time.

Update this doc when any of the above ships.
