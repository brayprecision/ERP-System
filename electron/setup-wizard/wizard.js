/**
 * BPERP Setup Wizard
 * Handles the first-run setup process
 * Supports standalone (local) and network (NAS) modes
 */

// State
let currentStep = 1;
const totalSteps = 3;
let connectionTested = false;
let setupAlreadyComplete = false;  // When true, skip admin step

const config = {
    mode: 'standalone',  // 'standalone' or 'network'
    server: {
        url: ''
    },
    admin: {
        username: '',
        name: '',
        email: '',
        password: ''
    }
};

// Elements
const steps = document.querySelectorAll('.step');
const stepContents = document.querySelectorAll('.step-content');
const progressFill = document.querySelector('.progress-fill');
const btnBack = document.getElementById('btnBack');
const btnNext = document.getElementById('btnNext');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateUI();
});

function setupEventListeners() {
    btnBack.addEventListener('click', goBack);
    btnNext.addEventListener('click', goNext);

    // Mode picker cards
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            config.mode = card.dataset.mode;

            const networkConfig = document.getElementById('networkConfig');
            if (config.mode === 'network') {
                networkConfig.classList.remove('hidden');
            } else {
                networkConfig.classList.add('hidden');
                connectionTested = false;
                config.server.url = '';
                updateConnectionStatusReset();
            }
        });
    });

    document.getElementById('testConnection')?.addEventListener('click', testConnection);

    document.getElementById('adminPassword')?.addEventListener('input', updatePasswordStrength);
    document.getElementById('adminPasswordConfirm')?.addEventListener('input', checkPasswordMatch);

    document.getElementById('serverUrl')?.addEventListener('input', (e) => {
        config.server.url = e.target.value.trim();
        connectionTested = false;
        clearFieldError('serverUrl');
        updateConnectionStatusReset();
    });

    ['adminUsername', 'adminName', 'adminEmail', 'adminPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', (e) => {
            const key = id.replace('admin', '').toLowerCase();
            config.admin[key] = e.target.value;
            clearFieldError(id);
        });
    });

    document.getElementById('adminPasswordConfirm')?.addEventListener('input', () => {
        clearFieldError('adminPasswordConfirm');
    });
}

// ==================== ERROR HELPERS ====================

function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.classList.add('error');
    const errorEl = input.closest('.form-group')?.querySelector('.error-message');
    if (errorEl) errorEl.textContent = message;
}

function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.classList.remove('error');
    const errorEl = input.closest('.form-group')?.querySelector('.error-message');
    if (errorEl) errorEl.textContent = '';
}

function clearAllErrors() {
    document.querySelectorAll('.form-group input.error').forEach(input => {
        input.classList.remove('error');
    });
    document.querySelectorAll('.form-group .error-message').forEach(el => {
        el.textContent = '';
    });
}

function updateConnectionStatusReset() {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl && statusEl.style.display === 'block') {
        statusEl.style.display = 'none';
        statusEl.className = 'connection-status';
        statusEl.textContent = '';
    }
}

// ==================== UI ====================

function updateUI() {
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
        }
    });

    stepContents.forEach((content, index) => {
        content.classList.toggle('active', index + 1 === currentStep);
    });

    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressFill.style.width = `${progress}%`;

    btnBack.disabled = currentStep === 1;

    if (currentStep === totalSteps) {
        btnNext.innerHTML = 'Launch BPERP →';
    } else {
        btnNext.innerHTML = 'Next →';
    }

    if (currentStep === totalSteps) {
        updateSummary();
    }
}

