import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const RD_API_BASE = 'https://api.real-debrid.com/rest/1.0';

/**
 * Add a magnet link to Real-Debrid
 * @param {string} magnetLink - The magnet link to add
 * @param {string} apiKey - Real-Debrid API key
 * @returns {Promise<{id: string, uri: string}>} Torrent info
 */
export async function addMagnet(magnetLink, apiKey) {
    try {
        const response = await axios.post(
            `${RD_API_BASE}/torrents/addMagnet`,
            new URLSearchParams({ magnet: magnetLink }),
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('[Real-Debrid] Magnet added:', response.data);
        return response.data;
    } catch (error) {
        console.error('[Real-Debrid] Error adding magnet:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Failed to add magnet to Real-Debrid');
    }
}

/**
 * Get torrent information and status
 * @param {string} torrentId - The torrent ID from Real-Debrid
 * @param {string} apiKey - Real-Debrid API key
 * @returns {Promise<Object>} Torrent info including files and status
 */
export async function getTorrentInfo(torrentId, apiKey) {
    try {
        const response = await axios.get(
            `${RD_API_BASE}/torrents/info/${torrentId}`,
            {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }
        );

        return response.data;
    } catch (error) {
        console.error('[Real-Debrid] Error getting torrent info:', error.response?.data || error.message);
        throw new Error('Failed to get torrent info');
    }
}

/**
 * Select files to download from a torrent
 * @param {string} torrentId - The torrent ID
 * @param {string} fileIds - Comma-separated file IDs (e.g., "1,2,3" or "all")
 * @param {string} apiKey - Real-Debrid API key
 */
export async function selectFiles(torrentId, fileIds, apiKey) {
    try {
        await axios.post(
            `${RD_API_BASE}/torrents/selectFiles/${torrentId}`,
            new URLSearchParams({ files: fileIds }),
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('[Real-Debrid] Files selected:', fileIds);
    } catch (error) {
        console.error('[Real-Debrid] Error selecting files:', error.response?.data || error.message);
        throw new Error('Failed to select files');
    }
}

/**
 * Get an unrestricted download link from Real-Debrid
 * @param {string} link - The Real-Debrid link to unrestrict
 * @param {string} apiKey - Real-Debrid API key
 * @returns {Promise<{download: string, filename: string, filesize: number}>}
 */
export async function getUnrestrictedLink(link, apiKey) {
    try {
        const response = await axios.post(
            `${RD_API_BASE}/unrestrict/link`,
            new URLSearchParams({ link }),
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('[Real-Debrid] Error unrestricting link:', error.response?.data || error.message);
        throw new Error('Failed to get unrestricted link');
    }
}

/**
 * Download a file from a URL with progress tracking and cancellation support
 * @param {string} url - Direct download URL
 * @param {string} savePath - Where to save the file
 * @param {Function} onProgress - Callback for progress updates (bytesDownloaded, totalBytes, percentage)
 * @param {AbortSignal} signal - AbortSignal for cancellation
 * @returns {Promise<string>} Path to downloaded file
 */
export async function downloadFile(url, savePath, onProgress, signal) {
    try {
        // Ensure directory exists
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            signal: signal, // Pass abort signal
            onDownloadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(progressEvent.loaded, progressEvent.total, percentage);
                }
            }
        });

        const writer = fs.createWriteStream(savePath);

        // Handle cancellation
        if (signal) {
            signal.addEventListener('abort', () => {
                writer.destroy();
                if (fs.existsSync(savePath)) {
                    fs.unlinkSync(savePath);
                }
            });
        }

        await pipeline(response.data, writer);

        console.log('[Real-Debrid] Download complete:', savePath);
        return savePath;
    } catch (error) {
        // Clean up partial file
        if (fs.existsSync(savePath)) {
            fs.unlinkSync(savePath);
        }

        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
            console.log('[Real-Debrid] Download canceled:', savePath);
            throw new Error('Download canceled');
        }

        console.error('[Real-Debrid] Download error:', error.message);
        throw new Error('Download failed');
    }
}

// Download manager to track active downloads
const activeDownloads = new Map();

export function startDownload(downloadId, url, savePath, onProgress) {
    const controller = new AbortController();
    activeDownloads.set(downloadId, controller);

    return downloadFile(url, savePath, onProgress, controller.signal);
}

export function cancelDownload(downloadId) {
    const controller = activeDownloads.get(downloadId);
    if (controller) {
        controller.abort();
        activeDownloads.delete(downloadId);
        return true;
    }
    return false;
}

/**
 * Delete a torrent from Real-Debrid
 * @param {string} torrentId - The torrent ID to delete
 * @param {string} apiKey - Real-Debrid API key
 */
export async function deleteTorrent(torrentId, apiKey) {
    try {
        await axios.delete(
            `${RD_API_BASE}/torrents/delete/${torrentId}`,
            {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }
        );

        console.log('[Real-Debrid] Torrent deleted:', torrentId);
    } catch (error) {
        console.error('[Real-Debrid] Error deleting torrent:', error.response?.data || error.message);
    }
}
