/**
 * BPERP Setup Wizard
 * Handles the first-run setup process
 * Database: SQLite file on NAS (shared across workstations)
 */

// State
let currentStep = 1;
const totalSteps = 3;
let pathTested = false;

const config = {
    database: {
        type: 'sqlite',
        path: ''   // NAS path to folder where bperp.db will live
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
    applyPlatformDefaults();
    updateUI();
});

function applyPlatformDefaults() {
    const pathInput = document.getElementById('dbPath');
    const hintEl = document.getElementById('pathHint');
    if (!pathInput) return;

    if (typeof window.platform !== 'undefined' && window.platform.os === 'win32') {
        pathInput.placeholder = '\\\\NAS\\bperp';
        if (hintEl) hintEl.textContent = 'UNC path to a shared folder (e.g. \\\\NAS\\bperp)';
    } else {
        pathInput.placeholder = '/mnt/nas/bperp';
        if (hintEl) hintEl.textContent = 'Mount path to NAS share (e.g. /mnt/nas/bperp)';
    }
}

function setupEventListeners() {
    // Navigation buttons
    btnBack.addEventListener('click', goBack);
    btnNext.addEventListener('click', goNext);

    // Browse button
    document.getElementById('browsePath')?.addEventListener('click', browsePath);

    // Test path button
    document.getElementById('testPath')?.addEventListener('click', testPath);

    // Password strength
    document.getElementById('adminPassword')?.addEventListener('input', updatePasswordStrength);

    // Password confirmation
    document.getElementById('adminPasswordConfirm')?.addEventListener('input', checkPasswordMatch);

    // Database path input — use 'input' for immediate updates
    document.getElementById('dbPath')?.addEventListener('input', (e) => {
        config.database.path = e.target.value.trim();
        pathTested = false;
        clearFieldError('dbPath');
        updateConnectionStatusReset();
    });

    // Admin form inputs — use 'input' so config updates on every keystroke
    ['adminUsername', 'adminName', 'adminEmail', 'adminPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', (e) => {
            const key = id.replace('admin', '').toLowerCase();
            config.admin[key] = e.target.value;
            clearFieldError(id);
        });
    });

    // Clear confirm password error on input
    document.getElementById('adminPasswordConfirm')?.addEventListener('input', () => {
        clearFieldError('adminPasswordConfirm');
    });
}

// ==================== INLINE ERROR HELPERS ====================

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

// ==================== PATH ERROR TRANSLATION ====================

function translatePathError(errorMessage) {
    if (!errorMessage) return 'Unknown error. Check the path and try again.';

    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        return 'Could not find this path. Make sure the NAS is connected and the share is mounted.';
    }
    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied') || errorMessage.includes('Permission denied')) {
        return 'Cannot write to this location. Check folder permissions on the NAS.';
    }
    if (errorMessage.includes('ENOTDIR')) {
        return 'This path is not a folder. Please select a directory.';
    }
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        return 'Connection timed out. Make sure the NAS is reachable on the network.';
    }
    return errorMessage + ' — Check the path and try again.';
}

// ==================== CONNECTION STATUS RESET ====================

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
    // Update step indicators
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
        }
    });

    // Update step content
    stepContents.forEach((content, index) => {
        content.classList.toggle('active', index + 1 === currentStep);
    });

    // Update progress bar
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressFill.style.width = `${progress}%`;

    // Update buttons
    btnBack.disabled = currentStep === 1;

    if (currentStep === totalSteps) {
        btnNext.innerHTML = 'Launch BPERP →';
    } else {
        btnNext.innerHTML = 'Next →';
    }

    // Update summary on last step
    if (currentStep === totalSteps) {
        updateSummary();
    }
}

async function browsePath() {
    if (window.electronAPI && window.electronAPI.browseDatabasePath) {
        try {
            const result = await window.electronAPI.browseDatabasePath();
            if (result && !result.canceled) {
                const pathInput = document.getElementById('dbPath');
                pathInput.value = result.path;
                config.database.path = result.path;
                pathTested = false;
                clearFieldError('dbPath');
                updateConnectionStatusReset();
            }
        } catch (error) {
            console.error('Browse failed:', error);
        }
    }
}

