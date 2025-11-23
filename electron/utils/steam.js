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
                            executable: '',
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
