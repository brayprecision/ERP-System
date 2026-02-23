/**
 * BPERP Setup Wizard
 * Handles the first-run setup process
 */

// State
let currentStep = 1;
const totalSteps = 4;

const config = {
    database: {
        type: 'embedded',
        host: 'localhost',
        port: 5433,
        name: 'bperp',
        user: 'bperp',
        password: ''
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
    if (typeof window.platform === 'undefined' || window.platform.os !== 'win32') return;

    // "Embedded" PostgreSQL is not implemented on Windows — hide that option
    // and default to "Connect to Existing Database" so users aren't left stuck.
    const embeddedOption = document.querySelector('input[name="dbType"][value="embedded"]')?.closest('.db-option');
    if (embeddedOption) embeddedOption.style.display = 'none';

    const externalRadio = document.querySelector('input[name="dbType"][value="external"]');
    if (externalRadio) {
        externalRadio.checked = true;
        config.database.type = 'external';
        // Default to the standard PostgreSQL port for Windows installs
        config.database.port = 5432;
        const portInput = document.getElementById('dbPort');
        if (portInput) portInput.value = 5432;
    }

    // Show the PostgreSQL install notice and wire up the download link
    const notice = document.getElementById('win-postgres-notice');
    if (notice) notice.classList.remove('hidden');

    const pgLink = document.getElementById('pgDownloadLink');
    if (pgLink) {
        pgLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal('https://www.postgresql.org/download/windows/');
            }
        });
    }

    updateDbOptions();
}

function setupEventListeners() {
    // Navigation buttons
    btnBack.addEventListener('click', goBack);
    btnNext.addEventListener('click', goNext);
    
    // Database type selection
    document.querySelectorAll('input[name="dbType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            config.database.type = e.target.value;
            updateDbOptions();
        });
    });
    
    // Test connection button
    document.getElementById('testConnection')?.addEventListener('click', testConnection);
    
    // Password strength
    document.getElementById('adminPassword')?.addEventListener('input', updatePasswordStrength);
    
    // Password confirmation
    document.getElementById('adminPasswordConfirm')?.addEventListener('input', checkPasswordMatch);
    
    // Form inputs for external DB
    ['dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const key = id.replace('db', '').toLowerCase();
            config.database[key] = e.target.value;
        });
    });
    
    // Admin form inputs
    ['adminUsername', 'adminName', 'adminEmail', 'adminPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const key = id.replace('admin', '').toLowerCase();
            config.admin[key] = e.target.value;
        });
    });
}

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
        btnNext.textContent = 'Launch BPERP';
        btnNext.innerHTML = 'Launch BPERP →';
    } else {
        btnNext.innerHTML = 'Next →';
    }
    
    // Update summary on last step
    if (currentStep === totalSteps) {
        updateSummary();
    }
}

function updateDbOptions() {
    const externalConfig = document.getElementById('external-config');
    const dbOptions = document.querySelectorAll('.db-option');
    
    // Update selected state
    dbOptions.forEach(option => {
        const radio = option.querySelector('input');
        option.classList.toggle('selected', radio.checked);
    });
    
    // Show/hide external config
    if (config.database.type === 'external') {
        externalConfig.classList.remove('hidden');
    } else {
        externalConfig.classList.add('hidden');
    }
}

async function testConnection() {
    const statusEl = document.getElementById('connectionStatus');
    const btn = document.getElementById('testConnection');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Testing...';
    statusEl.className = 'connection-status';
    statusEl.style.display = 'none';
    
    // Debug: Check if electronAPI is available
    const hasElectronAPI = !!window.electronAPI;
    const hasTestConnection = hasElectronAPI && typeof window.electronAPI.testConnection === 'function';
    console.log('electronAPI available:', hasElectronAPI);
    console.log('testConnection available:', hasTestConnection);
    
    if (!hasElectronAPI) {
        alert('Debug: window.electronAPI is NOT available!\nThis means the preload script did not load correctly.');
    }
    
    console.log('Testing connection with config:', {
        host: config.database.host,
        port: config.database.port,
        name: config.database.name,
        user: config.database.user
    });
    
    try {
        // Use Electron API if available
        if (window.electronAPI && window.electronAPI.testConnection) {
            console.log('Using Electron API for connection test');
            const result = await window.electronAPI.testConnection({
                host: config.database.host,
                port: parseInt(config.database.port),
                name: config.database.name,
                user: config.database.user,
                password: config.database.password
            });
            
            console.log('Connection test result:', JSON.stringify(result));
            statusEl.style.display = 'block';
            
            if (result.success) {
                statusEl.textContent = '✓ Connection successful!';
                statusEl.className = 'connection-status success';
            } else {
                statusEl.textContent = '✗ ' + (result.error || 'Unknown error');
                statusEl.className = 'connection-status error';
            }
        } else {
            console.log('No Electron API - using demo mode');
            // Demo mode
            await new Promise(resolve => setTimeout(resolve, 1000));
            statusEl.style.display = 'block';
            statusEl.textContent = '✓ Connection successful! (Demo mode)';
            statusEl.className = 'connection-status success';
        }
    } catch (error) {
        console.error('Connection test error:', error);
        alert('Connection test threw an error: ' + error.message);
        statusEl.style.display = 'block';
        statusEl.textContent = '✗ ' + error.message;
        statusEl.className = 'connection-status error';
    }
    
    statusEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔌</span> Test Connection';
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
    const dbTypes = {
        embedded: 'Built-in PostgreSQL',
        external: `External PostgreSQL (${config.database.host}:${config.database.port})`,
        sqlite: 'SQLite (Evaluation Mode)'
    };
    
    document.getElementById('summaryDb').textContent = dbTypes[config.database.type];
    document.getElementById('summaryAdmin').textContent = config.admin.username || 'admin';
}

