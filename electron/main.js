import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { getSteamGames } from './utils/steam.js';
import store from './utils/store.js';
import { fetchGameImage, searchGameDetailed } from './utils/steamgriddb.js';
import { loginToBackloggd, searchGame, getGameDetails } from './utils/backloggd.js';
import { searchMetacritic, getMetacriticScore } from './utils/metacritic.js';
import { checkCrackStatus } from './utils/crackstatus.js';
import { startSession, endSession, getPlaytime, getAllPlaytimes, setGameExecutable, getGameExecutable, getAllGameExecutables, endAllActiveSessions } from './utils/playtime.js';
import { scrapeMainPageGames, scrapeGameDetails, searchGames } from './utils/fitgirl.js';
import torrentManager from './utils/torrent-manager.js';
import { getFileReport, calculateFileHash } from './utils/virustotal.js';
import * as realDebrid from './utils/real-debrid.js';
import * as torrentSearch from './utils/torrent-search.js';
import { extractArchive, isArchive, findMainArchive } from './utils/extractor.js';
import processMonitor from './utils/process-monitor.js';
import os from 'os';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;

const createWindow = () => {
    // Create the browser window.
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'public', 'logo.png')
        : path.join(__dirname, '..', 'public', 'logo.png');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        frame: true,
        backgroundColor: '#1a1a1a',
    });

    // Hide the default menu bar (File, Edit, View, Window, Help)
    mainWindow.setMenu(null);

    // Load the index.html of the app.
    if (!app.isPackaged) {
        mainWindow.loadURL('http://127.0.0.1:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
    ipcMain.handle('get-games', async () => {
        console.log('IPC: get-games called');
        try {
            const steamGames = await getSteamGames();
            const customGames = store.get('customGames') || [];
            console.log(`IPC: Returning ${steamGames.length} Steam games and ${customGames.length} custom games`);
            return [...steamGames, ...customGames];
        } catch (error) {
            console.error('IPC: Error getting games:', error);
            return [];
        }
    });

    // Custom Games Handlers
    ipcMain.handle('add-custom-game', async (event, game) => {
        const customGames = store.get('customGames') || [];
        // Check if game already exists
        if (!customGames.find(g => g.name === game.name)) {
            customGames.push({
                ...game,
                id: `custom-${Date.now()}`, // Generate unique ID
                platform: 'custom',
                addedAt: Date.now()
            });
            store.set('customGames', customGames);
            return { success: true };
        }
        return { success: false, error: 'Game already exists' };
    });

    ipcMain.handle('remove-custom-game', async (event, gameId) => {
        const customGames = store.get('customGames') || [];
        const filtered = customGames.filter(g => g.id !== gameId);
        store.set('customGames', filtered);
        return { success: true };
    });

    ipcMain.handle('get-api-key', () => {
        return store.get('apiKey');
    });

    ipcMain.handle('set-api-key', (event, key) => {
        store.set('apiKey', key);
    });

    ipcMain.handle('set-rd-api-key', async (event, key) => {
        store.set('rdApiKey', key);
    });

    ipcMain.handle('get-rd-api-key', async () => {
        return store.get('rdApiKey') || '';
    });

    ipcMain.handle('set-download-folder', async (event, folder) => {
        store.set('downloadFolder', folder);
    });

    ipcMain.handle('get-download-folder', async () => {
        return store.get('downloadFolder') || '';
    });

    ipcMain.handle('set-install-folder', async (event, folder) => {
        store.set('installFolder', folder);
    });

    ipcMain.handle('get-install-folder', async () => {
        return store.get('installFolder') || '';
    });

    ipcMain.handle('get-game-image', async (event, gameNameOrId, gameName) => {
        const apiKey = store.get('apiKey');
        if (!apiKey) {
            console.log('[get-game-image] No API key found');
            return null;
        }

        const cachedImages = store.get('cachedImages') || {};
        // First check by ID (for custom cover art saved by ID)
        if (cachedImages[gameNameOrId]) {
            console.log('[get-game-image] Found cached image by ID/name:', gameNameOrId);
            return cachedImages[gameNameOrId];
        }
        // If gameName is provided and different, check that too (for backward compatibility)
        if (gameName && gameName !== gameNameOrId && cachedImages[gameName]) {
            console.log('[get-game-image] Found cached image by name:', gameName);
            // Also save it under the ID for future lookups
            cachedImages[gameNameOrId] = cachedImages[gameName];
            store.set('cachedImages', cachedImages);
            return cachedImages[gameName];
        }

        // Fetch new image - always use game name for API calls (SteamGridDB needs names, not IDs)
        const nameToFetch = gameName || gameNameOrId;
        console.log('[get-game-image] Fetching new image for:', nameToFetch);
        const imageUrl = await fetchGameImage(nameToFetch, apiKey);
        if (imageUrl) {
            // Save by ID (if provided) for custom cover art, and also by name for backward compatibility
            cachedImages[gameNameOrId] = imageUrl;
            if (gameName && gameName !== gameNameOrId) {
                cachedImages[gameName] = imageUrl;
            }
            store.set('cachedImages', cachedImages);
            console.log('[get-game-image] Saved image for:', gameNameOrId, gameName ? `and ${gameName}` : '');
        } else {
            console.log('[get-game-image] Failed to fetch image for:', nameToFetch);
        }
        return imageUrl;
    });

    ipcMain.handle('set-game-image', async (event, { gameId, imageUrl }) => {
        try {
            const cachedImages = store.get('cachedImages') || {};
            cachedImages[gameId] = imageUrl;
            store.set('cachedImages', cachedImages);
            console.log('Saved cover art for game:', gameId, imageUrl);
            return { success: true };
        } catch (error) {
            console.error('Error saving game image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('launch-game', async (event, game) => {
        console.log('IPC: Launching game', game.name, game.id);

        try {
            if (game.platform === 'steam') {
                // For Steam games, we need to detect the executable
                // Store the game info for process monitoring
                let executableName = getGameExecutable(game.id);

                // If we don't have the executable stored, try to get it from game data
                if (!executableName && game.executable) {
                    executableName = path.basename(game.executable);
                    setGameExecutable(game.id, executableName);
                }

                // Register with process monitor if we have an executable
                if (executableName) {
                    processMonitor.registerGame(game.id, game.name, executableName);
                    console.log(`[Launch] Registered ${game.name} for monitoring: ${executableName}`);
                } else {
                    console.warn(`[Launch] No executable found for ${game.name}, automatic tracking won't work`);
                }

                // Use Steam protocol to launch game
                await shell.openExternal(`steam://run/${game.id}`);
                return { success: true };
            } else if (game.platform === 'custom') {
                // For custom games, we should have the executable path
                if (game.executable) {
                    const executableName = path.basename(game.executable);
                    setGameExecutable(game.id, executableName);
                    processMonitor.registerGame(game.id, game.name, executableName);
                    console.log(`[Launch] Registered custom game ${game.name}: ${executableName}`);

                    // Launch the game
                    await shell.openPath(game.executable);
                    return { success: true };
                }
                return { success: false, error: 'No executable path for custom game' };
            }
            return { success: false, error: 'Unsupported platform' };
        } catch (error) {
            console.error('Error launching game:', error);
            throw error;
        }
    });

    // Backloggd Handlers
    ipcMain.handle('backloggd-login', async () => {
        return await loginToBackloggd();
    });

    ipcMain.handle('backloggd-get-user', () => {
        return store.get('backloggd_username');
    });

    ipcMain.handle('backloggd-get-details', async (event, gameName) => {
        try {
            console.log(`[Main] Fetching details for: ${gameName}`);

            // Run searches in parallel
            const [backloggdGame, metacriticGame] = await Promise.all([
                searchGame(gameName),
                searchMetacritic(gameName)
            ]);

            let synopsis = 'No synopsis available.';
            let rating = 'N/A';
            let url = null;

            // Fetch details in parallel if games found
            const promises = [];

            if (backloggdGame && backloggdGame.url) {
                url = backloggdGame.url; // Prefer Backloggd URL for "View Details" if we had one
                promises.push(getGameDetails(backloggdGame.url).then(d => {
                    if (d.synopsis) synopsis = d.synopsis;
                }));
            } else {
                promises.push(Promise.resolve());
            }

            if (metacriticGame && metacriticGame.url) {
                // Use score from search result if available, otherwise fetch page
                if (metacriticGame.score) {
                    rating = metacriticGame.score;
                    promises.push(Promise.resolve());
                } else {
                    promises.push(getMetacriticScore(metacriticGame.url).then(score => {
                        if (score && score !== 'N/A') rating = score;
                    }));
                }
            } else {
                promises.push(Promise.resolve());
            }

            await Promise.all(promises);

            return { rating, synopsis, url };
        } catch (error) {
            console.error('[Main] Details Handler Error:', error);
            return { rating: 'N/A', synopsis: 'Error fetching details.', url: null };
        }
    });

    ipcMain.handle('check-crack-status', async (event, gameName) => {
        try {
            return await checkCrackStatus(gameName);
        } catch (error) {
            console.error('[Main] Crack Status Handler Error:', error);
            return { isCracked: null };
        }
    });

    // Playtime tracking handlers
    ipcMain.handle('end-session', async (event, gameId) => {
        return endSession(gameId);
    });

    ipcMain.handle('get-playtime', async (event, gameId) => {
        return getPlaytime(gameId);
    });

    ipcMain.handle('get-all-playtimes', async () => {
        return getAllPlaytimes();
    });

    ipcMain.handle('clear-all-playtimes', async () => {
        try {
            store.delete('playtime_sessions');
            console.log('[Playtime] All sessions cleared');
            return { success: true };
        } catch (error) {
            console.error('[Playtime] Error clearing sessions:', error);
            return { success: false, error: error.message };
        }
    });

    // FitGirl Repacks handlers
    ipcMain.handle('fitgirl-get-games', async () => {
        // Get recent games from main page
        return await scrapeMainPageGames();
    });

    ipcMain.handle('fitgirl-search', async (event, query) => {
        return await searchGames(query);
    });

    ipcMain.handle('fitgirl-get-details', async (event, pageUrl) => {
        return await scrapeGameDetails(pageUrl);
    });

    // Real-Debrid handlers
    ipcMain.handle('rd-add-magnet', async (event, { magnetLink, apiKey }) => {
        try {
            const result = await realDebrid.addMagnet(magnetLink, apiKey);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rd-get-torrent-info', async (event, { torrentId, apiKey }) => {
        try {
            const info = await realDebrid.getTorrentInfo(torrentId, apiKey);
            return { success: true, data: info };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rd-select-files', async (event, { torrentId, fileIds, apiKey }) => {
        try {
            await realDebrid.selectFiles(torrentId, fileIds, apiKey);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rd-get-unrestricted-link', async (event, { link, apiKey }) => {
        try {
            const result = await realDebrid.getUnrestrictedLink(link, apiKey);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rd-download-file', async (event, { url, filename, downloadPath }) => {
        try {
            // Use provided path or default to Downloads/FitGirl Repacks
            const defaultPath = downloadPath || path.join(os.homedir(), 'Downloads', 'FitGirl Repacks');

            console.log('[Main] RD Download - URL:', url);
            console.log('[Main] RD Download - Filename:', filename);
            console.log('[Main] RD Download - Download path:', defaultPath);

            // Ensure the directory exists
            if (!fs.existsSync(defaultPath)) {
                fs.mkdirSync(defaultPath, { recursive: true });
                console.log('[Main] Created download directory:', defaultPath);
            }

            const savePath = path.join(defaultPath, filename);
            console.log('[Main] Full save path:', savePath);

            // Use the new startDownload function with downloadId
            const downloadId = filename; // Use filename as unique ID
            await realDebrid.startDownload(downloadId, url, savePath, (loaded, total, percentage) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('rd-download-progress', {
                        filename,
                        loaded,
                        total,
                        percentage
                    });
                }
            });

            console.log('[Main] Download complete:', savePath);
            return { success: true, path: savePath };
        } catch (error) {
            console.error('[Main] Download error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rd-cancel-download', async (event, { filename }) => {
        try {
            const canceled = realDebrid.cancelDownload(filename);
            return { success: canceled };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rd-delete-torrent', async (event, { torrentId, apiKey }) => {
        try {
            await realDebrid.deleteTorrent(torrentId, apiKey);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Extraction handler
    ipcMain.handle('extract-archive', async (event, { filePath, outputDir }) => {
        try {
            console.log('[Main] Extraction request received');
            console.log('[Main] Input path:', filePath);
            console.log('[Main] Output dir:', outputDir);

            let archivePath = filePath;

            // If it's a directory, find the archive inside
            const stats = fs.statSync(filePath);
            console.log('[Main] Path is a:', stats.isDirectory() ? 'directory' : 'file');

            if (stats.isDirectory()) {
                console.log('[Main] Searching for archive in directory...');
                const found = findMainArchive(filePath);
                if (!found) {
                    console.error('[Main] No archive found in directory');
                    return { success: false, error: 'No archive found in directory' };
                }
                archivePath = found;
                console.log('[Main] Found archive:', archivePath);
            } else if (!isArchive(filePath)) {
                console.error('[Main] File is not an archive:', filePath);
                return { success: false, error: 'Not an archive' };
            } else {
                console.log('[Main] File is a valid archive');
            }

            // Determine output directory
            let finalOutputDir;
            if (outputDir) {
                // Use provided output directory (should be a folder with game name)
                finalOutputDir = outputDir;
                // Ensure the directory exists
                if (!fs.existsSync(finalOutputDir)) {
                    fs.mkdirSync(finalOutputDir, { recursive: true });
                    console.log('[Main] Created output directory:', finalOutputDir);
                }
            } else {
                // Fallback: use parent directory of archive, create subfolder with game name
                const archiveDir = path.dirname(archivePath);
                const archiveName = path.basename(archivePath, path.extname(archivePath));
                // Sanitize archive name for folder creation
                const safeName = archiveName.replace(/[^a-zA-Z0-9\s\-\[\]\(\)]/g, '').trim() || 'extracted';
                finalOutputDir = path.join(archiveDir, safeName);
                if (!fs.existsSync(finalOutputDir)) {
                    fs.mkdirSync(finalOutputDir, { recursive: true });
                    console.log('[Main] Created output directory:', finalOutputDir);
                }
            }
            
            console.log('[Main] Final output directory:', finalOutputDir);
            console.log('[Main] Starting extraction...');

            // Extract gameName from the output directory name for progress updates
            const gameName = path.basename(finalOutputDir);

            await extractArchive(archivePath, finalOutputDir, (progress) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('extraction-progress', {
                        filename: path.basename(archivePath),
                        gameName: gameName,
                        ...progress
                    });
                }
            });

            console.log('[Main] Extraction completed successfully');

            // Check for nested archives in the output directory (e.g. RAR inside ZIP)
            console.log('[Main] Checking for nested archives...');
            const nestedArchive = findMainArchive(finalOutputDir);

            if (nestedArchive && nestedArchive !== archivePath) {
                console.log('[Main] Found nested archive, extracting:', nestedArchive);

                await extractArchive(nestedArchive, finalOutputDir, (progress) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('extraction-progress', {
                            filename: path.basename(nestedArchive),
                            gameName: gameName,
                            ...progress
                        });
                    }
                });

                console.log('[Main] Nested extraction completed');
            } else {
                console.log('[Main] No nested archives found');
            }

            return { success: true, outputDir: finalOutputDir };
        } catch (error) {
            console.error('[Main] Extraction error:', error);
            console.error('[Main] Error stack:', error.stack);
            return { success: false, error: error.message };
        }
    });

    // Torrent download handlers
    ipcMain.handle('start-download', async (event, { magnetLink, gameName }) => {
        return await torrentManager.startDownload(magnetLink, gameName, (progress) => {
            // Send progress updates to renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-progress', progress);
            }
        });
    });

    ipcMain.handle('pause-download', async (event, infoHash) => {
        return torrentManager.pauseDownload(infoHash);
    });

    ipcMain.handle('resume-download', async (event, infoHash) => {
        return torrentManager.resumeDownload(infoHash);
    });

    ipcMain.handle('cancel-download', async (event, infoHash) => {
        return torrentManager.cancelDownload(infoHash);
    });

    ipcMain.handle('get-download-progress', async (event, infoHash) => {
        return torrentManager.getDownloadProgress(infoHash);
    });

    ipcMain.handle('get-all-downloads', async () => {
        return torrentManager.getAllDownloads();
    });

    ipcMain.handle('set-download-path', async (event, newPath) => {
        torrentManager.setDownloadPath(newPath);
        return true;
    });

    // Torrent Search handlers
    ipcMain.handle('search-game-steamgrid', async (event, gameName) => {
        try {
            const apiKey = store.get('apiKey');
            if (!apiKey) {
                return { success: false, error: 'SteamGridDB API key not set' };
            }
            const games = await searchGameDetailed(gameName, apiKey);
            return { success: true, data: games };
        } catch (error) {
            console.error('[SteamGridDB Search] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-game-covers', async (event, gameName) => {
        try {
            const apiKey = store.get('apiKey');
            if (!apiKey) {
                return { success: false, error: 'SteamGridDB API key not set' };
            }

            // Step 1: Search for the game to get its ID
            const searchResponse = await fetch(
                `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                }
            );

            if (!searchResponse.ok) {
                return { success: false, error: 'Failed to search game on SteamGridDB' };
            }

            const searchData = await searchResponse.json();

            if (!searchData.data || searchData.data.length === 0) {
                return { success: false, error: 'Game not found on SteamGridDB' };
            }

            // Filter results to find the best match (exclude toolkits, servers, etc.)
            let bestMatch = searchData.data[0];
            const excludeTerms = ['toolkit', 'dedicated server', 'soundtrack', 'dlc', ' bonus content'];

            // Try to find a result that doesn't contain excluded terms
            const filteredMatch = searchData.data.find(game => {
                const nameLower = game.name.toLowerCase();
                return !excludeTerms.some(term => nameLower.includes(term));
            });

            if (filteredMatch) {
                bestMatch = filteredMatch;
            }

            // If we have an exact name match that passes filters, prefer that
            const exactMatch = searchData.data.find(game =>
                game.name.toLowerCase() === gameName.toLowerCase() &&
                !excludeTerms.some(term => game.name.toLowerCase().includes(term))
            );

            if (exactMatch) {
                bestMatch = exactMatch;
            }

            const gameId = bestMatch.id;
            console.log('[SteamGridDB] Found game:', bestMatch.name, 'ID:', gameId, '(Original query:', gameName, ')');

            // Step 2: Fetch grids/covers for the game
            const gridsResponse = await fetch(
                `https://www.steamgriddb.com/api/v2/grids/game/${gameId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                }
            );

            if (!gridsResponse.ok) {
                return { success: false, error: 'Failed to fetch covers from SteamGridDB' };
            }

            const gridsData = await gridsResponse.json();

            if (!gridsData.data || gridsData.data.length === 0) {
                return { success: false, error: 'No covers found for this game' };
            }

            const covers = gridsData.data.map(cover => cover.url);
            return { success: true, data: covers };
        } catch (error) {
            console.error('[SteamGridDB Covers] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('search-torrents', async (event, { gameName, options }) => {
        try {
            const results = await torrentSearch.searchTorrents(gameName, options);
            return { success: true, data: results };
        } catch (error) {
            console.error('[Torrent Search] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-torrent-details', async (event, { detailUrl, source }) => {
        try {
            const details = await torrentSearch.getTorrentDetails(detailUrl, source);
            return { success: true, data: details };
        } catch (error) {
            console.error('[Torrent Details] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Open External Link
    ipcMain.handle('open-external', async (event, url) => {
        await shell.openExternal(url);
        return { success: true };
    });

    // VirusTotal Handlers
    ipcMain.handle('set-virustotal-api-key', async (event, key) => {
        store.set('virustotalApiKey', key);
    });

    ipcMain.handle('get-virustotal-api-key', async () => {
        return store.get('virustotalApiKey') || '';
    });

    ipcMain.handle('scan-file-virustotal', async (event, filePath) => {
        try {
            const apiKey = store.get('virustotalApiKey');
            if (!apiKey) {
                return { success: false, error: 'VirusTotal API key not set' };
            }

            // 1. Calculate file hash
            const hash = await calculateFileHash(filePath);
            console.log(`[VirusTotal] File hash (SHA256): ${hash}`);

            // 2. Get report
            const report = await getFileReport(hash, apiKey);

            if (report.notFound) {
                return { success: true, status: 'unknown', hash };
            }

            const stats = report.data.attributes.last_analysis_stats;
            const malicious = stats.malicious;

            return {
                success: true,
                status: malicious > 0 ? 'malicious' : 'clean',
                stats,
                hash,
                permalink: report.data.links.self
            };
        } catch (error) {
            console.error('[VirusTotal] Scan error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('scan-hash-virustotal', async (event, hash) => {
        try {
            const apiKey = store.get('virustotalApiKey');
            if (!apiKey) {
                return { success: false, error: 'VirusTotal API key not set' };
            }

            console.log(`[VirusTotal] Checking hash: ${hash}`);

            // Get report
            const report = await getFileReport(hash, apiKey);

            if (report.notFound) {
                return { success: true, status: 'unknown', hash };
            }

            const stats = report.data.attributes.last_analysis_stats;
            const malicious = stats.malicious;

            return {
                success: true,
                status: malicious > 0 ? 'malicious' : 'clean',
                stats,
                hash,
                permalink: report.data.links.self
            };
        } catch (error) {
            console.error('[VirusTotal] Hash check error:', error);
            return { success: false, error: error.message };
        }
    });

    // Window controls
    ipcMain.handle('toggle-fullscreen', async () => {
        if (mainWindow) {
            const isFullScreen = mainWindow.isFullScreen();
            mainWindow.setFullScreen(!isFullScreen);
            return !isFullScreen;
        }
        return false;
    });

    // Installer handler
    ipcMain.handle('run-installer', async (event, folderPath) => {
        try {
            const fs = await import('fs');
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Look for setup.exe or similar installer files
            const installerNames = ['setup.exe', 'install.exe', 'installer.exe', 'Setup.exe', 'Install.exe'];

            for (const installerName of installerNames) {
                const installerPath = path.join(folderPath, installerName);
                if (fs.existsSync(installerPath)) {
                    console.log('[Installer] Found installer:', installerPath);
                    // Launch the installer
                    await shell.openPath(installerPath);
                    return { success: true, path: installerPath };
                }
            }

            // If no installer found in root, search subdirectories
            const files = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const file of files) {
                if (file.isDirectory()) {
                    const subPath = path.join(folderPath, file.name);
                    for (const installerName of installerNames) {
                        const installerPath = path.join(subPath, installerName);
                        if (fs.existsSync(installerPath)) {
                            console.log('[Installer] Found installer in subdirectory:', installerPath);
                            await shell.openPath(installerPath);
                            return { success: true, path: installerPath };
                        }
                    }
                }
            }

            return { success: false, error: 'No installer found' };
        } catch (error) {
            console.error('[Installer] Error:', error);
            return { success: false, error: error.message };
        }
    });


    createWindow();

    // Initialize process monitor for automatic session tracking
    console.log('[ProcessMonitor] Initializing automatic session tracking...');

    // Set up event handlers
    processMonitor.on('game-started', ({ gameId, gameName }) => {
        console.log(`[ProcessMonitor] Game started: ${gameName}`);
        startSession(gameId, gameName);

        // Minimize window when game starts
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
            console.log('[Window] Minimized launcher window');

            // Notify frontend to disable controller (optional, keeping logic ready)
            // mainWindow.webContents.send('controller-disable');
        }
    });

    processMonitor.on('game-stopped', ({ gameId, gameName }) => {
        console.log(`[ProcessMonitor] Game stopped: ${gameName}`);
        endSession(gameId);

        // Restore and focus window when game stops
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            console.log('[Window] Restored and focused launcher window');

            // Notify frontend to refresh playtime
            mainWindow.webContents.send('controller-enable'); // Using this event to trigger refresh
        }
    });

    // Register all games that have executables stored
    setTimeout(async () => {
        try {
            const games = await getSteamGames();
            const customGames = store.get('customGames') || [];
            const allGames = [...games, ...customGames];
            const executables = getAllGameExecutables();

            console.log('[ProcessMonitor] Registering games with stored executables...');
            for (const game of allGames) {
                let executableName = executables[game.id];

                // If not stored, try to use the one auto-detected from Steam
                if (!executableName && game.executable) {
                    executableName = game.executable;
                    // Optionally store it for next time, though we re-scan on startup anyway
                    setGameExecutable(game.id, executableName);
                }

                if (executableName) {
                    processMonitor.registerGame(game.id, game.name, executableName);
                    console.log(`[ProcessMonitor] Registered: ${game.name} -> ${executableName}`);
                }
            }

            // Start monitoring
            processMonitor.start();
            console.log('[ProcessMonitor] Automatic session tracking started!');
        } catch (error) {
            console.error('[ProcessMonitor] Error during initialization:', error);
        }
    }, 2000); // Wait 2 seconds for app to fully initialize

    // Test Steam detection in background (non-blocking)
    setTimeout(async () => {
        console.log('=== Testing Steam Detection (Background) ===');
        try {
            const testGames = await getSteamGames();
            console.log('TEST: Found', testGames.length, 'games');
            if (testGames.length > 0) {
                console.log('TEST: First game:', testGames[0]);
            }
        } catch (error) {
            console.error('TEST: Error during background test:', error);
        }
    }, 1000);
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Clean up before quitting
        console.log('[App] Cleaning up before quit...');
        processMonitor.stop();
        endAllActiveSessions();
        app.quit();
    }
});

// Handle app quit
app.on('before-quit', () => {
    console.log('[App] App is quitting, ending all active sessions...');
    processMonitor.stop();
    endAllActiveSessions();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
