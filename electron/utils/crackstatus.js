import { BrowserWindow } from 'electron';
import { load } from 'cheerio';

const REDDIT_CRACKWATCH_URL = 'https://www.reddit.com/r/CrackWatch/search.json';
const REDDIT_CRACKWATCH_POST = 'https://www.reddit.com/r/CrackWatch/comments/p9ak4n/crack_watch_games/';

// Scrape using BrowserWindow to bypass Cloudflare
async function scrapeWithWindow(url) {
    console.log(`[CrackStatus] Scraping: ${url}`);
    return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
            width: 1200,
            height: 800,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        win.loadURL(url);

        const timeout = setTimeout(() => {
            if (!win.isDestroyed()) {
                console.error('[CrackStatus] Scrape timeout');
                win.destroy();
                reject(new Error('Timeout'));
            }
        }, 30000);

        win.webContents.on('dom-ready', async () => {
            try {
                await new Promise(r => setTimeout(r, 2000));
                const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
                clearTimeout(timeout);
                if (!win.isDestroyed()) win.destroy();
                resolve(html);
            } catch (err) {
                clearTimeout(timeout);
                if (!win.isDestroyed()) win.destroy();
                reject(err);
            }
        });

        win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('[CrackStatus] Scrape failed:', errorDescription);
            clearTimeout(timeout);
            if (!win.isDestroyed()) win.destroy();
            reject(new Error(errorDescription));
        });
    });
}

/**
 * Check if a game is cracked by searching r/CrackWatch
 * @param {string} gameName - The name of the game to check
 * @returns {Promise<{isCracked: boolean|null, details?: string}>} - null if not found, true if cracked, false if uncracked
 */
export async function checkCrackStatus(gameName) {
    try {
        console.log(`[CrackStatus] Checking crack status for: "${gameName}"`);
        
        // Load the Reddit CrackWatch post
        const html = await scrapeWithWindow(REDDIT_CRACKWATCH_POST);
        const $ = load(html);
        
        // Normalize game name for comparison (lowercase, remove special chars)
        const normalizeName = (name) => {
            return name.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        };
        
        const normalizedQuery = normalizeName(gameName);
        const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);
        
        // Reddit post content is typically in a div with class containing "usertext-body" or similar
        // Look for the post content area
        let foundGame = null;
        let isCracked = null;
        
        // Try to find the post content - Reddit uses various selectors
        const postContent = $('[data-test-id="post-content"], .usertext-body, .md, [class*="Post"]').first();
        const postText = postContent.text() || $('body').text();
        
        // Split by lines and search for the game name
        const lines = postText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        for (const line of lines) {
            const normalizedLine = normalizeName(line);
            
            // Check if this line contains the game name
            const matchCount = queryWords.filter(word => normalizedLine.includes(word)).length;
            const reverseMatch = normalizedLine.split(' ').filter(w => w.length > 2 && normalizedQuery.includes(w)).length;
            
            if (matchCount >= 2 || (matchCount >= 1 && reverseMatch >= 1)) {
                const upperLine = line.toUpperCase();
                
                // Check for crack status indicators
                if (upperLine.includes('CRACKED') || upperLine.includes('✓') || upperLine.includes('YES')) {
                    if (!upperLine.includes('NOT CRACKED') && !upperLine.includes('UNCRACKED') && !upperLine.includes('NO')) {
                        foundGame = line.substring(0, 150);
                        isCracked = true;
                        break;
                    }
                } else if (upperLine.includes('NOT CRACKED') || upperLine.includes('UNCRACKED') || 
                          (upperLine.includes('NO') && upperLine.includes('CRACK'))) {
                    foundGame = line.substring(0, 150);
                    isCracked = false;
                    break;
                }
            }
        }
        
        // If not found in text, try searching in list items or table rows
        if (foundGame === null) {
            $('li, tr, p').each((i, elem) => {
                const $elem = $(elem);
                const text = $elem.text().trim();
                if (!text) return;
                
                const normalizedText = normalizeName(text);
                const matchCount = queryWords.filter(word => normalizedText.includes(word)).length;
                
                if (matchCount >= 2 || (matchCount >= 1 && text.length > 5)) {
                    const upperText = text.toUpperCase();
                    
                    if (upperText.includes('CRACKED') || upperText.includes('✓')) {
                        if (!upperText.includes('NOT CRACKED') && !upperText.includes('UNCRACKED')) {
                            foundGame = text.substring(0, 150);
                            isCracked = true;
                            return false; // break
                        }
                    } else if (upperText.includes('NOT CRACKED') || upperText.includes('UNCRACKED')) {
                        foundGame = text.substring(0, 150);
                        isCracked = false;
                        return false; // break
                    }
                }
            });
        }
        
        if (foundGame) {
            console.log(`[CrackStatus] Found game: "${foundGame}" - Status: ${isCracked ? 'CRACKED' : 'UNCRACKED'}`);
            return { isCracked, details: foundGame };
        } else {
            console.log(`[CrackStatus] Game not found on r/CrackWatch`);
            return { isCracked: null };
        }
    } catch (error) {
        console.error('[CrackStatus] Error checking crack status:', error);
        return { isCracked: null };
    }
}