async function testPath() {
    const statusEl = document.getElementById('connectionStatus');
    const btn = document.getElementById('testPath');

    if (!config.database.path) {
        showFieldError('dbPath', 'Please enter a database path');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Testing...';
    statusEl.className = 'connection-status';
    statusEl.style.display = 'none';

    try {
        if (window.electronAPI && window.electronAPI.testDatabasePath) {
            const result = await window.electronAPI.testDatabasePath(config.database.path);

            statusEl.style.display = 'block';

            if (result.success) {
                statusEl.textContent = '✓ Path is accessible and writable!';
                statusEl.className = 'connection-status success';
                pathTested = true;
            } else {
                statusEl.textContent = '✗ ' + translatePathError(result.error);
                statusEl.className = 'connection-status error';
                pathTested = false;
            }
        } else {
            // Demo mode (no Electron API)
            await new Promise(resolve => setTimeout(resolve, 1000));
            statusEl.style.display = 'block';
            statusEl.textContent = '✓ Path is accessible! (Demo mode)';
            statusEl.className = 'connection-status success';
            pathTested = true;
        }
    } catch (error) {
        console.error('Path test error:', error);
        statusEl.style.display = 'block';
        statusEl.textContent = '✗ ' + translatePathError(error.message);
        statusEl.className = 'connection-status error';
        pathTested = false;
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">📂</span> Test Path';
}

function updatePasswordStrength() {
    const password = document.getElementById('adminPassword').value;
    const strengthEl = document.getElementById('passwordStrength');
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
    const password = document.getElementById('adminPassword').value;
    const confirm = document.getElementById('adminPasswordConfirm').value;
    const matchEl = document.getElementById('passwordMatch');

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
    document.getElementById('summaryDb').textContent =
        config.database.path ? `SQLite — ${config.database.path}` : 'SQLite';
    document.getElementById('summaryAdmin').textContent =
        config.admin.username || 'admin';
}

function validateStep(step) {
    clearAllErrors();

    switch (step) {
        case 1: {
            // Validate database path
            if (!config.database.path) {
                showFieldError('dbPath', 'Database path is required');
                return false;
            }

            if (!pathTested) {
                const statusEl = document.getElementById('connectionStatus');
                statusEl.style.display = 'block';
                statusEl.textContent = 'Please test the path before continuing.';
                statusEl.className = 'connection-status error';
                return false;
            }

            return true;
        }

        case 2: {
            // Validate admin user
            const username = document.getElementById('adminUsername').value.trim();
            const name = document.getElementById('adminName').value.trim();
            const password = document.getElementById('adminPassword').value;
            const confirm = document.getElementById('adminPasswordConfirm').value;
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
                config.admin.email = document.getElementById('adminEmail').value.trim();
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

    if (currentStep < totalSteps) {
        currentStep++;
        updateUI();
    } else {
        // Final step — complete setup
        await completeSetup();
    }
}

async function completeSetup() {
    showLoading('Setting up your database...');

    try {
        if (window.electronAPI) {
            // Run migrations on the SQLite database
            showLoading('Running database migrations...');
            const migrateResult = await window.electronAPI.runMigrations();

            if (!migrateResult.success) {
                console.warn('Migration warning:', migrateResult.output);
                // Don't fail — database might already be set up
            }

            // Complete setup
            showLoading('Finalizing configuration...');
            const result = await window.electronAPI.completeSetup({
                database: config.database,
                admin: config.admin
            });

            if (!result.success) {
                throw new Error(result.error || 'Setup failed');
            }

            // Setup complete — main window will open
            hideLoading();
        } else {
            // Demo mode — simulate setup
            await simulateSetup();
            hideLoading();

            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = 'Setup complete! (Demo mode) In the real application, BPERP would launch now.';
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
    const simSteps = [
        'Setting up your database...',
        'Running database migrations...',
        'Creating admin user...',
        'Finalizing configuration...'
    ];

    for (const step of simSteps) {
        showLoading(step);
        await new Promise(resolve => setTimeout(resolve, 800));
    }
}

function showLoading(text) {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}
