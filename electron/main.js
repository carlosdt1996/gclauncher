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
import { extractArchive, isArchive, findMainArchive, findISO } from './utils/extractor.js';
import processMonitor from './utils/process-monitor.js';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';

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

    /**
     * Find uninstaller executables in a directory
     */
    function findUninstaller(dirPath, maxDepth = 3, currentDepth = 0) {
        const uninstallers = [];
        if (currentDepth >= maxDepth) return uninstallers;

        try {
            if (!fs.existsSync(dirPath)) return uninstallers;

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.exe', '.bat', '.cmd'].includes(ext)) {
                        const nameLower = entry.name.toLowerCase();
                        // Look for uninstaller patterns
                        if (nameLower.includes('uninstall') || 
                            nameLower.includes('unins') ||
                            (nameLower.includes('remove') && nameLower.includes('game'))) {
                            uninstallers.push(fullPath);
                        }
                    }
                } else if (entry.isDirectory()) {
                    // Search subdirectories, but skip obvious non-game folders
                    const nameLower = entry.name.toLowerCase();
                    if (!nameLower.includes('redist') && 
                        !nameLower.includes('_redist') &&
                        !nameLower.includes('directx') &&
                        !nameLower.includes('vcredist') &&
                        !nameLower.includes('dotnet') &&
                        !nameLower.includes('temp') &&
                        !nameLower.includes('tmp')) {
                        uninstallers.push(...findUninstaller(fullPath, maxDepth, currentDepth + 1));
                    }
                }
            }
        } catch (error) {
            console.error(`[FindUninstaller] Error scanning ${dirPath}:`, error);
        }

        return uninstallers;
    }

    ipcMain.handle('remove-custom-game', async (event, gameId) => {
        const customGames = store.get('customGames') || [];
        const game = customGames.find(g => g.id === gameId);
        
        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        // If it's a custom game with an install directory, try to find and run uninstaller
        if (game.platform === 'custom' && game.installDir && fs.existsSync(game.installDir)) {
            console.log(`[Uninstall] Looking for uninstaller in: ${game.installDir}`);
            const uninstallers = findUninstaller(game.installDir, 3, 0);
            
            if (uninstallers.length > 0) {
                const uninstallerPath = uninstallers[0]; // Use first found
                console.log(`[Uninstall] Found uninstaller: ${uninstallerPath}`);
                
                // Launch the uninstaller
                console.log('[Uninstall] Launching uninstaller...');
                await shell.openPath(uninstallerPath);
                
                // Get the uninstaller process name
                const uninstallerProcessName = path.basename(uninstallerPath);
                
                // Wait for uninstaller to finish
                console.log('[Uninstall] Waiting for uninstaller to finish...');
                try {
                    await waitForProcessToFinish(uninstallerProcessName);
                    console.log('[Uninstall] Uninstaller finished');
                    
                    // Wait a bit for files to be deleted
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Check if game folder still exists
                    const gameFolderExists = fs.existsSync(game.installDir);
                    
                    if (!gameFolderExists) {
                        console.log('[Uninstall] Game folder removed, removing from library');
                        // Remove from library
                        const filtered = customGames.filter(g => g.id !== gameId);
                        store.set('customGames', filtered);
                        
                        // Notify frontend
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('games-updated');
                        }
                        
                        return { 
                            success: true, 
                            uninstallerUsed: true, 
                            folderRemoved: true,
                            message: 'Game uninstalled and removed from library'
                        };
                    } else {
                        console.log('[Uninstall] Game folder still exists after uninstaller');
                        // Ask user or just remove from library anyway
                        // For now, we'll remove from library but note that files remain
                        const filtered = customGames.filter(g => g.id !== gameId);
                        store.set('customGames', filtered);
                        
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('games-updated');
                        }
                        
                        return { 
                            success: true, 
                            uninstallerUsed: true, 
                            folderRemoved: false,
                            message: 'Uninstaller finished, but game folder still exists. Removed from library.'
                        };
                    }
                } catch (error) {
                    console.error('[Uninstall] Error waiting for uninstaller:', error);
                    // Still remove from library if user wants
                    return { 
                        success: false, 
                        error: `Uninstaller may still be running: ${error.message}`,
                        uninstallerUsed: true
                    };
                }
            } else {
                console.log('[Uninstall] No uninstaller found, just removing from library');
                // No uninstaller found, just remove from library
                const filtered = customGames.filter(g => g.id !== gameId);
                store.set('customGames', filtered);
                
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('games-updated');
                }
                
                return { 
                    success: true, 
                    uninstallerUsed: false,
                    message: 'No uninstaller found. Removed from library only.'
                };
            }
        } else {
            // Steam game or no install directory, just remove from library
            const filtered = customGames.filter(g => g.id !== gameId);
            store.set('customGames', filtered);
            
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('games-updated');
            }
            
            return { success: true, uninstallerUsed: false };
        }
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
        // Auto-scan after setting install folder
        if (folder && fs.existsSync(folder)) {
            setTimeout(async () => {
                console.log('[AutoScan] Auto-scanning after install folder change...');
                const result = await scanInstallFolderForGames();
                if (result.success && result.gamesFound > 0) {
                    console.log(`[AutoScan] Found and added ${result.gamesFound} new games`);
                }
            }, 1000);
        }
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
                    let executablePath = game.executable;
                    
                    // If executable is just a filename (not a full path), construct the full path
                    if (!path.isAbsolute(executablePath) && game.installDir) {
                        executablePath = path.join(game.installDir, executablePath);
                        console.log(`[Launch] Constructed full executable path: ${executablePath}`);
                    }
                    
                    // Verify the executable exists
                    if (!fs.existsSync(executablePath)) {
                        console.error(`[Launch] Executable not found: ${executablePath}`);
                        return { success: false, error: `Executable not found: ${executablePath}` };
                    }
                    
                    const executableName = path.basename(executablePath);
                    setGameExecutable(game.id, executableName);
                    processMonitor.registerGame(game.id, game.name, executableName);
                    console.log(`[Launch] Registered custom game ${game.name}: ${executableName}`);
                    console.log(`[Launch] Launching game with full path: ${executablePath}`);

                    // Launch the game with full path
                    await shell.openPath(executablePath);
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

            // Check for ISO files in the output directory
            console.log('[Main] Checking for ISO files...');
            const isoFile = findISO(finalOutputDir);

            if (isoFile) {
                console.log('[Main] Found ISO file:', isoFile);
                return { success: true, outputDir: finalOutputDir, isoFile: isoFile };
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

    ipcMain.handle('restore-and-focus-window', async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            console.log('[Window] Restored and focused window');
            return { success: true };
        }
        return { success: false };
    });

    /**
     * Find executable files in a directory (recursively)
     */
    function findExecutables(dirPath, maxDepth = 5, currentDepth = 0) {
        const executables = [];
        if (currentDepth >= maxDepth) return executables;

        try {
            if (!fs.existsSync(dirPath)) return executables;

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    // Common game executable extensions
                    if (['.exe', '.bat', '.cmd'].includes(ext)) {
                        const nameLower = entry.name.toLowerCase();
                        // More lenient filtering - only skip obvious installers/utilities
                        // Allow "launcher" if it's in the root or game folder (might be the main exe)
                        const isInRootOrGameFolder = currentDepth <= 1;
                        const isObviousInstaller = nameLower.includes('setup') || 
                                                   nameLower.includes('installer') ||
                                                   nameLower.includes('uninstall') ||
                                                   (nameLower.includes('redist') && !isInRootOrGameFolder);
                        
                        // Only skip launcher if it's clearly not the main game (e.g., in a launcher subfolder)
                        const isLauncherInSubfolder = nameLower.includes('launcher') && currentDepth > 1;
                        
                        if (!isObviousInstaller && !isLauncherInSubfolder) {
                            executables.push(fullPath);
                        }
                    }
                } else if (entry.isDirectory()) {
                    // Skip common non-game directories, but be more lenient
                    const nameLower = entry.name.toLowerCase();
                    const shouldSkip = nameLower.includes('redist') || 
                                      nameLower.includes('_redist') ||
                                      nameLower.includes('directx') ||
                                      nameLower.includes('vcredist') ||
                                      nameLower.includes('dotnet') ||
                                      (nameLower.includes('temp') && currentDepth > 0) ||
                                      (nameLower.includes('tmp') && currentDepth > 0) ||
                                      nameLower === 'logs' ||
                                      nameLower === 'cache';
                    
                    if (!shouldSkip) {
                        executables.push(...findExecutables(fullPath, maxDepth, currentDepth + 1));
                    }
                }
            }
        } catch (error) {
            console.error(`[FindExecutables] Error scanning ${dirPath}:`, error);
        }

        return executables;
    }

    /**
     * Mount an ISO file and return the drive letter
     */
    async function mountISO(isoPath) {
        return new Promise((resolve, reject) => {
            console.log('[ISO] Mounting ISO:', isoPath);
            
            // Use PowerShell to mount the ISO
            const psCommand = `$mount = Mount-DiskImage -ImagePath "${isoPath.replace(/"/g, '`"')}" -PassThru; $mount | Get-Volume | Select-Object -ExpandProperty DriveLetter`;
            
            exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('[ISO] Error mounting ISO:', error);
                    reject(new Error(`Failed to mount ISO: ${error.message}`));
                    return;
                }
                
                const driveLetter = stdout.trim();
                if (driveLetter && driveLetter.length === 1) {
                    const drivePath = `${driveLetter}:\\`;
                    console.log('[ISO] ISO mounted to drive:', drivePath);
                    resolve(drivePath);
                } else {
                    console.error('[ISO] Invalid drive letter received:', driveLetter);
                    reject(new Error('Failed to get drive letter after mounting ISO'));
                }
            });
        });
    }

    /**
     * Unmount an ISO file by drive letter or path
     */
    async function unmountISO(driveLetterOrPath) {
        return new Promise((resolve, reject) => {
            if (!driveLetterOrPath) {
                console.warn('[ISO] No drive path provided for unmounting');
                resolve(true);
                return;
            }
            
            console.log('[ISO] Unmounting ISO:', driveLetterOrPath);
            
            let driveLetter = driveLetterOrPath;
            if (driveLetterOrPath.length > 1) {
                // Extract drive letter from path (e.g., "D:\" -> "D")
                driveLetter = driveLetterOrPath.charAt(0);
            }
            
            // Use PowerShell to unmount the ISO - improved command that finds the ISO by drive letter
            const psCommand = `$vol = Get-Volume -DriveLetter ${driveLetter} -ErrorAction SilentlyContinue; if ($vol) { $disk = Get-Disk -Number $vol.DriveType; Get-DiskImage | Where-Object { $_.DeviceID -eq $disk.Number } | Dismount-DiskImage -ErrorAction SilentlyContinue; if ($?) { Write-Output "Unmounted" } else { Write-Output "NotMounted" } } else { Write-Output "DriveNotFound" }`;
            
            exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
                const output = stdout ? stdout.trim() : '';
                
                if (error) {
                    console.error('[ISO] Error unmounting ISO:', error);
                    // Try alternative method
                    console.log('[ISO] Trying alternative unmount method...');
                    const altCommand = `Dismount-DiskImage -ImagePath (Get-DiskImage | Where-Object { (Get-Volume -DriveLetter ${driveLetter} -ErrorAction SilentlyContinue) -ne $null } | Select-Object -First 1 -ExpandProperty ImagePath) -ErrorAction SilentlyContinue`;
                    exec(`powershell -Command "${altCommand}"`, (altError, altStdout, altStderr) => {
                        if (altError) {
                            console.warn('[ISO] Could not unmount ISO with alternative method, it may already be unmounted');
                        } else {
                            console.log('[ISO] ISO unmounted successfully with alternative method');
                        }
                        resolve(true);
                    });
                } else if (output.includes('Unmounted')) {
                    console.log('[ISO] ISO unmounted successfully');
                    resolve(true);
                } else if (output.includes('NotMounted') || output.includes('DriveNotFound')) {
                    console.log('[ISO] ISO already unmounted or drive not found');
                    resolve(true);
                } else {
                    console.log('[ISO] ISO unmount completed (status unclear, assuming success)');
                    resolve(true);
                }
            });
        });
    }

    /**
     * Find setup.exe in a mounted ISO drive
     * Prioritizes the main installer and avoids redistributable installers
     */
    function findSetupInISO(drivePath) {
        const installerNames = ['setup.exe', 'install.exe', 'installer.exe', 'Setup.exe', 'Install.exe'];
        
        // Directories to skip (redistributibles and utilities)
        const skipDirectories = [
            'redist', '_redist', 'redistributables', 'redistributable',
            'directx', 'directx_', 'dx', 'dxsetup',
            'vcredist', 'vc_redist', 'vc++', 'vc_',
            'dotnet', '.net', 'netframework',
            'physx', 'nvidia',
            'openal', 'openal32',
            'xna', 'xnafx',
            'gfwl', 'games for windows',
            'installshield', 'isxdl',
            'temp', 'tmp', 'cache',
            'tools', 'utilities', 'utils'
        ];
        
        // Helper function to check if a directory should be skipped
        function shouldSkipDirectory(dirName) {
            const dirLower = dirName.toLowerCase();
            return skipDirectories.some(skip => dirLower.includes(skip));
        }
        
        // Priority 1: Check root of ISO first (most common location for main installer)
        for (const installerName of installerNames) {
            const testPath = path.join(drivePath, installerName);
            if (fs.existsSync(testPath)) {
                console.log('[ISO] Found installer in root (PRIORITY):', testPath);
                return testPath;
            }
        }
        
        // Priority 2: Search subdirectories, but skip redistributable folders
        const foundInstallers = [];
        
        try {
            const entries = fs.readdirSync(drivePath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip redistributable directories
                    if (shouldSkipDirectory(entry.name)) {
                        console.log('[ISO] Skipping redistributable directory:', entry.name);
                        continue;
                    }
                    
                    const subPath = path.join(drivePath, entry.name);
                    
                    // Check for installer in this subdirectory
                    for (const installerName of installerNames) {
                        const testPath = path.join(subPath, installerName);
                        if (fs.existsSync(testPath)) {
                            const stats = fs.statSync(testPath);
                            foundInstallers.push({
                                path: testPath,
                                size: stats.size,
                                depth: 1,
                                dirName: entry.name
                            });
                        }
                    }
                    
                    // Check one more level deep (but still skip redistributibles)
                    try {
                        const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
                        for (const subEntry of subEntries) {
                            if (subEntry.isDirectory()) {
                                // Skip redistributable directories even at level 2
                                if (shouldSkipDirectory(subEntry.name)) {
                                    continue;
                                }
                                
                                const subSubPath = path.join(subPath, subEntry.name);
                                for (const installerName of installerNames) {
                                    const testPath = path.join(subSubPath, installerName);
                                    if (fs.existsSync(testPath)) {
                                        const stats = fs.statSync(testPath);
                                        foundInstallers.push({
                                            path: testPath,
                                            size: stats.size,
                                            depth: 2,
                                            dirName: path.join(entry.name, subEntry.name)
                                        });
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        // Ignore errors in deeper levels
                    }
                }
            }
        } catch (error) {
            console.error('[ISO] Error searching for installer in ISO:', error);
        }
        
        // If we found multiple installers, prioritize:
        // 1. The largest one (main installer is usually bigger)
        // 2. The one at depth 1 (closer to root)
        if (foundInstallers.length > 0) {
            // Sort by size (largest first), then by depth (shallower first)
            foundInstallers.sort((a, b) => {
                if (b.size !== a.size) {
                    return b.size - a.size; // Larger first
                }
                return a.depth - b.depth; // Shallower first
            });
            
            const selected = foundInstallers[0];
            console.log('[ISO] Selected installer from subdirectory:', selected.path);
            console.log('[ISO]   Size:', (selected.size / 1024 / 1024).toFixed(2), 'MB');
            console.log('[ISO]   Directory:', selected.dirName);
            return selected.path;
        }
        
        return null;
    }

    /**
     * Mount ISO and run installer
     */
    ipcMain.handle('mount-iso-and-install', async (event, isoPathOrParams) => {
        // Handle both old format (string) and new format (object)
        let isoPath, outputDir, downloadPaths;
        if (typeof isoPathOrParams === 'string') {
            // Old format: just the ISO path
            isoPath = isoPathOrParams;
            outputDir = null;
            downloadPaths = null;
        } else if (isoPathOrParams && typeof isoPathOrParams === 'object') {
            // New format: object with isoPath, outputDir, downloadPaths
            isoPath = isoPathOrParams.isoPath;
            outputDir = isoPathOrParams.outputDir;
            downloadPaths = isoPathOrParams.downloadPaths;
        } else {
            return { success: false, error: 'Invalid parameters' };
        }
        
        let drivePath = null;
        try {
            console.log('[ISO] Mounting ISO and looking for installer:', isoPath);
            console.log('[ISO] Output directory to clean:', outputDir);
            console.log('[ISO] Download paths to clean:', downloadPaths);
            
            // Notify frontend: mounting ISO
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('iso-progress', {
                    stage: 'mounting',
                    message: 'Montando ISO...'
                });
            }
            
            // Mount the ISO
            drivePath = await mountISO(isoPath);
            
            // Notify frontend: ISO mounted, searching for installer
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('iso-progress', {
                    stage: 'mounted',
                    message: 'ISO montado. Buscando instalador...',
                    drivePath: drivePath
                });
            }
            
            // Find setup.exe in the mounted ISO
            const installerPath = findSetupInISO(drivePath);
            
            if (!installerPath) {
                // Unmount before returning error
                await unmountISO(drivePath);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('iso-progress', {
                        stage: 'error',
                        message: 'No se encontró instalador en el ISO'
                    });
                }
                return { success: false, error: 'No installer found in ISO', drivePath: null };
            }
            
            console.log('[ISO] Launching installer from ISO:', installerPath);
            
            // Notify frontend: installer found, launching
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('iso-progress', {
                    stage: 'installing',
                    message: 'Ejecutando instalador...',
                    installerPath: installerPath
                });
            }
            
            // Launch the installer
            await shell.openPath(installerPath);
            
            // Get the installer process name
            const installerProcessName = path.basename(installerPath);
            
            // Wait for installer to finish
            console.log('[ISO] Waiting for installer to finish...');
            try {
                await waitForProcessToFinish(installerProcessName);
                console.log('[ISO] Installer finished successfully');
                
                // Notify frontend: installation finished
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('iso-progress', {
                        stage: 'finished',
                        message: 'Instalación completada. Desmontando ISO...'
                    });
                }
                
                // Wait a moment before unmounting to ensure installer has fully released resources
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Unmount the ISO after installation
                console.log('[ISO] Unmounting ISO after installation...');
                try {
                    await unmountISO(drivePath);
                    console.log('[ISO] ISO successfully unmounted');
                } catch (unmountError) {
                    console.error('[ISO] Error unmounting ISO:', unmountError);
                    // Try one more time after a delay
                    console.log('[ISO] Retrying unmount after delay...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await unmountISO(drivePath);
                }
                
                // Clean up downloaded and extracted files
                console.log('[ISO] Cleaning up downloaded and extracted files...');
                try {
                    // Delete the ISO file
                    if (isoPath && fs.existsSync(isoPath)) {
                        console.log('[ISO] Deleting ISO file:', isoPath);
                        fs.unlinkSync(isoPath);
                        console.log('[ISO] ISO file deleted successfully');
                    }
                    
                    // Delete the output directory (extracted files)
                    if (outputDir && fs.existsSync(outputDir)) {
                        console.log('[ISO] Deleting extracted directory:', outputDir);
                        fs.rmSync(outputDir, { recursive: true, force: true });
                        console.log('[ISO] Extracted directory deleted successfully');
                    }
                    
                    // Delete downloaded files
                    if (downloadPaths && Array.isArray(downloadPaths)) {
                        for (const downloadPath of downloadPaths) {
                            if (downloadPath && fs.existsSync(downloadPath)) {
                                try {
                                    const stats = fs.statSync(downloadPath);
                                    if (stats.isFile()) {
                                        console.log('[ISO] Deleting downloaded file:', downloadPath);
                                        fs.unlinkSync(downloadPath);
                                        console.log('[ISO] Downloaded file deleted successfully');
                                    } else if (stats.isDirectory()) {
                                        console.log('[ISO] Deleting downloaded directory:', downloadPath);
                                        fs.rmSync(downloadPath, { recursive: true, force: true });
                                        console.log('[ISO] Downloaded directory deleted successfully');
                                    }
                                } catch (deleteError) {
                                    console.warn('[ISO] Could not delete download path:', downloadPath, deleteError);
                                }
                            }
                        }
                    }
                    
                    console.log('[ISO] Cleanup completed successfully');
                } catch (cleanupError) {
                    console.error('[ISO] Error during cleanup:', cleanupError);
                    // Don't fail the whole operation if cleanup fails
                }
                
                return { 
                    success: true, 
                    path: installerPath, 
                    finished: true, 
                    drivePath: null,
                    installerExecutable: installerProcessName
                };
            } catch (error) {
                console.error('[ISO] Error waiting for installer:', error);
                // Even if installer is still running, try to unmount after a delay
                // The user can manually unmount if needed
                console.log('[ISO] Installer may still be running, will attempt unmount after delay...');
                
                // Try to unmount after 30 seconds (installer might finish quickly)
                setTimeout(async () => {
                    try {
                        // Check if installer process is still running
                        exec(`tasklist /FI "IMAGENAME eq ${installerProcessName}" /FO CSV /NH`, async (checkError, checkStdout) => {
                            const isRunning = checkStdout && checkStdout.toLowerCase().includes(installerProcessName.toLowerCase());
                            
                            if (!isRunning) {
                                console.log('[ISO] Installer process no longer running, unmounting ISO...');
                                try {
                                    await unmountISO(drivePath);
                                    console.log('[ISO] ISO unmounted after delay');
                                    
                                    // Clean up files after unmounting
                                    try {
                                        if (isoPath && fs.existsSync(isoPath)) {
                                            fs.unlinkSync(isoPath);
                                            console.log('[ISO] ISO file deleted after delay');
                                        }
                                        if (outputDir && fs.existsSync(outputDir)) {
                                            fs.rmSync(outputDir, { recursive: true, force: true });
                                            console.log('[ISO] Extracted directory deleted after delay');
                                        }
                                        if (downloadPaths && Array.isArray(downloadPaths)) {
                                            for (const downloadPath of downloadPaths) {
                                                if (downloadPath && fs.existsSync(downloadPath)) {
                                                    try {
                                                        const stats = fs.statSync(downloadPath);
                                                        if (stats.isFile()) {
                                                            fs.unlinkSync(downloadPath);
                                                        } else if (stats.isDirectory()) {
                                                            fs.rmSync(downloadPath, { recursive: true, force: true });
                                                        }
                                                    } catch (deleteError) {
                                                        console.warn('[ISO] Could not delete download path:', downloadPath);
                                                    }
                                                }
                                            }
                                        }
                                    } catch (cleanupError) {
                                        console.warn('[ISO] Error during delayed cleanup:', cleanupError);
                                    }
                                    
                                    // Notify frontend
                                    if (mainWindow && !mainWindow.isDestroyed()) {
                                        mainWindow.webContents.send('iso-progress', {
                                            stage: 'finished',
                                            message: 'Instalación completada. ISO desmontado y archivos eliminados.'
                                        });
                                    }
                                } catch (unmountError) {
                                    console.warn('[ISO] Could not unmount ISO automatically:', unmountError);
                                }
                            } else {
                                console.log('[ISO] Installer still running, will retry unmount later...');
                                // Try again after 5 minutes
                                setTimeout(async () => {
                                    try {
                                        await unmountISO(drivePath);
                                        console.log('[ISO] ISO unmounted after extended delay');
                                        
                                        // Clean up files
                                        try {
                                            if (isoPath && fs.existsSync(isoPath)) {
                                                fs.unlinkSync(isoPath);
                                            }
                                            if (outputDir && fs.existsSync(outputDir)) {
                                                fs.rmSync(outputDir, { recursive: true, force: true });
                                            }
                                            if (downloadPaths && Array.isArray(downloadPaths)) {
                                                for (const downloadPath of downloadPaths) {
                                                    if (downloadPath && fs.existsSync(downloadPath)) {
                                                        try {
                                                            const stats = fs.statSync(downloadPath);
                                                            if (stats.isFile()) {
                                                                fs.unlinkSync(downloadPath);
                                                            } else if (stats.isDirectory()) {
                                                                fs.rmSync(downloadPath, { recursive: true, force: true });
                                                            }
                                                        } catch (deleteError) {
                                                            // Ignore
                                                        }
                                                    }
                                                }
                                            }
                                        } catch (cleanupError) {
                                            console.warn('[ISO] Error during extended cleanup:', cleanupError);
                                        }
                                    } catch (unmountError) {
                                        console.warn('[ISO] Could not unmount ISO automatically. User may need to unmount manually.');
                                    }
                                }, 300000); // 5 minutes
                            }
                        });
                    } catch (checkError) {
                        console.warn('[ISO] Could not check installer status, attempting unmount anyway...');
                        try {
                            await unmountISO(drivePath);
                        } catch (unmountError) {
                            console.warn('[ISO] Could not unmount ISO automatically.');
                        }
                    }
                }, 30000); // 30 seconds
                
                return { 
                    success: true, 
                    path: installerPath, 
                    finished: false, 
                    error: error.message, 
                    drivePath: drivePath,
                    installerExecutable: installerProcessName
                };
            }
        } catch (error) {
            console.error('[ISO] Error mounting ISO or running installer:', error);
            
            // Try to unmount if ISO was mounted but error occurred
            if (drivePath) {
                console.log('[ISO] Attempting to unmount ISO after error...');
                try {
                    await unmountISO(drivePath);
                    console.log('[ISO] ISO unmounted after error');
                } catch (unmountError) {
                    console.warn('[ISO] Could not unmount ISO after error:', unmountError);
                }
            }
            
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('iso-progress', {
                    stage: 'error',
                    message: `Error: ${error.message}`
                });
            }
            return { success: false, error: error.message, drivePath: null };
        }
    });

    /**
     * Manually unmount an ISO by drive path
     */
    ipcMain.handle('unmount-iso', async (event, drivePath) => {
        try {
            console.log('[ISO] Manual unmount request for:', drivePath);
            await unmountISO(drivePath);
            return { success: true };
        } catch (error) {
            console.error('[ISO] Error in manual unmount:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Wait for a process to finish
     */
    async function waitForProcessToFinish(processName, timeout = 3600000) { // 1 hour timeout
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkProcess = () => {
                exec(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`, (error, stdout) => {
                    if (error) {
                        // Process not found, it has finished
                        console.log(`[ProcessMonitor] ${processName} has finished`);
                        resolve(true);
                        return;
                    }

                    const isRunning = stdout.toLowerCase().includes(processName.toLowerCase());
                    
                    if (!isRunning) {
                        console.log(`[ProcessMonitor] ${processName} has finished`);
                        resolve(true);
                        return;
                    }

                    // Check timeout
                    if (Date.now() - startTime > timeout) {
                        console.warn(`[ProcessMonitor] Timeout waiting for ${processName} to finish`);
                        reject(new Error(`Timeout waiting for ${processName} to finish`));
                        return;
                    }

                    // Check again in 2 seconds
                    setTimeout(checkProcess, 2000);
                });
            };

            // Start checking
            checkProcess();
        });
    }

    // Installer handler
    ipcMain.handle('run-installer', async (event, folderPath) => {
        try {
            // Look for setup.exe or similar installer files
            const installerNames = ['setup.exe', 'install.exe', 'installer.exe', 'Setup.exe', 'Install.exe'];

            let installerPath = null;

            for (const installerName of installerNames) {
                const testPath = path.join(folderPath, installerName);
                if (fs.existsSync(testPath)) {
                    installerPath = testPath;
                    console.log('[Installer] Found installer:', installerPath);
                    break;
                }
            }

            // If no installer found in root, search subdirectories
            if (!installerPath) {
                const files = fs.readdirSync(folderPath, { withFileTypes: true });
                for (const file of files) {
                    if (file.isDirectory()) {
                        const subPath = path.join(folderPath, file.name);
                        for (const installerName of installerNames) {
                            const testPath = path.join(subPath, installerName);
                            if (fs.existsSync(testPath)) {
                                installerPath = testPath;
                                console.log('[Installer] Found installer in subdirectory:', installerPath);
                                break;
                            }
                        }
                        if (installerPath) break;
                    }
                }
            }

            if (!installerPath) {
                return { success: false, error: 'No installer found' };
            }

            // Launch the installer
            console.log('[Installer] Launching installer:', installerPath);
            await shell.openPath(installerPath);

            // Get the installer process name
            const installerProcessName = path.basename(installerPath);

            // Wait for installer to finish
            console.log('[Installer] Waiting for installer to finish...');
            try {
                await waitForProcessToFinish(installerProcessName);
                console.log('[Installer] Installer finished successfully');
                return { success: true, path: installerPath, finished: true };
            } catch (error) {
                console.error('[Installer] Error waiting for installer:', error);
                return { success: true, path: installerPath, finished: false, error: error.message };
            }
        } catch (error) {
            console.error('[Installer] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Find executables in game folder
    ipcMain.handle('find-game-executables', async (event, gameFolderPath) => {
        try {
            console.log('[FindExecutables] Scanning folder:', gameFolderPath);
            const executables = findExecutables(gameFolderPath);
            console.log('[FindExecutables] Found executables:', executables);
            
            // Return the first executable found (or all if needed)
            return { success: true, executables, primaryExecutable: executables.length > 0 ? executables[0] : null };
        } catch (error) {
            console.error('[FindExecutables] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Auto-scan install folder for games
    async function scanInstallFolderForGames() {
        const installFolder = store.get('installFolder');
        if (!installFolder || !fs.existsSync(installFolder)) {
            console.log('[AutoScan] Install folder not set or does not exist');
            return { success: false, error: 'Install folder not set or does not exist', gamesFound: 0 };
        }

        console.log('[AutoScan] Scanning install folder for games:', installFolder);
        const customGames = store.get('customGames') || [];
        const existingGameNames = new Set(customGames.map(g => g.name.toLowerCase()));
        const existingGamePaths = new Set(customGames.map(g => g.installDir?.toLowerCase()));
        
        let gamesFound = 0;
        const newGames = [];

        try {
            const entries = fs.readdirSync(installFolder, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                
                const gameFolderPath = path.join(installFolder, entry.name);
                const gameName = entry.name;
                
                // Skip if game already exists
                if (existingGameNames.has(gameName.toLowerCase()) || 
                    existingGamePaths.has(gameFolderPath.toLowerCase())) {
                    console.log(`[AutoScan] Skipping existing game: ${gameName}`);
                    continue;
                }

                // Find executables in this folder (increased depth to 5)
                const executables = findExecutables(gameFolderPath, 5, 0);
                
                if (executables.length > 0) {
                    // Prefer executables in root or first level, otherwise use first found
                    const rootExecutables = executables.filter(exe => {
                        const relativePath = path.relative(gameFolderPath, exe);
                        return !relativePath.includes(path.sep) || relativePath.split(path.sep).length === 1;
                    });
                    
                    const primaryExecutablePath = rootExecutables.length > 0 ? rootExecutables[0] : executables[0];
                    const primaryExecutable = path.basename(primaryExecutablePath);
                    
                    const newGame = {
                        name: gameName,
                        installDir: gameFolderPath,
                        executable: primaryExecutable,
                        platform: 'custom',
                        id: `custom-${Date.now()}-${gamesFound}`,
                        addedAt: Date.now()
                    };
                    
                    newGames.push(newGame);
                    gamesFound++;
                    console.log(`[AutoScan] Found game: ${gameName} (${primaryExecutable})`);
                    console.log(`[AutoScan]   Full path: ${primaryExecutablePath}`);
                    console.log(`[AutoScan]   Total executables found: ${executables.length}`);
                } else {
                    console.log(`[AutoScan] No executables found in: ${gameName}`);
                    console.log(`[AutoScan]   Searched path: ${gameFolderPath}`);
                }
            }

            // Add all new games to the store
            if (newGames.length > 0) {
                const updatedGames = [...customGames, ...newGames];
                store.set('customGames', updatedGames);
                console.log(`[AutoScan] Added ${newGames.length} new games to library`);
                
                // Notify frontend to refresh
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('games-updated');
                }
            }

            return { success: true, gamesFound: newGames.length, games: newGames };
        } catch (error) {
            console.error('[AutoScan] Error scanning install folder:', error);
            return { success: false, error: error.message, gamesFound: 0 };
        }
    }

    // IPC handler for manual scan
    ipcMain.handle('scan-install-folder', async () => {
        return await scanInstallFolderForGames();
    });

    // Delete downloaded file handler
    ipcMain.handle('delete-downloaded-file', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                console.log('[DeleteFile] File does not exist:', filePath);
                return { success: true, message: 'File already deleted or does not exist' };
            }

            // Check if it's a file (not a directory)
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                console.log('[DeleteFile] Path is not a file:', filePath);
                return { success: false, error: 'Path is not a file' };
            }

            // Delete the file
            fs.unlinkSync(filePath);
            console.log('[DeleteFile] Successfully deleted:', filePath);
            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            console.error('[DeleteFile] Error deleting file:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete downloaded folder handler (recursive)
    ipcMain.handle('delete-downloaded-folder', async (event, folderPath) => {
        try {
            if (!fs.existsSync(folderPath)) {
                console.log('[DeleteFolder] Folder does not exist:', folderPath);
                return { success: true, message: 'Folder already deleted or does not exist' };
            }

            // Check if it's a directory
            const stats = fs.statSync(folderPath);
            if (!stats.isDirectory()) {
                console.log('[DeleteFolder] Path is not a directory:', folderPath);
                return { success: false, error: 'Path is not a directory' };
            }

            // Recursively delete the folder and all its contents
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log('[DeleteFolder] Successfully deleted folder:', folderPath);
            return { success: true, message: 'Folder deleted successfully' };
        } catch (error) {
            console.error('[DeleteFolder] Error deleting folder:', error);
            return { success: false, error: error.message };
        }
    });

    // Scan download folder for extracted installers
    ipcMain.handle('scan-download-folder-for-installers', async () => {
        try {
            const downloadFolder = store.get('downloadFolder') || path.join(os.homedir(), 'Downloads', 'FitGirl Repacks');
            
            if (!fs.existsSync(downloadFolder)) {
                console.log('[ScanInstallers] Download folder does not exist:', downloadFolder);
                return { success: true, installers: [] };
            }

            const installers = [];
            const installerNames = ['setup.exe', 'install.exe', 'installer.exe', 'Setup.exe', 'Install.exe'];
            
            // Get all subdirectories in download folder
            const entries = fs.readdirSync(downloadFolder, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const folderPath = path.join(downloadFolder, entry.name);
                    
                    // Check if this folder contains an installer
                    let hasInstaller = false;
                    let installerPath = null;
                    
                    // Check root of folder
                    for (const installerName of installerNames) {
                        const testPath = path.join(folderPath, installerName);
                        if (fs.existsSync(testPath)) {
                            hasInstaller = true;
                            installerPath = folderPath;
                            break;
                        }
                    }
                    
                    // If not found in root, check subdirectories (up to 2 levels deep)
                    if (!hasInstaller) {
                        try {
                            const subEntries = fs.readdirSync(folderPath, { withFileTypes: true });
                            for (const subEntry of subEntries) {
                                if (subEntry.isDirectory()) {
                                    const subPath = path.join(folderPath, subEntry.name);
                                    
                                    // Check root of subdirectory
                                    for (const installerName of installerNames) {
                                        const testPath = path.join(subPath, installerName);
                                        if (fs.existsSync(testPath)) {
                                            hasInstaller = true;
                                            installerPath = subPath; // Use subdirectory where installer was found
                                            break;
                                        }
                                    }
                                    
                                    // If still not found, check one more level deep
                                    if (!hasInstaller) {
                                        try {
                                            const subSubEntries = fs.readdirSync(subPath, { withFileTypes: true });
                                            for (const subSubEntry of subSubEntries) {
                                                if (subSubEntry.isDirectory()) {
                                                    const subSubPath = path.join(subPath, subSubEntry.name);
                                                    for (const installerName of installerNames) {
                                                        const testPath = path.join(subSubPath, installerName);
                                                        if (fs.existsSync(testPath)) {
                                                            hasInstaller = true;
                                                            installerPath = subSubPath; // Use deepest directory where installer was found
                                                            break;
                                                        }
                                                    }
                                                    if (hasInstaller) break;
                                                }
                                            }
                                        } catch (error) {
                                            // Ignore errors in deeper levels
                                        }
                                    }
                                    
                                    if (hasInstaller) break;
                                }
                            }
                        } catch (error) {
                            console.error(`[ScanInstallers] Error scanning subdirectory ${folderPath}:`, error);
                        }
                    }
                    
                    if (hasInstaller) {
                        installers.push({
                            folderPath: installerPath,
                            gameName: entry.name,
                            extractedPath: installerPath
                        });
                        console.log(`[ScanInstallers] Found installer in: ${installerPath}`);
                    }
                }
            }
            
            return { success: true, installers };
        } catch (error) {
            console.error('[ScanInstallers] Error scanning download folder:', error);
            return { success: false, error: error.message, installers: [] };
        }
    });

    // Diagnostic function to check a specific folder
    ipcMain.handle('diagnose-game-folder', async (event, folderPath) => {
        try {
            if (!fs.existsSync(folderPath)) {
                return { success: false, error: 'Folder does not exist', folderPath };
            }

            const diagnostics = {
                folderPath,
                exists: true,
                isDirectory: fs.statSync(folderPath).isDirectory(),
                entries: [],
                executables: [],
                allFiles: []
            };

            const entries = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(folderPath, entry.name);
                const info = {
                    name: entry.name,
                    path: fullPath,
                    isDirectory: entry.isDirectory(),
                    isFile: entry.isFile()
                };

                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.exe', '.bat', '.cmd'].includes(ext)) {
                        diagnostics.executables.push({
                            name: entry.name,
                            path: fullPath,
                            size: fs.statSync(fullPath).size
                        });
                    }
                    diagnostics.allFiles.push(entry.name);
                }

                diagnostics.entries.push(info);
            }

            // Also search recursively
            const foundExecutables = findExecutables(folderPath, 5, 0);
            diagnostics.executablesFound = foundExecutables.map(exe => ({
                name: path.basename(exe),
                path: exe,
                relativePath: path.relative(folderPath, exe)
            }));

            return { success: true, diagnostics };
        } catch (error) {
            return { success: false, error: error.message, folderPath };
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

    // Auto-scan install folder for games on startup
    setTimeout(async () => {
        const installFolder = store.get('installFolder');
        if (installFolder && fs.existsSync(installFolder)) {
            console.log('[AutoScan] Auto-scanning install folder on startup...');
            const result = await scanInstallFolderForGames();
            if (result.success && result.gamesFound > 0) {
                console.log(`[AutoScan] Found and added ${result.gamesFound} new games`);
            }
        }
    }, 3000); // Wait 3 seconds after app initialization
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
