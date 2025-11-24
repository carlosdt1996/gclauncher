import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import store from './store.js';

/**
 * Get all available drive letters on Windows
 */
function getAvailableDrives() {
    try {
        const result = execSync('wmic logicaldisk get name', { encoding: 'utf-8' });
        const drives = result
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.match(/^[A-Z]:$/))
            .map(drive => drive);

        console.log('[ExtensiveSearch] Available drives:', drives);
        return drives;
    } catch (e) {
        console.error('[ExtensiveSearch] Failed to get drives, using defaults');
        return ['C:'];
    }
}

/**
 * Recursively search for a specific folder/file pattern
 */
function searchForPath(startPath, targetFolders, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth) return null;

    try {
        const items = fs.readdirSync(startPath, { withFileTypes: true });

        for (const item of items) {
            if (!item.isDirectory()) continue;

            const fullPath = path.join(startPath, item.name);

            // Check if this is one of our target folders
            if (targetFolders.some(target => item.name.toLowerCase() === target.toLowerCase())) {
                console.log(`[ExtensiveSearch] Found potential match: ${fullPath}`);
                return fullPath;
            }

            // Skip certain system/large folders to speed up search
            const skipFolders = [
                'windows', 'system32', 'syswow64', '$recycle.bin',
                'recovery', 'perflogs', 'node_modules', '.git',
                'appdata', 'programdata'
            ];

            if (skipFolders.some(skip => item.name.toLowerCase().includes(skip))) {
                continue;
            }

            // Recursively search subdirectories
            const found = searchForPath(fullPath, targetFolders, maxDepth, currentDepth + 1);
            if (found) return found;
        }
    } catch (e) {
        // Permission denied or other error, skip this directory
        return null;
    }

    return null;
}

/**
 * Extensive search for Steam installation
 */
export async function findSteamPath() {
    const cacheKey = 'cachedSteamPath';
    const cached = store.get(cacheKey);

    if (cached && fs.existsSync(cached)) {
        console.log('[ExtensiveSearch] Using cached Steam path:', cached);
        return cached;
    }

    console.log('[ExtensiveSearch] Starting extensive Steam search...');
    const drives = getAvailableDrives();

    for (const drive of drives) {
        console.log(`[ExtensiveSearch] Searching ${drive} for Steam...`);

        // Search common root locations first
        const quickPaths = [
            path.join(drive, '\\Program Files (x86)\\Steam'),
            path.join(drive, '\\Program Files\\Steam'),
            path.join(drive, '\\Steam'),
            path.join(drive, '\\Games\\Steam'),
        ];

        for (const quickPath of quickPaths) {
            if (fs.existsSync(quickPath)) {
                console.log('[ExtensiveSearch] Found Steam at:', quickPath);
                store.set(cacheKey, quickPath);
                return quickPath;
            }
        }

        // Deep search (only on C: drive to avoid long scans)
        if (drive === 'C:') {
            const found = searchForPath(drive + '\\', ['Steam'], 2);
            if (found && fs.existsSync(path.join(found, 'steam.exe'))) {
                console.log('[ExtensiveSearch] Found Steam via deep search:', found);
                store.set(cacheKey, found);
                return found;
            }
        }
    }

    console.log('[ExtensiveSearch] Steam not found after extensive search');
    return null;
}

/**
 * Extensive search for EA App/Origin installation
 */
export async function findEAPath() {
    const cacheKey = 'cachedEAPath';
    const cached = store.get(cacheKey);

    if (cached && fs.existsSync(cached)) {
        console.log('[ExtensiveSearch] Using cached EA path:', cached);
        return cached;
    }

    console.log('[ExtensiveSearch] Starting extensive EA search...');
    const drives = getAvailableDrives();

    for (const drive of drives) {
        console.log(`[ExtensiveSearch] Searching ${drive} for EA...`);

        const quickPaths = [
            path.join(drive, '\\Program Files\\Electronic Arts\\EA Desktop'),
            path.join(drive, '\\Program Files (x86)\\Electronic Arts\\EA Desktop'),
            path.join(drive, '\\Program Files\\EA Games'),
            path.join(drive, '\\Program Files (x86)\\EA Games'),
            path.join(drive, '\\Program Files (x86)\\Origin Games'),
            path.join(drive, '\\EA Games'),
            path.join(drive, '\\Origin Games'),
        ];

        for (const quickPath of quickPaths) {
            if (fs.existsSync(quickPath)) {
                console.log('[ExtensiveSearch] Found EA at:', quickPath);
                store.set(cacheKey, quickPath);
                return quickPath;
            }
        }

        // Deep search (only on C: drive)
        if (drive === 'C:') {
            const found = searchForPath(drive + '\\', ['EA Desktop', 'EA Games', 'Origin Games'], 2);
            if (found) {
                console.log('[ExtensiveSearch] Found EA via deep search:', found);
                store.set(cacheKey, found);
                return found;
            }
        }
    }

    console.log('[ExtensiveSearch] EA not found after extensive search');
    return null;
}

/**
 * Extensive search for Battle.net installation
 */
export async function findBattleNetPath() {
    const cacheKey = 'cachedBattleNetPath';
    const cached = store.get(cacheKey);

    if (cached && fs.existsSync(cached)) {
        console.log('[ExtensiveSearch] Using cached Battle.net path:', cached);
        return cached;
    }

    console.log('[ExtensiveSearch] Starting extensive Battle.net search...');
    const drives = getAvailableDrives();

    for (const drive of drives) {
        console.log(`[ExtensiveSearch] Searching ${drive} for Battle.net...`);

        const quickPaths = [
            path.join(drive, '\\Program Files (x86)\\Battle.net'),
            path.join(drive, '\\Program Files\\Battle.net'),
            path.join(drive, '\\Battle.net'),
        ];

        for (const quickPath of quickPaths) {
            if (fs.existsSync(quickPath)) {
                console.log('[ExtensiveSearch] Found Battle.net at:', quickPath);
                store.set(cacheKey, quickPath);
                return quickPath;
            }
        }

        // Deep search (only on C: drive)
        if (drive === 'C:') {
            const found = searchForPath(drive + '\\', ['Battle.net'], 2);
            if (found) {
                console.log('[ExtensiveSearch] Found Battle.net via deep search:', found);
                store.set(cacheKey, found);
                return found;
            }
        }
    }

    console.log('[ExtensiveSearch] Battle.net not found after extensive search');
    return null;
}