async function testConnection() {
    const statusEl = document.getElementById('connectionStatus');
    const btn = document.getElementById('testConnection');
    const urlInput = document.getElementById('serverUrl');
    const url = (urlInput?.value || config.server.url || '').trim();

    if (!url) {
        showFieldError('serverUrl', 'Please enter a server URL');
        return;
    }

    // Normalize URL
    let normalizedUrl = url.replace(/\/$/, '');
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'http://' + normalizedUrl;
    }
    config.server.url = normalizedUrl;
    if (urlInput) urlInput.value = normalizedUrl;

    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Testing...';
    statusEl.className = 'connection-status';
    statusEl.style.display = 'none';

    try {
        if (window.electronAPI?.testServerConnection) {
            const result = await window.electronAPI.testServerConnection(normalizedUrl);
            statusEl.style.display = 'block';

            if (result.success) {
                statusEl.textContent = '✓ Connected successfully!';
                statusEl.className = 'connection-status success';
                connectionTested = true;
            } else {
                statusEl.textContent = '✗ ' + (result.error || 'Connection failed');
                statusEl.className = 'connection-status error';
                connectionTested = false;
            }
        } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            statusEl.style.display = 'block';
            statusEl.textContent = '✓ Connected! (Demo mode)';
            statusEl.className = 'connection-status success';
            connectionTested = true;
        }
    } catch (error) {
        console.error('Connection test error:', error);
        statusEl.style.display = 'block';
        statusEl.textContent = '✗ ' + (error.message || 'Connection failed');
        statusEl.className = 'connection-status error';
        connectionTested = false;
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔗</span> Test Connection';
}

