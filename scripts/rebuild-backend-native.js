/**
 * Rebuild better-sqlite3 and bcrypt for Electron's Node ABI.
 *
 * electron-rebuild can skip work when prebuilds/.../electron-<abi>.node exists while
 * better-sqlite3 still loads build/Release/*.node from npm install (wrong ABI).
 * Cleaning build + prebuilds forces a full rebuild for Electron.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const backendModules = path.join(root, 'backend', 'node_modules');

function rmModDir(mod, sub) {
    const target = path.join(backendModules, mod, sub);
    fs.rmSync(target, { recursive: true, force: true });
}

for (const mod of ['better-sqlite3', 'bcrypt']) {
    rmModDir(mod, 'build');
    rmModDir(mod, 'prebuilds');
}

let electronVersion;
try {
    electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
} catch {
    console.error('Could not read electron version from node_modules/electron');
    process.exit(1);
}

const rebuildCli = path.join(root, 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js');
if (!fs.existsSync(rebuildCli)) {
    console.error('Missing @electron/rebuild. Run npm install from the repo root.');
    process.exit(1);
}

const backendRoot = path.join(root, 'backend');

const result = spawnSync(
    process.execPath,
    [
        rebuildCli,
        '-f',
        '-w',
        'better-sqlite3,bcrypt',
        '-m',
        backendRoot,
        '-v',
        electronVersion
    ],
    { stdio: 'inherit', cwd: root }
);

process.exit(result.status === null ? 1 : result.status);
