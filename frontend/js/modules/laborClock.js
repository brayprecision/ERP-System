/**
 * Shop shift clock — sidebar + context bar (#tasksLaborClockBar) on Tasks routes and Work In Progress.
 * No auto clock-out on Electron quit (see electron/main.js).
 */

import {
    getLaborStatus,
    getLaborShiftSummary,
    postLaborClockIn,
    postLaborClockOut
} from './laborApi.js';

let pollTimer = null;

function isLoggedIn() {
    return Boolean(localStorage.getItem('bperp_auth_token'));
}

function formatClockHint(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } catch {
        return iso;
    }
}

function getClockTargets() {
    return [
        { btn: document.getElementById('laborClockBtn'), hint: document.getElementById('laborClockHint') },
        { btn: document.getElementById('tasksLaborClockBtn'), hint: document.getElementById('tasksLaborClockHint') }
    ].filter((x) => x.btn && x.hint);
}

/**
 * @param shift — open shift from getLaborStatus, or null
 * @param summary — from getLaborShiftSummary when shift is null (last times)
 */
function setClockUI(shift, summary) {
    const targets = getClockTargets();
    if (targets.length === 0) return;

    if (!isLoggedIn()) {
        for (const { btn, hint } of targets) {
            btn.disabled = true;
            btn.className =
                'w-full sm:w-auto text-sm font-medium px-3 py-2 rounded-lg bg-gray-700 text-gray-500 cursor-not-allowed';
            btn.innerHTML = '<i class="fa-solid fa-clock mr-2"></i>Log in';
            hint.textContent = '';
        }
        return;
    }

    for (const { btn, hint } of targets) {
        btn.disabled = false;
        if (shift) {
            btn.className =
                'w-full sm:w-auto text-sm font-medium px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white';
            btn.innerHTML = '<i class="fa-solid fa-right-from-bracket mr-2"></i>Clock Out';
            btn.title = 'End your shift (stops all active job timers)';
            hint.textContent = `On shift · since ${formatClockHint(shift.startedAt)}`;
            hint.className = 'text-xs mt-1 text-amber-400/90';
        } else {
            btn.className =
                'w-full sm:w-auto text-sm font-medium px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white';
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i>Clock In';
            btn.title = 'Start your shop shift';
            let hintText = 'Not on shift';
            if (summary && !summary.onShift) {
                if (summary.lastClockOutAt) {
                    hintText = `Last clock out: ${formatClockHint(summary.lastClockOutAt)}`;
                } else if (summary.lastClockInAt) {
                    hintText = `Last clock in: ${formatClockHint(summary.lastClockInAt)}`;
                } else {
                    hintText = 'No shifts recorded yet';
                }
            }
            hint.textContent = hintText;
            hint.className = 'text-xs mt-1 text-gray-500';
        }
    }
}

async function runClockToggle() {
    if (!isLoggedIn()) return;
    try {
        const data = await getLaborStatus();
        if (data.shift) {
            await postLaborClockOut();
            window.BPERP?.common?.showToast?.('Clocked out', 'success');
        } else {
            await postLaborClockIn();
            window.BPERP?.common?.showToast?.('Clocked in', 'success');
        }
        await refreshLaborClockUI();
    } catch (e) {
        window.BPERP?.common?.showToast?.(e.message || 'Labor clock failed', 'error');
    }
}

export async function refreshLaborClockUI() {
    if (!isLoggedIn()) {
        setClockUI(null, null);
        return;
    }
    try {
        const data = await getLaborStatus();
        let summary = null;
        if (!data.shift) {
            try {
                summary = await getLaborShiftSummary();
            } catch {
                summary = null;
            }
        }
        setClockUI(data.shift, summary);
    } catch {
        setClockUI(null, null);
    }
}

function stopPoll() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function startPoll() {
    stopPoll();
    pollTimer = setInterval(() => {
        if (document.getElementById('laborClockBtn') || document.getElementById('tasksLaborClockBtn')) {
            void refreshLaborClockUI();
        }
    }, 30000);
}

function wireButton(btn) {
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
    const fresh = document.getElementById(btn.id);
    if (!fresh) return;
    fresh.addEventListener('click', () => {
        void runClockToggle();
    });
}

export function initLaborClockUI() {
    wireButton(document.getElementById('laborClockBtn'));
    wireButton(document.getElementById('tasksLaborClockBtn'));

    void refreshLaborClockUI();
    startPoll();
}

export function teardownLaborClockUI() {
    stopPoll();
}
