import fs from 'fs';
import path from 'path';
import vdf from 'vdf';
import { execSync } from 'child_process';

const getSteamPath = () => {
    console.log('=== Starting Steam Path Detection ===');

    // Try Windows Registry first (most reliable)
    try {
        const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath';
        const result = execSync(regQuery, { encoding: 'utf-8' });
        const match = result.match(/InstallPath\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
            const steamPath = match[1].trim();
            console.log('Steam path found in registry:', steamPath);
            if (fs.existsSync(steamPath)) {
                return steamPath;
            }
        }
    } catch (e) {
        console.log('Registry check failed (32-bit), trying 64-bit registry...');
        try {
            const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam" /v InstallPath';
            const result = execSync(regQuery, { encoding: 'utf-8' });
            const match = result.match(/InstallPath\s+REG_SZ\s+(.+)/);
            if (match && match[1]) {
                const steamPath = match[1].trim();
                console.log('Steam path found in 64-bit registry:', steamPath);
                if (fs.existsSync(steamPath)) {
                    return steamPath;
                }
            }
        } catch (e2) {
            console.log('64-bit registry check also failed');
        }
    }

    // Fallback to common paths
    const commonPaths = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam'),
        'C:\\Program Files (x86)\\Steam',
        'C:\\Program Files\\Steam',
    ];

    console.log('Checking common paths...');
    for (const testPath of commonPaths) {
        console.log('Checking:', testPath);
        if (fs.existsSync(testPath)) {
            console.log('Steam found at:', testPath);
            return testPath;
        }
    }

    console.log('Steam path not found in any location');
    return null;
};

export const getSteamGames = async () => {
    console.log('\n=== Getting Steam Games ===');
    const steamPath = getSteamPath();

    if (!steamPath) {
        console.error('❌ Steam installation not found');
        return [];
    }

    console.log('✓ Steam path:', steamPath);

    const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    console.log('Looking for library folders at:', libraryFoldersPath);

    if (!fs.existsSync(libraryFoldersPath)) {
        console.error('❌ Library folders file not found');
        return [];
    }

    console.log('✓ Library folders file found');

    const libraryContent = fs.readFileSync(libraryFoldersPath, 'utf-8');
    let libraryData;

    try {
        libraryData = vdf.parse(libraryContent);
        console.log('✓ Parsed library folders VDF');
    } catch (e) {
        console.error('❌ Error parsing libraryfolders.vdf:', e);
        return [];
    }

    const games = [];
    const libraries = libraryData.libraryfolders || {};

    console.log('Found', Object.keys(libraries).length, 'library folders');

    for (const key in libraries) {
        const lib = libraries[key];
        const libPath = lib.path;
        const apps = lib.apps;

        if (!libPath || !apps) {
            console.log('Skipping invalid library entry:', key);
            continue;
        }

        console.log(`\nLibrary ${key}: ${libPath}`);
        console.log(`  Apps in library:`, Object.keys(apps).length);

        for (const appId in apps) {
            const manifestPath = path.join(libPath, 'steamapps', `appmanifest_${appId}.acf`);

            if (fs.existsSync(manifestPath)) {
                const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
                try {
                    const manifestData = vdf.parse(manifestContent);
                    const appState = manifestData.AppState;

                    if (appState && appState.name) {
                        const nameLower = appState.name.toLowerCase();
                        const excludeKeywords = [
                            'redistributable',
                            'dedicated server',
                            'toolkit',
                            ' sdk',
                            'soundtrack',
                            'bonus content',
                            'artwork',
                            'wallpaper engine' // Optional: exclude utility apps if desired, but user has it installed. Let's keep it for now unless requested.
                        ];

                        // Specific check for "Tool" at the end of string or " Tool "
                        const isTool = nameLower.endsWith(' tool') || nameLower.includes(' tool ');

                        const shouldExclude = excludeKeywords.some(keyword => nameLower.includes(keyword)) || isTool;

                        if (shouldExclude) {
                            console.log(`  - Skipping non-game app: ${appState.name} (${appId})`);
                            continue;
                        }

                        games.push({
                            id: appId,
                            name: appState.name,
                            installDir: path.join(libPath, 'steamapps', 'common', appState.installdir || appState.installDir),
                            platform: 'steam',
                            executable: findGameExecutable(path.join(libPath, 'steamapps', 'common', appState.installdir || appState.installDir), appState.name),
                            lastPlayed: appState.LastPlayed || appState.lastplayed || '0'
                        });
                        console.log(`  ✓ Found: ${appState.name} (${appId})`);
                    }
                } catch (e) {
                    console.error(`  ❌ Error parsing manifest for ${appId}:`, e.message);
                }
            }
        }
    }

    console.log(`\n=== Total games found: ${games.length} ===\n`);
    return games;
};

