/**
 * Local labor / time tracking in localStorage when there is no valid server session.
 * Shapes mirror backend/routes/labor.js responses (camelCase).
 */

import { storage, STORAGE_KEYS } from './storage.js';
import { getWorkOrders } from './sales.js';
import { USER_ROLES, getCurrentUser } from './users.js';

const EMPTY_STATE = () => ({
    schemaVersion: 2,
    shifts: [],
    segments: [],
    miscSegments: []
});

function loadState() {
    const raw = storage.get(STORAGE_KEYS.LABOR_LOCAL, null);
    if (!raw || typeof raw !== 'object') return EMPTY_STATE();
    return {
        schemaVersion: raw.schemaVersion || 2,
        shifts: Array.isArray(raw.shifts) ? raw.shifts : [],
        segments: Array.isArray(raw.segments) ? raw.segments : [],
        miscSegments: Array.isArray(raw.miscSegments) ? raw.miscSegments : []
    };
}

function saveState(state) {
    storage.set(STORAGE_KEYS.LABOR_LOCAL, state, true);
}

function nextId(state) {
    const ids = [
        ...state.shifts.map((s) => Number(s.id) || 0),
        ...state.segments.map((s) => Number(s.id) || 0),
        ...(state.miscSegments || []).map((s) => Number(s.id) || 0)
    ];
    return (ids.length ? Math.max(...ids) : 0) + 1;
}

function dayStr(iso) {
    if (!iso) return '';
    return String(iso).slice(0, 10);
}

function lineKey(lineItemId) {
    if (lineItemId == null || lineItemId === '') return null;
    return Number(lineItemId);
}

function lineMatch(a, b) {
    const la = a == null || a === '' ? null : Number(a);
    const lb = b == null || b === '' ? null : Number(b);
    return la === lb;
}

function resolveWoNumber(workOrderId) {
    const wos = getWorkOrders();
    const wo = wos.find((w) => Number(w.id) === Number(workOrderId));
    return wo?.woNumber ?? null;
}

function woExists(workOrderId) {
    return getWorkOrders().some((w) => Number(w.id) === Number(workOrderId));
}

function getOpenShift(state, userId) {
    return (
        state.shifts.find(
            (s) => Number(s.userId) === Number(userId) && (s.endedAt == null || s.endedAt === '')
        ) || null
    );
}

function mapSegmentToStatusRow(seg, woNumber) {
    return {
        id: seg.id,
        shiftId: seg.shiftId,
        workOrderId: seg.workOrderId,
        workflowStepKey: seg.workflowStepKey,
        lineItemId: seg.lineItemId,
        woNumber: woNumber ?? seg.woNumber ?? null,
        startedAt: seg.startedAt
    };
}

function mapSegmentToHistoryRow(seg) {
    return {
        id: seg.id,
        shiftId: seg.shiftId,
        workOrderId: seg.workOrderId,
        workflowStepKey: seg.workflowStepKey,
        lineItemId: seg.lineItemId,
        woNumber: seg.woNumber ?? resolveWoNumber(seg.workOrderId),
        startedAt: seg.startedAt,
        endedAt: seg.endedAt ?? null
    };
}

function shiftOverlapsRange(shift, fromDay, toDay) {
    const start = dayStr(shift.startedAt);
    if (start > toDay) return false;
    if (shift.endedAt == null || shift.endedAt === '') return true;
    const end = dayStr(shift.endedAt);
    return end >= fromDay;
}

/** @param {number} userId */
export function getStatus(userId) {
    const state = loadState();
    const shift = getOpenShift(state, userId);
    if (!shift) {
        return { shift: null, activeSegments: [], activeMiscSegments: [] };
    }
    const active = state.segments.filter(
        (seg) =>
            Number(seg.shiftId) === Number(shift.id) &&
            (seg.endedAt == null || seg.endedAt === '')
    );
    const activeSegments = active.map((seg) =>
        mapSegmentToStatusRow(seg, seg.woNumber ?? resolveWoNumber(seg.workOrderId))
    );
    const misc = (state.miscSegments || []).filter(
        (m) =>
            Number(m.shiftId) === Number(shift.id) &&
            (m.endedAt == null || m.endedAt === '')
    );
    const activeMiscSegments = misc.map((m) => ({
        id: m.id,
        shiftId: m.shiftId,
        miscTaskId: m.miscTaskId,
        miscTaskTitle: m.miscTaskTitle ?? null,
        startedAt: m.startedAt
    }));
    return {
        shift: {
            id: shift.id,
            startedAt: shift.startedAt,
            endedAt: shift.endedAt ?? null
        },
        activeSegments,
        activeMiscSegments
    };
}

