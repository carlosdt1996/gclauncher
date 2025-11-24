import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Get Battle.net installation path from registry
 */
const getBattleNetPath = () => {
    console.log('=== Starting Battle.net Path Detection ===');

    try {
        const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Blizzard Entertainment\\Battle.net" /v InstallPath';
        const result = execSync(regQuery, { encoding: 'utf-8' });
        const match = result.match(/InstallPath\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
            const battleNetPath = match[1].trim();
            console.log('Battle.net path found in registry:', battleNetPath);
            if (fs.existsSync(battleNetPath)) {
                return battleNetPath;
            }
        }
    } catch (e) {
        console.log('Battle.net registry check failed (32-bit), trying 64-bit...');
        try {
            const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Blizzard Entertainment\\Battle.net" /v InstallPath';
            const result = execSync(regQuery, { encoding: 'utf-8' });
            const match = result.match(/InstallPath\s+REG_SZ\s+(.+)/);
            if (match && match[1]) {
                const battleNetPath = match[1].trim();
                console.log('Battle.net path found in 64-bit registry:', battleNetPath);
                if (fs.existsSync(battleNetPath)) {
                    return battleNetPath;
                }
            }
        } catch (e2) {
            console.log('64-bit registry check also failed');
        }
    }

    // Fallback to common paths
    const commonPaths = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Battle.net'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Battle.net'),
    ];

    for (const testPath of commonPaths) {
        if (fs.existsSync(testPath)) {
            console.log('Battle.net found at:', testPath);
            return testPath;
        }
    }

    console.log('Battle.net path not found');
    return null;
};

/**
 * Battle.net game product codes and their display names
 */
const BATTLENET_GAMES = {
    'wow': 'World of Warcraft',
    'wow_classic': 'World of Warcraft Classic',
    'wow_classic_era': 'WoW Classic Era',
    'd3': 'Diablo III',
    'd2r': 'Diablo II: Resurrected',
    'd4': 'Diablo IV',
    'hs': 'Hearthstone',
    'sc2': 'StarCraft II',
    'scr': 'StarCraft: Remastered',
    'ow': 'Overwatch',
    'ow2': 'Overwatch 2',
    'cod': 'Call of Duty',
    'codmw': 'Call of Duty: Modern Warfare',
    'codmwii': 'Call of Duty: Modern Warfare II',
    'codmwiii': 'Call of Duty: Modern Warfare III',
    'viper': 'Call of Duty: Black Ops 4',
    'zeus': 'Call of Duty: Black Ops Cold War',
    'lazarus': 'Call of Duty: Vanguard',
    'warzone': 'Call of Duty: Warzone',
    'heroes': 'Heroes of the Storm',
    'wtcg': 'Hearthstone',
    'w3': 'Warcraft III: Reforged',
    'crash': 'Crash Bandicoot 4',
};

/**
 * Find game executable in a directory
 */
