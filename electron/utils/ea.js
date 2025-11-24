import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Get EA App installation path from registry
 */
const getEAPath = () => {
    console.log('=== Starting EA App Path Detection ===');

    // Try EA App (new) registry
    try {
        const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Electronic Arts\\EA Desktop" /v InstallLocation';
        const result = execSync(regQuery, { encoding: 'utf-8' });
        const match = result.match(/InstallLocation\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
            const eaPath = match[1].trim();
            console.log('EA App path found in registry:', eaPath);
            if (fs.existsSync(eaPath)) {
                return eaPath;
            }
        }
    } catch (e) {
        console.log('EA App registry check failed, trying Origin...');
    }

    // Try Origin (legacy) registry
    try {
        const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Origin" /v ClientPath';
        const result = execSync(regQuery, { encoding: 'utf-8' });
        const match = result.match(/ClientPath\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
            const originPath = path.dirname(match[1].trim());
            console.log('Origin path found in registry:', originPath);
            if (fs.existsSync(originPath)) {
                return originPath;
            }
        }
    } catch (e) {
        console.log('Origin registry check failed');
    }

    // Fallback to common paths
    const commonPaths = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'EA Games'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'EA Games'),
        path.join(process.env.LOCALAPPDATA || '', 'Electronic Arts', 'EA Desktop'),
        'C:\\Program Files\\EA Games',
        'C:\\Program Files (x86)\\Origin Games',
    ];

    for (const testPath of commonPaths) {
        if (fs.existsSync(testPath)) {
            console.log('EA/Origin found at:', testPath);
            return testPath;
        }
    }

    console.log('EA/Origin path not found');
    return null;
};

/**
 * Find game executable in a directory
 */
function findGameExecutable(installDir, gameName) {
    if (!fs.existsSync(installDir)) return '';

    try {
        function getExecutables(startDir, maxDepth = 3) {
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
                        const skipFolders = ['__installer', 'redist', 'directx', 'prerequisites', 'support'];

                        if (!skipFolders.some(f => nameLower.includes(f))) {
                            scan(fullPath, depth + 1);
                        }
                    } else if (file.isFile() && file.name.toLowerCase().endsWith('.exe')) {
                        const nameLower = file.name.toLowerCase();
                        const skipExes = ['unins', 'uninstall', 'eadesktop', 'origin', 'installer', 'setup', 'activation'];

                        if (!skipExes.some(e => nameLower.includes(e))) {
                            results.push({
                                name: file.name,
                                path: fullPath,
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

        if (exes.length === 0) return '';

        // Score executables
        const gameNameLower = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const scoredExes = exes.map(exe => {
            let score = 0;
            const nameLower = exe.name.toLowerCase();
            const nameNoExt = nameLower.replace('.exe', '');

            // Exact match
            if (nameLower === `${gameNameLower}.exe`) score += 50;

            // Contains game name
            if (nameLower.includes(gameNameLower)) score += 30;

            // Size bonus (larger files are more likely to be the main game)
            score += Math.min(20, exe.size / (1024 * 1024 * 10));

            return { ...exe, score };
        });

        scoredExes.sort((a, b) => b.score - a.score);
        return scoredExes[0].name;
    } catch (error) {
        console.error(`Error searching for executable in ${installDir}:`, error);
        return '';
    }
}

/**
 * Get all EA/Origin games
 */
export const getEAGames = async () => {
    console.log('\n=== Getting EA/Origin Games ===');
    const eaPath = getEAPath();

    if (!eaPath) {
        console.log('❌ EA/Origin installation not found');
        return [];
    }

    console.log('✓ EA/Origin path:', eaPath);

    const games = [];

    // Check for EA Desktop manifest files
    const eaDesktopManifest = path.join(process.env.LOCALAPPDATA || '', 'Electronic Arts', 'EA Desktop', 'Manifests');
    if (fs.existsSync(eaDesktopManifest)) {
        console.log('Scanning EA Desktop manifests...');
        try {
            const files = fs.readdirSync(eaDesktopManifest);
            for (const file of files) {
                if (file.endsWith('.mfst')) {
                    try {
                        const manifestPath = path.join(eaDesktopManifest, file);
                        const content = fs.readFileSync(manifestPath, 'utf-8');
                        const data = JSON.parse(content);

                        if (data.dipInstallPath && data.dipDisplayName) {
                            const installPath = data.dipInstallPath;
                            if (fs.existsSync(installPath)) {
                                games.push({
                                    id: `ea-${data.contentId || file}`,
                                    name: data.dipDisplayName,
                                    installDir: installPath,
                                    platform: 'ea',
                                    executable: findGameExecutable(installPath, data.dipDisplayName),
                                    lastPlayed: '0'
                                });
                                console.log(`  ✓ Found: ${data.dipDisplayName}`);
                            }
                        }
                    } catch (e) {
                        console.error(`  ❌ Error parsing manifest ${file}:`, e.message);
                    }
                }
            }
        } catch (e) {
            console.error('Error reading EA Desktop manifests:', e);
        }
    }

    // Scan for games in common EA/Origin folders
    const gameFolders = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Origin Games'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Origin Games'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'EA Games'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'EA Games'),
    ];

    for (const folder of gameFolders) {
        if (fs.existsSync(folder)) {
            console.log(`Scanning folder: ${folder}`);
            try {
                const dirs = fs.readdirSync(folder, { withFileTypes: true });
                for (const dir of dirs) {
                    if (dir.isDirectory()) {
                        const gamePath = path.join(folder, dir.name);

                        // Skip if already added from manifest
                        if (games.some(g => g.installDir === gamePath)) continue;

                        const executable = findGameExecutable(gamePath, dir.name);
                        if (executable) {
                            games.push({
                                id: `ea-${dir.name.toLowerCase().replace(/\s+/g, '-')}`,
                                name: dir.name,
                                installDir: gamePath,
                                platform: 'ea',
                                executable: executable,
                                lastPlayed: '0'
                            });
                            console.log(`  ✓ Found: ${dir.name}`);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error scanning ${folder}:`, e);
            }
        }
    }

    console.log(`\n=== Total EA/Origin games found: ${games.length} ===\n`);
    return games;
};
