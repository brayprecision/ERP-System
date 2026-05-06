/**
 * Labor / time tracking — API when session is valid, localStorage otherwise (see laborLocal.js)
 */

import * as laborLocal from './laborLocal.js';
import { getCurrentUser, USER_ROLES } from './users.js';

/** Offline/demo login uses `offline_token_*` which is not stored in SQLite — labor routes will 401. */
export function isLaborApiAvailable() {
    const t = localStorage.getItem('bperp_auth_token');
    return Boolean(t && !String(t).startsWith('offline_token_'));
}

function laborErrorMessage(res, json, fallback) {
    if (res.status === 401) {
        return (
            json.error ||
            'Session invalid. If you used offline login, log out and sign in with your server account. Time tracking requires a real session.'
        );
    }
    return json.error || fallback;
}

function authHeaders() {
    const token = localStorage.getItem('bperp_auth_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

function requireLocalUserId() {
    const u = getCurrentUser();
    if (!u?.id) {
        throw new Error('Not logged in');
    }
    return Number(u.id);
}

/** Operator: own shifts only; Admin/Machinist: any user on the team list. */
export function canEditLaborShiftForUser(targetUserId) {
    const u = getCurrentUser();
    if (!u) return false;
    if (Number(u.id) === Number(targetUserId)) return true;
    return u.role === USER_ROLES.ADMINISTRATOR || u.role === USER_ROLES.MACHINIST;
}

export async function patchLaborShift(shiftId, { startedAt, endedAt }) {
    if (isLaborApiAvailable()) {
        const res = await fetch(`${window.API_BASE}/labor/shift/${shiftId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ startedAt, endedAt })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Update shift failed');
        }
        return json.data;
    }
    return laborLocal.updateShiftTimes(shiftId, { startedAt, endedAt });
}

/**
 * For UI hints when not on shift: last clock in / out from recent history.
 */
export async function getLaborShiftSummary() {
    const uid = requireLocalUserId();
    if (isLaborApiAvailable()) {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 120);
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);
        const hist = await getLaborHistory(uid, fromStr, toStr);
        const shifts = (hist.shifts || [])
            .slice()
            .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        const open = shifts.find((s) => !s.endedAt);
        if (open) {
            return { onShift: true, shiftStartedAt: open.startedAt };
        }
        const last = shifts[0];
        if (!last) {
            return { onShift: false, lastClockInAt: null, lastClockOutAt: null };
        }
        return {
            onShift: false,
            lastClockInAt: last.startedAt,
            lastClockOutAt: last.endedAt ?? null
        };
    }
    return laborLocal.getLastShiftSummary(uid);
}

export async function getLaborStatus() {
    if (isLaborApiAvailable()) {
        const res = await fetch(`${window.API_BASE}/labor/status`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Labor status failed'));
        }
        return json.data;
    }
    return laborLocal.getStatus(requireLocalUserId());
}

export async function postLaborClockIn() {
    if (isLaborApiAvailable()) {
        const res = await fetch(`${window.API_BASE}/labor/clock-in`, {
            method: 'POST',
            headers: authHeaders(),
            body: '{}'
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Clock in failed');
        }
        return json.data;
    }
    try {
        return laborLocal.clockIn(requireLocalUserId());
    } catch (e) {
        if (e.statusCode === 409) throw new Error(e.message || 'Already clocked in');
        throw e;
    }
}

export async function postLaborClockOut() {
    if (isLaborApiAvailable()) {
        const res = await fetch(`${window.API_BASE}/labor/clock-out`, {
            method: 'POST',
            headers: authHeaders(),
            body: '{}'
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Clock out failed'));
        }
        return json.data;
    }
    return laborLocal.clockOut(requireLocalUserId());
}

export async function postLaborSegmentStart(workOrderId, workflowStepKey, lineItemId = null) {
    if (isLaborApiAvailable()) {
        const body = { workOrderId, workflowStepKey, lineItemId };
        const res = await fetch(`${window.API_BASE}/labor/segment/start`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Start labor segment failed');
        }
        return json.data;
    }
    try {
        return laborLocal.segmentStart(
            requireLocalUserId(),
            workOrderId,
            workflowStepKey,
            lineItemId
        );
    } catch (e) {
        if (e.statusCode === 404) throw new Error(e.message || 'Work order not found');
        throw e;
    }
}

export async function postLaborMiscSegmentStart(miscTaskId, miscTaskTitle = null) {
    if (isLaborApiAvailable()) {
        const body = { miscTaskId, miscTaskTitle };
        const res = await fetch(`${window.API_BASE}/labor/misc-segment/start`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Start misc labor timer failed'));
        }
        return json.data;
    }
    try {
        return laborLocal.miscSegmentStart(requireLocalUserId(), miscTaskId, miscTaskTitle);
    } catch (e) {
        if (e.statusCode === 400) throw new Error(e.message || 'Invalid misc task');
        throw e;
    }
}

export async function postLaborMiscSegmentStop(miscTaskId) {
    if (isLaborApiAvailable()) {
        const body = { miscTaskId };
        const res = await fetch(`${window.API_BASE}/labor/misc-segment/stop`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Stop misc labor timer failed'));
        }
        return json.data;
    }
    return laborLocal.miscSegmentStop(requireLocalUserId(), miscTaskId);
}

export async function postLaborSegmentStop(workOrderId, workflowStepKey, lineItemId = null) {
    if (isLaborApiAvailable()) {
        const body = { workOrderId, workflowStepKey, lineItemId };
        const res = await fetch(`${window.API_BASE}/labor/segment/stop`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Stop labor segment failed'));
        }
        return json.data;
    }
    return laborLocal.segmentStop(requireLocalUserId(), workOrderId, workflowStepKey, lineItemId);
}

export async function getLaborHistory(userId, fromIsoDate, toIsoDate) {
    if (isLaborApiAvailable()) {
        const q = new URLSearchParams({
            userId: String(userId),
            from: fromIsoDate,
            to: toIsoDate
        });
        const res = await fetch(`${window.API_BASE}/labor/history?${q}`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Labor history failed');
        }
        return json.data;
    }
    return laborLocal.getHistory(userId, fromIsoDate, toIsoDate);
}

export async function getLaborTeam() {
    if (isLaborApiAvailable()) {
        const res = await fetch(`${window.API_BASE}/labor/team`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Team list failed'));
        }
        return json.data;
    }
    return laborLocal.getTeamForTimeTracking();
}

/** Who is on shift and what WO step they are on (Dashboard). */
export async function getLaborPresence() {
    if (isLaborApiAvailable()) {
        const res = await fetch(`${window.API_BASE}/labor/presence`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(laborErrorMessage(res, json, 'Labor presence failed'));
        }
        return json.data;
    }
    return laborLocal.getShopPresence();
}

/** Match an active segment to a workcenter card */
export function laborSegmentMatches(segment, woId, stepKey, lineItemId) {
    if (!segment) return false;
    const li = lineItemId == null || lineItemId === '' ? null : Number(lineItemId);
    const sli = segment.lineItemId == null ? null : Number(segment.lineItemId);
    return (
        Number(segment.workOrderId) === Number(woId) &&
        segment.workflowStepKey === stepKey &&
        sli === li
    );
}

/** Match an active misc labor segment to a misc task row (id from bperp_misc_tasks). */
export function laborMiscSegmentMatches(miscSegment, miscTaskId) {
    if (!miscSegment || miscTaskId == null || miscTaskId === '') return false;
    return String(miscSegment.miscTaskId) === String(miscTaskId);
}
