import WebTorrent from 'webtorrent';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import store from './store.js';

class TorrentManager {
    constructor() {
        this.client = new WebTorrent();
        this.downloads = new Map(); // infoHash -> download info
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('error', (err) => {
            console.error('[Torrent] Client error:', err);
        });
    }

    getDownloadPath() {
        const customPath = store.get('download_path');
        if (customPath) return customPath;

        // Default: Downloads/FitGirl Repacks
        const defaultPath = path.join(app.getPath('downloads'), 'FitGirl Repacks');

        // Create directory if it doesn't exist
        if (!fs.existsSync(defaultPath)) {
            fs.mkdirSync(defaultPath, { recursive: true });
        }

        return defaultPath;
    }

    startDownload(magnetLink, gameName, progressCallback) {
        return new Promise((resolve, reject) => {
            console.log(`[Torrent] Starting download: ${gameName}`);

            // Check if already exists
            // Try to parse infoHash for more reliable duplicate detection
            const infoHashMatch = magnetLink.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
            const parsedInfoHash = infoHashMatch ? infoHashMatch[1].toLowerCase() : null;
            
            const existing = this.client.get(parsedInfoHash || magnetLink);
            
            if (existing) {
                console.log('[Torrent] Torrent already exists, resuming...');
                
                const infoHash = existing.infoHash;
                const downloadInfo = this.downloads.get(infoHash);
                
                if (downloadInfo) {
                    if (existing.paused) existing.resume();
                    
                    // Set up a new interval for this new caller
                    const updateProgress = () => {
                        if (existing.destroyed) return;
                        if (downloadInfo) { 
                             downloadInfo.progress = (existing.progress * 100).toFixed(2);
                             downloadInfo.downloadSpeed = existing.downloadSpeed;
                             downloadInfo.uploadSpeed = existing.uploadSpeed;
                             downloadInfo.downloaded = existing.downloaded;
                             downloadInfo.eta = existing.timeRemaining;
                             downloadInfo.status = existing.paused ? 'paused' : (existing.done ? 'completed' : 'downloading');
                        }

                        if (progressCallback) {
                            progressCallback({
                                infoHash: downloadInfo.infoHash,
                                gameName: downloadInfo.gameName,
                                magnetLink: downloadInfo.magnetLink,
                                status: downloadInfo.status,
                                progress: downloadInfo.progress,
                                downloadSpeed: downloadInfo.downloadSpeed,
                                uploadSpeed: downloadInfo.uploadSpeed,
                                downloaded: downloadInfo.downloaded,
                                total: downloadInfo.total,
                                eta: downloadInfo.eta,
                                savePath: downloadInfo.savePath
                            });
                        }
                    };
                    
                    const progressInterval = setInterval(updateProgress, 1000);
                    
                    // If already done, make sure we send one update
                    if (existing.done) {
                        updateProgress();
                        // No need to clear interval immediately if we want to show "seeding" status or similar?
                        // But usually we stop tracking when done.
                        // However, user might want to see seeding stats. 
                        // For now, keep it running until cancelled or destroyed.
                    }

                    existing.on('done', () => {
                        if (downloadInfo) downloadInfo.status = 'completed';
                        updateProgress();
                    });
                    
                    existing.on('error', () => clearInterval(progressInterval));
                    
                    // Return serializable info immediately
                    return resolve({
                        infoHash: downloadInfo.infoHash,
                        gameName: downloadInfo.gameName,
                        magnetLink: downloadInfo.magnetLink,
                        status: downloadInfo.status,
                        progress: downloadInfo.progress,
                        downloadSpeed: downloadInfo.downloadSpeed,
                        uploadSpeed: downloadInfo.uploadSpeed,
                        downloaded: downloadInfo.downloaded,
                        total: downloadInfo.total,
                        eta: downloadInfo.eta,
                        savePath: downloadInfo.savePath
                    });
                }
            }

            const downloadPath = this.getDownloadPath();

            this.client.add(magnetLink, { path: downloadPath }, (torrent) => {
                const infoHash = torrent.infoHash;

                const downloadInfo = {
                    infoHash,
                    gameName,
                    magnetLink,
                    status: 'downloading',
                    progress: 0,
                    downloadSpeed: 0,
                    uploadSpeed: 0,
                    downloaded: 0,
                    total: torrent.length,
                    eta: Infinity,
                    savePath: path.join(downloadPath, torrent.name),
                    torrent
                };

                this.downloads.set(infoHash, downloadInfo);

                // Progress updates
                const updateProgress = () => {
                    if (torrent.destroyed) return;

                    downloadInfo.progress = (torrent.progress * 100).toFixed(2);
                    downloadInfo.downloadSpeed = torrent.downloadSpeed;
                    downloadInfo.uploadSpeed = torrent.uploadSpeed;
                    downloadInfo.downloaded = torrent.downloaded;
                    downloadInfo.eta = torrent.timeRemaining;

                    if (progressCallback) {
                        // Create a serializable object without circular references (like 'torrent')
                        progressCallback({
                            infoHash: downloadInfo.infoHash,
                            gameName: downloadInfo.gameName,
                            magnetLink: downloadInfo.magnetLink,
                            status: downloadInfo.status,
                            progress: downloadInfo.progress,
                            downloadSpeed: downloadInfo.downloadSpeed,
                            uploadSpeed: downloadInfo.uploadSpeed,
                            downloaded: downloadInfo.downloaded,
                            total: downloadInfo.total,
                            eta: downloadInfo.eta,
                            savePath: downloadInfo.savePath
                        });
                    }
                };

                const progressInterval = setInterval(updateProgress, 1000);

                torrent.on('done', () => {
                    console.log(`[Torrent] Download complete: ${gameName}`);
                    clearInterval(progressInterval);
                    downloadInfo.status = 'completed';
                    downloadInfo.progress = 100;
                    if (progressCallback) progressCallback(downloadInfo);
                    resolve(downloadInfo);
                });

                torrent.on('error', (err) => {
                    console.error(`[Torrent] Download error: ${gameName}`, err);
                    clearInterval(progressInterval);
                    downloadInfo.status = 'error';
                    downloadInfo.error = err.message;
                    if (progressCallback) progressCallback(downloadInfo);
                    reject(err);
                });

                // Return only serializable data (exclude torrent object)
                resolve({
                    infoHash,
                    gameName,
                    magnetLink,
                    status: downloadInfo.status,
                    progress: downloadInfo.progress,
                    downloadSpeed: downloadInfo.downloadSpeed,
                    uploadSpeed: downloadInfo.uploadSpeed,
                    downloaded: downloadInfo.downloaded,
                    total: downloadInfo.total,
                    eta: downloadInfo.eta,
                    savePath: downloadInfo.savePath
                });
            });
        });
    }

