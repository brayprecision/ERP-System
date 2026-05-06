/**
 * REST client for Sales (customers, quotes, work orders) — uses SQLite-backed API when authenticated.
 */

function apiBase() {
    return window.API_BASE || '/api';
}

function authHeaders(extra = {}) {
    const token = localStorage.getItem('bperp_auth_token');
    const h = { 'Content-Type': 'application/json', ...extra };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

async function parseJsonResponse(res) {
    const text = await res.text();
    let body = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = {};
    }
    return { ok: res.ok, status: res.status, body };
}

export function hasAuthToken() {
    const t = localStorage.getItem('bperp_auth_token');
    return !!t && !String(t).startsWith('offline_token_');
}

/**
 * @param {string} path - e.g. '/customers?limit=50'
 * @param {RequestInit} [init]
 */
export async function apiRequest(path, init = {}) {
    const res = await fetch(`${apiBase()}${path}`, {
        ...init,
        headers: { ...authHeaders(), ...init.headers }
    });
    const { ok, status, body } = await parseJsonResponse(res);
    if (!ok) {
        const err = new Error(body.error || `HTTP ${status}`);
        err.status = status;
        err.body = body;
        throw err;
    }
    return body;
}

export async function fetchCustomers(params = 'limit=500') {
    const r = await apiRequest(`/customers?${params}`);
    return r.data || [];
}

export async function fetchCustomer(id) {
    const r = await apiRequest(`/customers/${id}`);
    return r.data;
}

export async function createCustomer(payload) {
    const r = await apiRequest('/customers', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
}

export async function updateCustomer(id, payload) {
    const r = await apiRequest(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return r.data;
}

export async function deleteCustomer(id) {
    await apiRequest(`/customers/${id}`, { method: 'DELETE' });
}

/** Soft-deleted customers (archive). */
export async function fetchArchivedCustomers() {
    const r = await apiRequest('/customers/archived?limit=500');
    return r.data || [];
}

/** Hard delete — Administrator only; customer must already be soft-deleted. */
export async function permanentlyDeleteCustomer(id) {
    await apiRequest(`/customers/${id}/permanent`, { method: 'DELETE' });
}

export async function fetchLeads(params = 'limit=2000') {
    const r = await apiRequest(`/leads?${params}`);
    return r.data || [];
}

export async function fetchLead(id) {
    const r = await apiRequest(`/leads/${id}`);
    return r.data;
}

export async function createLead(payload) {
    const r = await apiRequest('/leads', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
}

export async function updateLead(id, payload) {
    const r = await apiRequest(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return r.data;
}

export async function deleteLead(id) {
    await apiRequest(`/leads/${id}`, { method: 'DELETE' });
}

export async function fetchArchivedLeads() {
    const r = await apiRequest('/leads/archived?limit=500');
    return r.data || [];
}

export async function permanentlyDeleteLead(id) {
    await apiRequest(`/leads/${id}/permanent`, { method: 'DELETE' });
}

export async function fetchQuotes(params = 'limit=500&expand=items') {
    const r = await apiRequest(`/quotes?${params}`);
    return r.data || [];
}

export async function createQuote(payload) {
    const r = await apiRequest('/quotes', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
}

export async function updateQuote(id, payload) {
    const r = await apiRequest(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return r.data;
}

export async function deleteQuote(id) {
    await apiRequest(`/quotes/${id}`, { method: 'DELETE' });
}

export async function fetchWorkOrders(params = 'limit=500&expand=checklist') {
    const r = await apiRequest(`/work-orders?${params}`);
    return r.data || [];
}

export async function createWorkOrder(payload) {
    const r = await apiRequest('/work-orders', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
}

export async function updateWorkOrderChecklistItem(woId, itemId, body) {
    const r = await apiRequest(`/work-orders/${woId}/checklist/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
    return r.data;
}