export function clockIn(userId) {
    const state = loadState();
    if (getOpenShift(state, userId)) {
        const err = new Error('Already clocked in');
        err.statusCode = 409;
        throw err;
    }
    const id = nextId(state);
    const startedAt = new Date().toISOString();
    const shift = { id, userId: Number(userId), startedAt, endedAt: null };
    state.shifts.push(shift);
    saveState(state);
    return {
        shift: {
            id: shift.id,
            startedAt: shift.startedAt,
            endedAt: shift.endedAt
        }
    };
}

export function clockOut(userId) {
    const state = loadState();
    const shift = getOpenShift(state, userId);
    const now = new Date().toISOString();
    if (shift) {
        for (const seg of state.segments) {
            if (Number(seg.shiftId) === Number(shift.id) && (seg.endedAt == null || seg.endedAt === '')) {
                seg.endedAt = now;
            }
        }
        for (const m of state.miscSegments || []) {
            if (Number(m.shiftId) === Number(shift.id) && (m.endedAt == null || m.endedAt === '')) {
                m.endedAt = now;
            }
        }
        shift.endedAt = now;
    }
    saveState(state);
    return { clockedOut: true };
}

export function segmentStart(userId, workOrderId, workflowStepKey, lineItemId = null) {
    if (!woExists(workOrderId)) {
        const err = new Error('Work order not found');
        err.statusCode = 404;
        throw err;
    }
    const lineParam = lineKey(lineItemId);
    const woNumber = resolveWoNumber(workOrderId);

    let state = loadState();
    let shift = getOpenShift(state, userId);
    if (!shift) {
        const id = nextId(state);
        const startedAt = new Date().toISOString();
        shift = { id, userId: Number(userId), startedAt, endedAt: null };
        state.shifts.push(shift);
    }

    const now = new Date().toISOString();
    for (const seg of state.segments) {
        if (Number(seg.shiftId) === Number(shift.id) && (seg.endedAt == null || seg.endedAt === '')) {
            seg.endedAt = now;
        }
    }
    for (const m of state.miscSegments || []) {
        if (Number(m.shiftId) === Number(shift.id) && (m.endedAt == null || m.endedAt === '')) {
            m.endedAt = now;
        }
    }

    const segId = nextId(state);
    const newSeg = {
        id: segId,
        shiftId: shift.id,
        userId: Number(userId),
        workOrderId: Number(workOrderId),
        workflowStepKey,
        lineItemId: lineParam,
        woNumber: woNumber ?? undefined,
        startedAt: now,
        endedAt: null
    };
    state.segments.push(newSeg);
    saveState(state);

    const { activeSegments, activeMiscSegments } = getStatus(userId);
    const segRow = activeSegments.find(
        (s) =>
            Number(s.workOrderId) === Number(workOrderId) &&
            s.workflowStepKey === workflowStepKey &&
            lineMatch(s.lineItemId, lineParam)
    );
    return {
        segment: segRow
            ? {
                  id: segRow.id,
                  workOrderId: segRow.workOrderId,
                  workflowStepKey: segRow.workflowStepKey,
                  lineItemId: segRow.lineItemId,
                  startedAt: segRow.startedAt
              }
            : null,
        activeSegments,
        activeMiscSegments
    };
}

function miscTaskKey(id) {
    if (id == null || id === '') return '';
    return String(id);
}

export function miscSegmentStart(userId, miscTaskId, miscTaskTitle = null) {
    const key = miscTaskKey(miscTaskId);
    if (!key) {
        const err = new Error('Misc task id required');
        err.statusCode = 400;
        throw err;
    }

    let state = loadState();
    let shift = getOpenShift(state, userId);
    if (!shift) {
        const id = nextId(state);
        const startedAt = new Date().toISOString();
        shift = { id, userId: Number(userId), startedAt, endedAt: null };
        state.shifts.push(shift);
    }

    const now = new Date().toISOString();
    for (const seg of state.segments) {
        if (Number(seg.shiftId) === Number(shift.id) && (seg.endedAt == null || seg.endedAt === '')) {
            seg.endedAt = now;
        }
    }
    for (const m of state.miscSegments || []) {
        if (Number(m.shiftId) === Number(shift.id) && (m.endedAt == null || m.endedAt === '')) {
            m.endedAt = now;
        }
    }

    if (!state.miscSegments) state.miscSegments = [];
    const rowId = nextId(state);
    const title =
        typeof miscTaskTitle === 'string' && miscTaskTitle.trim() ? miscTaskTitle.trim() : null;
    const newRow = {
        id: rowId,
        shiftId: shift.id,
        userId: Number(userId),
        miscTaskId: key,
        miscTaskTitle: title,
        startedAt: now,
        endedAt: null
    };
    state.miscSegments.push(newRow);
    saveState(state);

    const status = getStatus(userId);
    const miscRow = status.activeMiscSegments.find((m) => miscTaskKey(m.miscTaskId) === key);
    return {
        miscSegment: miscRow
            ? {
                  id: miscRow.id,
                  miscTaskId: miscRow.miscTaskId,
                  miscTaskTitle: miscRow.miscTaskTitle,
                  startedAt: miscRow.startedAt
              }
            : null,
        activeSegments: status.activeSegments,
        activeMiscSegments: status.activeMiscSegments
    };
}

