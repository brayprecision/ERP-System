/**
 * REST client for /api/inspection-inventory (authenticated).
 */

import { apiRequest, hasAuthToken } from './salesApi.js';

export { hasAuthToken };

export async function fetchInspectionTools(query = '') {
    const q = query ? `?${query}` : '';
    const r = await apiRequest(`/inspection-inventory/tools${q}`);
    return r.data || [];
}

export async function fetchInspectionTool(id) {
    const r = await apiRequest(`/inspection-inventory/tools/${id}`);
    return r.data;
}

export async function createInspectionTool(payload) {
    const r = await apiRequest('/inspection-inventory/tools', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return r.data;
}

export async function updateInspectionTool(id, payload) {
    const r = await apiRequest(`/inspection-inventory/tools/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    return r.data;
}

export async function deleteInspectionTool(id) {
    await apiRequest(`/inspection-inventory/tools/${id}`, { method: 'DELETE' });
}

export async function uploadInspectionDocument(toolId, file, meta = {}) {
    const token = localStorage.getItem('bperp_auth_token');
    const form = new FormData();
    form.append('file', file);
    if (meta.title) form.append('title', meta.title);
    if (meta.documentType) form.append('documentType', meta.documentType);

    const res = await fetch(
        `${window.API_BASE || '/api'}/inspection-inventory/tools/${toolId}/documents`,
        {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form
        }
    );
    const text = await res.text();
    let body = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = {};
    }
    if (!res.ok) {
        const err = new Error(body.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return body.data;
}

export async function deleteInspectionDocument(toolId, docId) {
    await apiRequest(`/inspection-inventory/tools/${toolId}/documents/${docId}`, { method: 'DELETE' });
}

export async function fetchCalibrationReminders() {
    const r = await apiRequest('/inspection-inventory/calibration-reminders');
    return r.data || [];
}

export async function postSyncCalibrationReminders() {
    const r = await apiRequest('/inspection-inventory/sync-calibration-reminders', { method: 'POST' });
    return r.data;
}

export async function downloadInspectionDocumentFile(toolId, docId, originalFilename) {
    const token = localStorage.getItem('bperp_auth_token');
    const res = await fetch(
        `${window.API_BASE || '/api'}/inspection-inventory/tools/${toolId}/documents/${docId}/file`,
        {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
    );
    if (!res.ok) {
        throw new Error('Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalFilename || 'document';
    a.click();
    URL.revokeObjectURL(url);
}
