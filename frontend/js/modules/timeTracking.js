/**
 * Time Tracking — per-user labor history (Machine-style expandable cards)
 */

import {
    showToast,
    showLoadingSpinner,
    DOMCache,
    safeExecute,
    createModal,
    closeModal
} from './common.js';
import {
    getLaborTeam,
    getLaborHistory,
    patchLaborShift,
    canEditLaborShiftForUser
} from './laborApi.js';

const state = {
    expandedUserIds: new Set(),
    isActive: false
};

function formatTime(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return iso;
    }
}

function msBetween(a, b) {
    if (!a || !b) return 0;
    return Math.max(0, new Date(b) - new Date(a));
}

function isoToDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocalToIso(val) {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function groupHistoryByDay(shifts, segments, miscSegments) {
    const days = new Map();

    const dayKey = (iso) => {
        if (!iso) return '';
        return iso.slice(0, 10);
    };

    const ensureDay = (k) => {
        if (!k) return;
        if (!days.has(k)) days.set(k, { date: k, shifts: [], segments: [], miscSegments: [] });
    };

    for (const s of shifts || []) {
        const k = dayKey(s.startedAt);
        if (!k) continue;
        ensureDay(k);
        days.get(k).shifts.push(s);
    }

    for (const seg of segments || []) {
        const k = dayKey(seg.startedAt);
        if (!k) continue;
        ensureDay(k);
        days.get(k).segments.push(seg);
    }

    for (const m of miscSegments || []) {
        const k = dayKey(m.startedAt);
        if (!k) continue;
        ensureDay(k);
        days.get(k).miscSegments.push(m);
    }

    return Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function openEditShiftModal(shift) {
    const modalId = 'editLaborShiftModal';
    const startVal = isoToDatetimeLocal(shift.startedAt);
    const endVal = shift.endedAt ? isoToDatetimeLocal(shift.endedAt) : '';

    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-pen-to-square mr-2" style="color: var(--color-accent-primary);"></i>Edit shop shift
                </h3>
                <button type="button" class="text-gray-400 hover:text-white" data-edit-shift-close>
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-xs mb-4" style="color: var(--color-text-muted);">
                Adjust clock in and clock out. Leave <strong>Clock out</strong> empty only if this shift is still open.
                WO segment rows are not changed automatically.
            </p>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm mb-1" style="color: var(--color-text-muted);">Clock in</label>
                    <input type="datetime-local" id="editLaborShiftStarted"
                        class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        value="${startVal}" />
                </div>
                <div>
                    <label class="block text-sm mb-1" style="color: var(--color-text-muted);">Clock out</label>
                    <input type="datetime-local" id="editLaborShiftEnded"
                        class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        value="${endVal}" />
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm" data-edit-shift-close>Cancel</button>
                <button type="button" id="editLaborShiftSave" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background: var(--color-accent-primary);">Save</button>
            </div>
        </div>
    `;

    createModal(modalId, content, { width: 'w-full max-w-md' });
    const modal = document.getElementById(modalId);
    modal.querySelectorAll('[data-edit-shift-close]').forEach((b) => {
        b.addEventListener('click', () => closeModal(modalId));
    });

    document.getElementById('editLaborShiftSave').addEventListener('click', async () => {
        const startEl = document.getElementById('editLaborShiftStarted');
        const endEl = document.getElementById('editLaborShiftEnded');
        if (!startEl?.value) {
            showToast('Clock in is required', 'warning');
            return;
        }
        const startIso = parseDatetimeLocalToIso(startEl.value);
        if (!startIso) {
            showToast('Invalid clock in time', 'warning');
            return;
        }
        const endTrim = (endEl?.value || '').trim();
        const endedPayload = endTrim === '' ? null : parseDatetimeLocalToIso(endTrim);
        if (endTrim !== '' && !endedPayload) {
            showToast('Invalid clock out time', 'warning');
            return;
        }

        try {
            await patchLaborShift(shift.id, { startedAt: startIso, endedAt: endedPayload });
            closeModal(modalId);
            showToast('Shift times updated', 'success');
            loadTimeTrackingView();
        } catch (e) {
            showToast(e.message || 'Could not save shift', 'error');
        }
    });
}

function renderUserCard(user, historyByDay, expanded, canEdit) {
    const uid = user.id;
    const border = expanded ? 'border-l-4 border-accentGreen' : 'border-l-4 border-gray-600';

    const inner = expanded
        ? `
        <div class="mt-4 space-y-4 text-sm" style="color: var(--color-text-muted);">
            ${historyByDay.length === 0
                ? '<p class="text-gray-500">No labor history in this range.</p>'
                : historyByDay.map((day) => {
                    const shiftMs = (day.shifts || []).reduce((acc, sh) => {
                        const end = sh.endedAt || new Date().toISOString();
                        return acc + msBetween(sh.startedAt, end);
                    }, 0);
                    const segMs = (day.segments || []).reduce((acc, seg) => {
                        const end = seg.endedAt || new Date().toISOString();
                        return acc + msBetween(seg.startedAt, end);
                    }, 0);
                    const miscMs = (day.miscSegments || []).reduce((acc, m) => {
                        const end = m.endedAt || new Date().toISOString();
                        return acc + msBetween(m.startedAt, end);
                    }, 0);
                    const fmtDur = (ms) => {
                        const m = Math.floor(ms / 60000);
                        const h = Math.floor(m / 60);
                        const mm = m % 60;
                        return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
                    };
                    const shiftRows = (day.shifts || [])
                        .map((sh) => {
                            const encStart = encodeURIComponent(sh.startedAt || '');
                            const encEnd = sh.endedAt ? encodeURIComponent(sh.endedAt) : '';
                            const editBtn = canEdit
                                ? `<button type="button" class="text-xs font-medium hover:underline" style="color: var(--color-accent-primary);"
                                    data-action="edit-shift"
                                    data-shift-id="${sh.id}"
                                    data-shift-start="${encStart}"
                                    data-shift-end="${encEnd}">Edit</button>`
                                : '';
                            return `
                        <tr class="border-b border-gray-800">
                            <td class="py-1 pr-2 text-white">${formatTime(sh.startedAt)}</td>
                            <td class="py-1 pr-2">${
                                sh.endedAt
                                    ? formatTime(sh.endedAt)
                                    : '<span class="text-amber-400">On shift</span>'
                            }</td>
                            ${canEdit ? `<td class="py-1 pr-2 text-right">${editBtn}</td>` : ''}
                        </tr>`;
                        })
                        .join('');
                    return `
                    <div class="rounded-lg border border-gray-700 p-3 bg-gray-800/40">
                        <div class="font-medium text-white mb-2">${day.date}</div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            <div><span class="text-gray-500">Shift time (approx):</span> ${fmtDur(shiftMs)}</div>
                            <div><span class="text-gray-500">On work orders:</span> ${fmtDur(segMs)}</div>
                            <div><span class="text-gray-500">Misc tasks:</span> ${fmtDur(miscMs)}</div>
                        </div>
                        <div class="mt-3 overflow-x-auto">
                            <div class="text-xs text-gray-500 mb-1">Shop shift — clock in / clock out</div>
                            <table class="w-full text-xs text-left">
                                <thead>
                                    <tr class="text-gray-500 border-b border-gray-700">
                                        <th class="py-1 pr-2">Clock in</th>
                                        <th class="py-1 pr-2">Clock out</th>
                                        ${canEdit ? '<th class="py-1 pr-2 text-right w-16"></th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${
                                        shiftRows ||
                                        '<tr><td colspan="' +
                                            (canEdit ? '3' : '2') +
                                            '" class="py-2 text-gray-500">No shift recorded this day</td></tr>'
                                    }
                                </tbody>
                            </table>
                        </div>
                        <div class="mt-2 overflow-x-auto">
                            <table class="w-full text-xs text-left">
                                <thead>
                                    <tr class="text-gray-500 border-b border-gray-700">
                                        <th class="py-1 pr-2">WO</th>
                                        <th class="py-1 pr-2">Step</th>
                                        <th class="py-1 pr-2">Start</th>
                                        <th class="py-1 pr-2">End</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(day.segments || [])
                                        .map(
                                            (seg) => `
                                        <tr class="border-b border-gray-800">
                                            <td class="py-1 pr-2 text-white">${seg.woNumber || seg.workOrderId || '—'}</td>
                                            <td class="py-1 pr-2">${seg.workflowStepKey || '—'}</td>
                                            <td class="py-1 pr-2">${formatTime(seg.startedAt)}</td>
                                            <td class="py-1 pr-2">${seg.endedAt ? formatTime(seg.endedAt) : '<span class="text-yellow-400">open</span>'}</td>
                                        </tr>`
                                        )
                                        .join('') || '<tr><td colspan="4" class="py-2 text-gray-500">No segments this day</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                        <div class="mt-2 overflow-x-auto">
                            <div class="text-xs text-gray-500 mb-1">Misc tasks — labor</div>
                            <table class="w-full text-xs text-left">
                                <thead>
                                    <tr class="text-gray-500 border-b border-gray-700">
                                        <th class="py-1 pr-2">Task</th>
                                        <th class="py-1 pr-2">Start</th>
                                        <th class="py-1 pr-2">End</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(day.miscSegments || [])
                                        .map(
                                            (m) => `
                                        <tr class="border-b border-gray-800">
                                            <td class="py-1 pr-2 text-white">${m.miscTaskTitle || m.miscTaskId || '—'}</td>
                                            <td class="py-1 pr-2">${formatTime(m.startedAt)}</td>
                                            <td class="py-1 pr-2">${m.endedAt ? formatTime(m.endedAt) : '<span class="text-yellow-400">open</span>'}</td>
                                        </tr>`
                                        )
                                        .join('') || '<tr><td colspan="3" class="py-2 text-gray-500">No misc task time this day</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
                }).join('')}
        </div>`
        : '';

    return `
        <div class="card p-4 mb-4 ${border}" style="background: var(--color-card-bg, #1f2937);">
            <button type="button" class="w-full flex justify-between items-center text-left" data-action="toggle-time-user" data-user-id="${uid}">
                <div>
                    <h4 class="text-lg font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-user-clock mr-2"></i>${user.name || user.username}
                    </h4>
                    <p class="text-xs mt-1" style="color: var(--color-text-muted);">${user.role} · ${user.username}</p>
                </div>
                <i class="fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-gray-400"></i>
            </button>
            ${inner}
        </div>
    `;
}

export function loadTimeTrackingView() {
    state.isActive = true;
    showLoadingSpinner();

    safeExecute(async () => {
        const container = DOMCache.get('dashboardContent');
        if (!container) return;

        const team = await getLaborTeam();
        const users = Array.isArray(team) ? team : [];

        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);

        const cards = [];
        for (const u of users) {
            let historyByDay = [];
            try {
                const hist = await getLaborHistory(u.id, fromStr, toStr);
                historyByDay = groupHistoryByDay(
                    hist.shifts,
                    hist.segments,
                    hist.miscSegments
                );
            } catch (e) {
                console.warn('Labor history for user', u.id, e);
            }
            const expanded = state.expandedUserIds.has(u.id);
            const canEdit = canEditLaborShiftForUser(u.id);
            cards.push(renderUserCard(u, historyByDay, expanded, canEdit));
        }

        container.innerHTML = `
            <div class="col-span-3">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-clock mr-2"></i>Time Tracking
                        <span class="text-sm ml-2" style="color: var(--color-text-muted);">(last 30 days)</span>
                    </h3>
                </div>
                <p class="text-sm mb-4" style="color: var(--color-text-muted);">
                    Expand a user to see shift and work-order segment times. Administrators and Machinists can <strong>edit shop shift</strong> clock in/out for any user; Operators can edit their own.
                    Without a server session, times are stored in this browser only (<code class="text-xs">bperp_labor_local</code>).
                </p>
                ${cards.join('') || '<p class="text-gray-500">No users to display.</p>'}
            </div>
        `;

        container.querySelectorAll('[data-action="toggle-time-user"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-user-id'), 10);
                if (state.expandedUserIds.has(id)) state.expandedUserIds.delete(id);
                else state.expandedUserIds.add(id);
                loadTimeTrackingView();
            });
        });

        container.querySelectorAll('[data-action="edit-shift"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-shift-id'), 10);
                const startedAt = decodeURIComponent(btn.getAttribute('data-shift-start') || '');
                const endAttr = btn.getAttribute('data-shift-end');
                const endedAt = endAttr && endAttr.length > 0 ? decodeURIComponent(endAttr) : null;
                openEditShiftModal({ id, startedAt, endedAt });
            });
        });
    }, () => showToast('Failed to load time tracking', 'error'), 'loadTimeTrackingView');
}

export function deactivate() {
    state.isActive = false;
}

export function init() {
    // optional
}