export function miscSegmentStop(userId, miscTaskId) {
    const key = miscTaskKey(miscTaskId);
    const state = loadState();
    const shift = getOpenShift(state, userId);
    if (!shift) {
        saveState(state);
        return { stopped: false };
    }
    const now = new Date().toISOString();
    let stopped = false;
    for (const m of state.miscSegments || []) {
        if (Number(m.shiftId) !== Number(shift.id)) continue;
        if (m.endedAt != null && m.endedAt !== '') continue;
        if (miscTaskKey(m.miscTaskId) !== key) continue;
        m.endedAt = now;
        stopped = true;
        break;
    }
    saveState(state);
    return { stopped };
}

export function segmentStop(userId, workOrderId, workflowStepKey, lineItemId = null) {
    const lineParam = lineKey(lineItemId);
    const state = loadState();
    const shift = getOpenShift(state, userId);
    if (!shift) {
        saveState(state);
        return { stopped: false };
    }
    const now = new Date().toISOString();
    let stopped = false;
    for (const seg of state.segments) {
        if (Number(seg.shiftId) !== Number(shift.id)) continue;
        if (seg.endedAt != null && seg.endedAt !== '') continue;
        if (Number(seg.workOrderId) !== Number(workOrderId)) continue;
        if (seg.workflowStepKey !== workflowStepKey) continue;
        if (!lineMatch(seg.lineItemId, lineParam)) continue;
        seg.endedAt = now;
        stopped = true;
        break;
    }
    saveState(state);
    return { stopped };
}

export function getHistory(userId, fromIsoDate, toIsoDate) {
    const fromDay = dayStr(fromIsoDate);
    const toDay = dayStr(toIsoDate);
    const state = loadState();

    const shifts = state.shifts
        .filter((s) => Number(s.userId) === Number(userId) && shiftOverlapsRange(s, fromDay, toDay))
        .map((s) => ({
            id: s.id,
            userId: s.userId,
            startedAt: s.startedAt,
            endedAt: s.endedAt ?? null
        }));

    const shiftIds = new Set(shifts.map((s) => s.id));
    const segments = state.segments
        .filter((seg) => shiftIds.has(seg.shiftId))
        .map((seg) => mapSegmentToHistoryRow(seg))
        .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));

    const miscSegments = (state.miscSegments || [])
        .filter((m) => shiftIds.has(m.shiftId))
        .map((m) => ({
            id: m.id,
            shiftId: m.shiftId,
            miscTaskId: m.miscTaskId,
            miscTaskTitle: m.miscTaskTitle ?? null,
            startedAt: m.startedAt,
            endedAt: m.endedAt ?? null
        }))
        .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));

    return { shifts, segments, miscSegments };
}

function canEditShiftForLocal(shiftOwnerUserId) {
    const u = getCurrentUser();
    if (!u) return false;
    if (Number(u.id) === Number(shiftOwnerUserId)) return true;
    return u.role === USER_ROLES.ADMINISTRATOR || u.role === USER_ROLES.MACHINIST;
}

/**
 * Manual edit of shop shift clock in/out (same rules as PATCH /api/labor/shift/:id).
 */