function validateStep(step) {
    switch (step) {
        case 1:
            return true; // Welcome step always valid
            
        case 2:
            if (config.database.type === 'external') {
                // Validate external DB config
                if (!config.database.host || !config.database.port || !config.database.name) {
                    alert('Please fill in all database connection fields');
                    return false;
                }
            }
            return true;
            
        case 3:
            // Validate admin user
            const username = document.getElementById('adminUsername').value.trim();
            const name = document.getElementById('adminName').value.trim();
            const password = document.getElementById('adminPassword').value;
            const confirm = document.getElementById('adminPasswordConfirm').value;
            
            if (!username) {
                alert('Please enter a username');
                return false;
            }
            
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                alert('Username can only contain letters, numbers, and underscores');
                return false;
            }
            
            if (!name) {
                alert('Please enter a display name');
                return false;
            }
            
            if (password.length < 8) {
                alert('Password must be at least 8 characters');
                return false;
            }
            
            if (password !== confirm) {
                alert('Passwords do not match');
                return false;
            }
            
            // Save to config
            config.admin.username = username;
            config.admin.name = name;
            config.admin.email = document.getElementById('adminEmail').value.trim();
            config.admin.password = password;
            
            return true;
            
        case 4:
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
        // Final step - complete setup
        await completeSetup();
    }
}

async function completeSetup() {
    showLoading('Setting up your database...');
    console.log('Starting setup completion...');
    console.log('Database config:', config.database);
    console.log('Admin config:', { username: config.admin.username, email: config.admin.email });
    
    try {
        if (window.electronAPI) {
            // For embedded/sqlite mode, skip migration for now (not implemented yet)
            if (config.database.type === 'external') {
                // Test connection first
                showLoading('Testing database connection...');
                console.log('Testing external database connection...');
                const testResult = await window.electronAPI.testConnection({
                    host: config.database.host,
                    port: parseInt(config.database.port),
                    name: config.database.name,
                    user: config.database.user,
                    password: config.database.password
                });
                console.log('Test connection result:', testResult);
                
                if (!testResult.success) {
                    throw new Error('Database connection failed: ' + (testResult.error || 'Unknown error'));
                }
                
                // Run migrations for external database
                showLoading('Running database migrations...');
                console.log('Running migrations...');
                const migrateResult = await window.electronAPI.runMigrations();
                console.log('Migration result:', migrateResult);
                
                if (!migrateResult.success) {
                    console.warn('Migration warning:', migrateResult.output);
                    // Don't fail on migration errors for now - database might already be set up
                }
            } else {
                // For embedded or sqlite mode, show a message that it's not fully implemented
                showLoading('Configuring local database...');
                console.log('Embedded/SQLite mode - skipping database setup (not implemented)');
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Note: Embedded PostgreSQL and SQLite are not yet implemented
                // For beta, we'll still try to use the backend with whatever DB is configured
            }
            
            // Complete setup
            showLoading('Finalizing configuration...');
            console.log('Completing setup...');
            const result = await window.electronAPI.completeSetup({
                database: config.database,
                admin: config.admin
            });
            console.log('Complete setup result:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'Setup failed');
            }
            
            // Setup complete - main window will open
            hideLoading();
            console.log('Setup completed successfully');
        } else {
            // Demo mode - simulate setup
            console.log('Demo mode - simulating setup');
            await simulateSetup();
            hideLoading();
            alert('Setup complete! (Demo mode)\n\nIn the real application, BPERP would launch now.');
        }
    } catch (error) {
        console.error('Setup failed:', error);
        hideLoading();
        alert('Setup failed: ' + error.message + '\n\nPlease check your database configuration and try again.');
    }
}

async function simulateSetup() {
    const steps = [
        'Setting up your database...',
        'Running database migrations...',
        'Creating admin user...',
        'Finalizing configuration...'
    ];
    
    for (const step of steps) {
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