/**
 * Attempt to find the main executable for a game
 */
function findGameExecutable(installDir, gameName) {
    if (!fs.existsSync(installDir)) return '';

    const isDebugTarget = gameName.toLowerCase().includes('where winds meet');

    try {
        if (isDebugTarget) console.log(`[ExeSearch] 🔍 Searching in: ${installDir} for "${gameName}"`);

        // Helper to scan directories
        function getExecutables(startDir, maxDepth, aggressiveFilters = true) {
            const results = [];

            function scan(dir, depth) {
                if (depth > maxDepth) return;

                let files;
                try {
                    files = fs.readdirSync(dir, { withFileTypes: true });
                } catch (e) {
                    return;
                }

                for (const file of files) {
                    const fullPath = path.join(dir, file.name);

                    if (file.isDirectory()) {
                        const nameLower = file.name.toLowerCase();

                        // Aggressive filters (First pass)
                        let skipFolders = ['redist', 'directx', 'commonredist', 'prerequisites', 'install', 'artbook', 'soundtrack'];

                        if (aggressiveFilters) {
                            skipFolders = [...skipFolders, 'support', 'tools', 'crashreporter', 'update', 'docs', 'manual'];
                        }

                        if (!skipFolders.some(f => nameLower.includes(f))) {
                            scan(fullPath, depth + 1);
                        } else if (isDebugTarget && aggressiveFilters) {
                            console.log(`[ExeDebug] Skipping folder (Pass 1): ${file.name}`);
                        }
                    } else if (file.isFile() && file.name.toLowerCase().endsWith('.exe')) {
                        const nameLower = file.name.toLowerCase();
                        // Minimal exe blacklist
                        const skipExes = ['unitycrashhandler', 'unins', 'uninstall', 'dxsetup', 'vcredist', 'crashreport'];

                        if (!skipExes.some(e => nameLower.includes(e))) {
                            results.push({
                                name: file.name,
                                path: fullPath,
                                size: fs.statSync(fullPath).size,
                                depth: depth
                            });
                        }
                    }
                }
            }

            scan(startDir, 0);
            return results;
        }

        // PASS 1: Standard scan (Depth 5, Aggressive Filters)
        let exes = getExecutables(installDir, 5, true);

        // PASS 2: Deep scan if nothing found (Depth 8, Relaxed Filters)
        if (exes.length === 0) {
            if (isDebugTarget) console.log('[ExeSearch] ⚠️ No exes found in Pass 1. Starting Deep Scan...');
            exes = getExecutables(installDir, 8, false);
        }

        if (exes.length === 0) {
            console.log(`[ExeSearch] ❌ Absolutely no executables found in ${installDir}`);
            return '';
        }

        if (isDebugTarget) console.log(`[ExeSearch] Found ${exes.length} candidates. Scoring...`);

        // Generate acronyms
        const words = gameName.toLowerCase().split(/[^a-z0-9]+/);
        const acronym = words.map(w => w[0]).join('');

        // Scoring system
        const scoredExes = exes.map(exe => {
            let score = 0;
            const nameLower = exe.name.toLowerCase();
            const nameNoExt = nameLower.replace('.exe', '');
            const pathLower = exe.path.toLowerCase();
            const gameNameLower = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');

            // 1. "Shipping" (Unreal Engine)
            if (nameLower.includes('shipping')) score += 50;

            // 2. Exact name match
            if (nameLower === `${gameNameLower}.exe`) score += 40;

            // 3. Acronym match
            if (nameNoExt === acronym) score += 45;
            else if (nameNoExt.startsWith(acronym)) score += 25;

            // 4. Contains game name
            if (nameLower.includes(gameNameLower)) score += 30;

            // 5. Folder heuristics
            if (pathLower.includes('binaries') && pathLower.includes('win64')) score += 25;
            else if (pathLower.includes('binaries')) score += 15;

            // 6. Penalties
            if (nameLower.includes('server')) score -= 50;
            if (nameLower.includes('client')) score -= 10;
            if (nameLower.includes('crash')) score -= 20;

            // 7. Size score (max 20 points)
            score += Math.min(20, exe.size / (1024 * 1024 * 5));

            return { ...exe, score };
        });

        // Sort by score descending
        scoredExes.sort((a, b) => b.score - a.score);

        if (isDebugTarget) {
            console.log(`[ExeSearch] Top candidates for ${gameName}:`);
            scoredExes.slice(0, 5).forEach(e =>
                console.log(`  - ${e.name} (Score: ${e.score.toFixed(1)}, Path: ${e.path})`)
            );
        }

        return scoredExes[0].name;

    } catch (error) {
        console.error(`Error searching for executable in ${installDir}:`, error);
        return '';
    }
}