export function updateShiftTimes(shiftId, { startedAt, endedAt }) {
    const state = loadState();
    const shift = state.shifts.find((s) => Number(s.id) === Number(shiftId));
    if (!shift) {
        const err = new Error('Shift not found');
        err.statusCode = 404;
        throw err;
    }
    if (!canEditShiftForLocal(shift.userId)) {
        const err = new Error('Access denied');
        err.statusCode = 403;
        throw err;
    }

    const newStart =
        typeof startedAt === 'string' ? startedAt : new Date(startedAt).toISOString();
    const newEnd =
        endedAt !== undefined
            ? endedAt == null
                ? null
                : typeof endedAt === 'string'
                  ? endedAt
                  : new Date(endedAt).toISOString()
            : shift.endedAt;

    if (newEnd != null && new Date(newEnd) < new Date(newStart)) {
        throw new Error('Clock out must be at or after clock in');
    }

    const wasClosed = shift.endedAt != null && shift.endedAt !== '';
    if (wasClosed && newEnd == null) {
        throw new Error('Cannot clear clock out on a completed shift.');
    }

    const wasOpen = shift.endedAt == null || shift.endedAt === '';

    shift.startedAt = new Date(newStart).toISOString();
    shift.endedAt = newEnd == null ? null : new Date(newEnd).toISOString();

    if (shift.endedAt && wasOpen) {
        for (const seg of state.segments) {
            if (
                Number(seg.shiftId) === Number(shiftId) &&
                (seg.endedAt == null || seg.endedAt === '')
            ) {
                seg.endedAt = shift.endedAt;
            }
        }
        for (const m of state.miscSegments || []) {
            if (
                Number(m.shiftId) === Number(shiftId) &&
                (m.endedAt == null || m.endedAt === '')
            ) {
                m.endedAt = shift.endedAt;
            }
        }
    }

    saveState(state);
    return {
        shift: {
            id: shift.id,
            userId: shift.userId,
            startedAt: shift.startedAt,
            endedAt: shift.endedAt
        }
    };
}

export function getTeamForTimeTracking() {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const row = (u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role
    });

    if (
        currentUser.role === USER_ROLES.ADMINISTRATOR ||
        currentUser.role === USER_ROLES.MACHINIST
    ) {
        const users = storage.get(STORAGE_KEYS.USERS_LIST, []) || [];
        return users
            .filter((u) => u.is_active !== false)
            .map(row)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }

    return [row(currentUser)];
}

/**
 * Last shift times for the user (for clock hint when not on shift). Open shift is handled via getStatus.
 */
export function getLastShiftSummary(userId) {
    const state = loadState();
    const mine = state.shifts
        .filter((s) => Number(s.userId) === Number(userId))
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    const open = mine.find((s) => s.endedAt == null || s.endedAt === '');
    if (open) {
        return { onShift: true, shiftStartedAt: open.startedAt };
    }
    const last = mine[0];
    if (!last) {
        return { onShift: false, lastClockInAt: null, lastClockOutAt: null };
    }
    return {
        onShift: false,
        lastClockInAt: last.startedAt,
        lastClockOutAt: last.endedAt ?? null
    };
}

export function getShopPresence() {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const users = storage.get(STORAGE_KEYS.USERS_LIST, []) || [];
    const byId = new Map(users.map((u) => [Number(u.id), u]));
    const state = loadState();

    const openShifts = state.shifts.filter(
        (s) => s.endedAt == null || s.endedAt === ''
    );

    const rows = [];
    for (const sh of openShifts) {
        const u = byId.get(Number(sh.userId));
        if (!u || u.is_active === false) continue;

        const activeSegs = state.segments.filter(
            (seg) =>
                Number(seg.shiftId) === Number(sh.id) &&
                (seg.endedAt == null || seg.endedAt === '')
        );
        const seg = activeSegs[0] || null;

        const activeMisc = (state.miscSegments || []).filter(
            (m) =>
                Number(m.shiftId) === Number(sh.id) &&
                (m.endedAt == null || m.endedAt === '')
        );
        const miscSeg = !seg && activeMisc[0] ? activeMisc[0] : null;

        rows.push({
            userId: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            shiftStartedAt: sh.startedAt,
            currentSegment: seg
                ? {
                      workOrderId: seg.workOrderId,
                      workflowStepKey: seg.workflowStepKey,
                      lineItemId: seg.lineItemId,
                      woNumber: seg.woNumber ?? resolveWoNumber(seg.workOrderId),
                      startedAt: seg.startedAt
                  }
                : null,
            currentMiscSegment: miscSeg
                ? {
                      miscTaskId: miscSeg.miscTaskId,
                      miscTaskTitle: miscSeg.miscTaskTitle ?? null,
                      startedAt: miscSeg.startedAt
                  }
                : null
        });
    }

    rows.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );

    if (
        currentUser.role === USER_ROLES.ADMINISTRATOR ||
        currentUser.role === USER_ROLES.MACHINIST
    ) {
        return rows;
    }
    return rows.filter((r) => Number(r.userId) === Number(currentUser.id));
}