function findGameExecutable(installDir, productCode) {
    if (!fs.existsSync(installDir)) return '';

    try {
        // Common executable patterns for Battle.net games
        const executablePatterns = {
            'wow': ['Wow.exe', 'WowClassic.exe'],
            'wow_classic': ['WowClassic.exe'],
            'wow_classic_era': ['WowClassic.exe'],
            'd3': ['Diablo III.exe', 'Diablo III64.exe'],
            'd2r': ['D2R.exe'],
            'd4': ['Diablo IV.exe'],
            'hs': ['Hearthstone.exe'],
            'sc2': ['SC2.exe', 'SC2_x64.exe'],
            'scr': ['StarCraft.exe'],
            'ow': ['Overwatch.exe'],
            'ow2': ['Overwatch.exe'],
            'heroes': ['HeroesSwitcher.exe', 'HeroesSwitcher_x64.exe'],
            'w3': ['Warcraft III.exe'],
        };

        const patterns = executablePatterns[productCode] || [];

        // Try known patterns first
        for (const pattern of patterns) {
            const exePath = path.join(installDir, pattern);
            if (fs.existsSync(exePath)) {
                return pattern;
            }
        }

        // Fallback: scan for any .exe
        function getExecutables(startDir, maxDepth = 2) {
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
                        scan(fullPath, depth + 1);
                    } else if (file.isFile() && file.name.toLowerCase().endsWith('.exe')) {
                        const nameLower = file.name.toLowerCase();
                        const skipExes = ['battle.net', 'blizzard', 'installer', 'uninstall', 'agent', 'launcher', 'updater', 'repair'];

                        if (!skipExes.some(e => nameLower.includes(e))) {
                            results.push({
                                name: file.name,
                                size: fs.statSync(fullPath).size
                            });
                        }
                    }
                }
            }

            scan(startDir, 0);
            return results;
        }

        const exes = getExecutables(installDir);
        if (exes.length > 0) {
            // Return the largest executable (usually the main game)
            exes.sort((a, b) => b.size - a.size);
            return exes[0].name;
        }

        return '';
    } catch (error) {
        console.error(`Error searching for executable in ${installDir}:`, error);
        return '';
    }
}

/**
 * Get all Battle.net games
 */
export const getBattleNetGames = async () => {
    console.log('\n=== Getting Battle.net Games ===');
    const battleNetPath = getBattleNetPath();

    if (!battleNetPath) {
        console.log('❌ Battle.net installation not found');
        return [];
    }

    console.log('✓ Battle.net path:', battleNetPath);

    const games = [];

    // Read product database
    const productDbPath = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Battle.net', 'Agent', 'product.db');

    if (fs.existsSync(productDbPath)) {
        console.log('Found Battle.net product database');
        // Note: product.db is a binary format, we'll scan installation folders instead
    }

    // Scan common Battle.net game installation paths
    const gameFolders = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Overwatch'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Diablo III'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Diablo IV'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Diablo II Resurrected'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'StarCraft II'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Hearthstone'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Heroes of the Storm'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'World of Warcraft'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Call of Duty Modern Warfare'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Call of Duty'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Warcraft III'),
    ];

    for (const folder of gameFolders) {
        if (fs.existsSync(folder)) {
            const gameName = path.basename(folder);
            console.log(`Found: ${gameName}`);

            // Try to determine product code from folder name
            let productCode = '';
            for (const [code, name] of Object.entries(BATTLENET_GAMES)) {
                if (folder.toLowerCase().includes(name.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                    productCode = code;
                    break;
                }
            }

            const executable = findGameExecutable(folder, productCode);
            if (executable) {
                games.push({
                    id: `battlenet-${gameName.toLowerCase().replace(/\s+/g, '-')}`,
                    name: gameName,
                    installDir: folder,
                    platform: 'battlenet',
                    executable: executable,
                    lastPlayed: '0'
                });
                console.log(`  ✓ Found: ${gameName} (${executable})`);
            }
        }
    }

    // Also check for games in custom install locations via config
    const configPath = path.join(process.env.APPDATA || '', 'Battle.net', 'Battle.net.config');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.Games) {
                for (const [productCode, gameData] of Object.entries(config.Games)) {
                    if (gameData.InstallPath && fs.existsSync(gameData.InstallPath)) {
                        const gameName = BATTLENET_GAMES[productCode] || productCode;

                        // Skip if already added
                        if (games.some(g => g.installDir === gameData.InstallPath)) continue;

                        const executable = findGameExecutable(gameData.InstallPath, productCode);
                        if (executable) {
                            games.push({
                                id: `battlenet-${productCode}`,
                                name: gameName,
                                installDir: gameData.InstallPath,
                                platform: 'battlenet',
                                executable: executable,
                                lastPlayed: gameData.LastPlayed || '0'
                            });
                            console.log(`  ✓ Found from config: ${gameName}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error reading Battle.net config:', e);
        }
    }

    console.log(`\n=== Total Battle.net games found: ${games.length} ===\n`);
    return games;
};