    pauseDownload(infoHash) {
        const download = this.downloads.get(infoHash);
        if (download && download.torrent) {
            download.torrent.pause();
            download.status = 'paused';
            download.downloadSpeed = 0;
            download.uploadSpeed = 0;
            console.log(`[Torrent] Paused: ${download.gameName}`);
            return true;
        }
        return false;
    }

    resumeDownload(infoHash) {
        const download = this.downloads.get(infoHash);
        if (download && download.torrent) {
            download.torrent.resume();
            download.status = 'downloading';
            console.log(`[Torrent] Resumed: ${download.gameName}`);
            return true;
        }
        return false;
    }

    cancelDownload(infoHash) {
        const download = this.downloads.get(infoHash);
        if (download && download.torrent) {
            download.torrent.destroy();
            this.downloads.delete(infoHash);
            console.log(`[Torrent] Cancelled: ${download.gameName}`);
            return true;
        }
        return false;
    }

    getDownloadProgress(infoHash) {
        const download = this.downloads.get(infoHash);
        if (!download) return null;

        return {
            infoHash: download.infoHash,
            gameName: download.gameName,
            status: download.status,
            progress: download.progress,
            downloadSpeed: download.downloadSpeed,
            uploadSpeed: download.uploadSpeed,
            downloaded: download.downloaded,
            total: download.total,
            eta: download.eta,
            savePath: download.savePath
        };
    }

    getAllDownloads() {
        const downloads = [];
        this.downloads.forEach((download) => {
            downloads.push(this.getDownloadProgress(download.infoHash));
        });
        return downloads;
    }

    setDownloadPath(newPath) {
        store.set('download_path', newPath);
        console.log(`[Torrent] Download path set to: ${newPath}`);
    }
}

// Singleton instance
const torrentManager = new TorrentManager();
export default torrentManager;