/** Avoid hanging on unreachable NAS (unbounded fetch). */
function fetchWithTimeout(url, ms = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

async function fetchSetupStatus() {
    const baseUrl = config.server.url.replace(/\/$/, '');
    try {
        const res = await fetchWithTimeout(baseUrl + '/api/setup/status', 8000);
        const data = await res.json();
        return data.setupComplete === true;
    } catch (e) {
        return false;
    }
}

function updatePasswordStrength() {
    const password = document.getElementById('adminPassword')?.value || '';
    const strengthEl = document.getElementById('passwordStrength');
    if (!strengthEl) return;
    const textEl = strengthEl.querySelector('.strength-text');

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    strengthEl.classList.remove('weak', 'medium', 'strong');
    if (password.length === 0) {
        textEl.textContent = 'Enter a password';
    } else if (strength < 3) {
        strengthEl.classList.add('weak');
        textEl.textContent = 'Weak password';
    } else if (strength < 5) {
        strengthEl.classList.add('medium');
        textEl.textContent = 'Medium password';
    } else {
        strengthEl.classList.add('strong');
        textEl.textContent = 'Strong password';
    }
    config.admin.password = password;
}

function checkPasswordMatch() {
    const password = document.getElementById('adminPassword')?.value || '';
    const confirm = document.getElementById('adminPasswordConfirm')?.value || '';
    const matchEl = document.getElementById('passwordMatch');
    if (!matchEl) return;

    if (confirm.length === 0) {
        matchEl.textContent = '';
    } else if (password === confirm) {
        matchEl.textContent = '✓ Passwords match';
        matchEl.style.color = 'var(--success)';
    } else {
        matchEl.textContent = '✗ Passwords do not match';
        matchEl.style.color = 'var(--error)';
    }
}

function updateSummary() {
    const modeEl = document.getElementById('summaryMode');
    const serverRow = document.getElementById('summaryServerRow');
    const serverEl = document.getElementById('summaryServer');
    const adminEl = document.getElementById('summaryAdmin');

    if (modeEl) {
        modeEl.textContent = config.mode === 'standalone'
            ? 'Standalone (this computer)'
            : 'Network (NAS)';
    }
    if (serverRow) {
        serverRow.style.display = config.mode === 'standalone' ? 'none' : 'flex';
    }
    if (serverEl) serverEl.textContent = config.server.url || '—';
    if (adminEl) {
        adminEl.textContent = setupAlreadyComplete ? 'Already configured' : (config.admin.username || 'admin');
    }
}

function validateStep(step) {
    clearAllErrors();

    switch (step) {
        case 1: {
            if (config.mode === 'standalone') {
                return true;
            }
            // Network mode requires URL + connection test
            if (!config.server.url) {
                showFieldError('serverUrl', 'Server URL is required');
                return false;
            }
            if (!connectionTested) {
                const statusEl = document.getElementById('connectionStatus');
                statusEl.style.display = 'block';
                statusEl.textContent = 'Please test the connection before continuing.';
                statusEl.className = 'connection-status error';
                return false;
            }
            return true;
        }

        case 2: {
            if (setupAlreadyComplete) return true;

            const username = document.getElementById('adminUsername')?.value.trim() || '';
            const name = document.getElementById('adminName')?.value.trim() || '';
            const password = document.getElementById('adminPassword')?.value || '';
            const confirm = document.getElementById('adminPasswordConfirm')?.value || '';
            let valid = true;

            if (!username) {
                showFieldError('adminUsername', 'Username is required');
                valid = false;
            } else if (!/^[a-zA-Z0-9_ .]+$/.test(username)) {
                showFieldError('adminUsername', 'Username can only contain letters, numbers, spaces, underscores, and dots');
                valid = false;
            }
            if (!name) {
                showFieldError('adminName', 'Display name is required');
                valid = false;
            }
            if (password.length < 8) {
                showFieldError('adminPassword', 'Password must be at least 8 characters');
                valid = false;
            }
            if (password !== confirm) {
                showFieldError('adminPasswordConfirm', 'Passwords do not match');
                valid = false;
            }

            if (valid) {
                config.admin.username = username;
                config.admin.name = name;
                config.admin.email = document.getElementById('adminEmail')?.value.trim() || '';
                config.admin.password = password;
            }
            return valid;
        }

        case 3:
            return true;

        default:
            return true;
    }
}

function goBack() {
    if (currentStep > 1) {
        currentStep--;
        updateUI();
    }
}

async function goNext() {
    if (!validateStep(currentStep)) {
        return;
    }

    if (currentStep === 1) {
        if (config.mode === 'standalone') {
            // Standalone: always need to create admin locally
            setupAlreadyComplete = false;
            currentStep = 2;
        } else {
            // Network: check if setup is already complete on remote (admin exists)
            setupAlreadyComplete = await fetchSetupStatus();
            if (setupAlreadyComplete) {
                currentStep = 3;
            } else {
                currentStep = 2;
            }
        }
    } else if (currentStep < totalSteps) {
        currentStep++;
    } else {
        await completeSetup();
    }
    updateUI();
}

const SETUP_IPC_TIMEOUT_MS = 120000;

async function completeSetup() {
    const loadingMsg = config.mode === 'standalone'
        ? 'Starting local server...'
        : 'Connecting to BPERP...';
    showLoading(loadingMsg);

    try {
        if (window.electronAPI) {
            showLoading('Finalizing configuration...');
            const result = await Promise.race([
                window.electronAPI.completeSetup({
                    mode: config.mode,
                    server: config.server,
                    admin: setupAlreadyComplete ? null : config.admin
                }),
                new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    'Setup timed out after 2 minutes. See bperp.log in your user data folder (Help → View Logs, or Settings → About this app).'
                                )
                            ),
                        SETUP_IPC_TIMEOUT_MS
                    )
                )
            ]);

            if (!result.success) {
                throw new Error(result.error || 'Setup failed');
            }
            hideLoading();
        } else {
            await simulateSetup();
            hideLoading();
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = 'Setup complete! (Demo mode)';
                statusEl.className = 'connection-status success';
            }
        }
    } catch (error) {
        console.error('Setup failed:', error);
        hideLoading();
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.textContent = 'Setup failed: ' + error.message;
            statusEl.className = 'connection-status error';
        }
    }
}

async function simulateSetup() {
    for (const step of ['Connecting...', 'Finalizing...']) {
        showLoading(step);
        await new Promise(resolve => setTimeout(resolve, 600));
    }
}

function showLoading(text) {
    if (loadingText) loadingText.textContent = text;
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}
