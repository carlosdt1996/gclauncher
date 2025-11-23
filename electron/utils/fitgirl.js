import { BrowserWindow } from 'electron';
import { load } from 'cheerio';

const BASE_URL = 'https://fitgirl-repacks.to';

// Scrape using BrowserWindow to bypass Cloudflare
async function scrapeWithWindow(url) {
    console.log(`[FitGirl] Scraping: ${url}`);
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
                console.error('[FitGirl] Scrape timeout');
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
            console.error('[FitGirl] Scrape failed:', errorDescription);
            clearTimeout(timeout);
            if (!win.isDestroyed()) win.destroy();
            reject(new Error(errorDescription));
        });
    });
}

export async function scrapeMainPageGames() {
    try {
        console.log('[FitGirl] Scraping main page for recent games...');
        const html = await scrapeWithWindow(BASE_URL);
        const $ = load(html);
        const games = [];

        $('article.post').each((i, elem) => {
            const $article = $(elem);
            const titleElem = $article.find('h1.entry-title a, h2.entry-title a');
            let title = titleElem.text().trim();
            const pageUrl = titleElem.attr('href');
            const image = $article.find('img').first().attr('src') || '';
            const content = $article.find('.entry-content').text();
            const sizeMatch = content.match(/Repack Size[:\s]+([0-9.]+\s*[GM]B)/i);
            const size = sizeMatch ? sizeMatch[1] : 'Unknown';

            if (title && pageUrl) {
                title = title
                    .replace(/\s*–\s*FitGirl Repack/i, '')
                    .replace(/\s*-\s*FitGirl Repack/i, '')
                    .replace(/\s*\(.*?Repack.*?\)/i, '')
                    .replace(/\s*\[.*?Repack.*?\]/i, '')
                    .replace(/\s*Repack\s*$/i, '')
                    .replace(/\s*v\d+\.\d+.*$/i, '')
                    .replace(/\s*\+\s*\d+\s*DLCs?.*$/i, '')
                    .replace(/\s*\(.*?Edition\)$/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                games.push({
                    id: pageUrl.split('/').filter(Boolean).pop() || `game-${i}`,
                    title,
                    image,
                    size,
                    pageUrl
                });
            }
        });

        console.log(`[FitGirl] Found ${games.length} recent games from main page`);
        return games;
    } catch (error) {
        console.error('[FitGirl] Error scraping main page:', error);
        return [];
    }
}

export async function scrapeGameDetails(pageUrl) {
    try {
        const html = await scrapeWithWindow(pageUrl);
        const $ = load(html);

        // Find magnet link with multiple selector strategies
        let magnetLink = '';

        // Strategy 1: Direct magnet link
        $('a[href^="magnet:"]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.startsWith('magnet:?xt=urn:btih:')) {
                magnetLink = href;
                return false; // break
            }
        });

        // Strategy 2: Look in specific containers if not found
        if (!magnetLink) {
            $('.entry-content a, article a').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && href.startsWith('magnet:?xt=urn:btih:')) {
                    magnetLink = href;
                    return false;
                }
            });
        }

        console.log(`[FitGirl] Magnet link found: ${magnetLink ? 'Yes' : 'No'}`);

        const image = $('article img, .entry-content img').first().attr('src') || '';
        const content = $('.entry-content').text();
        const features = [];
        const featureMatch = content.match(/Repack Features[:\s]+([\s\S]*?)(?=\n\n|$)/i);
        if (featureMatch) {
            features.push(...featureMatch[1].split('\n').filter(f => f.trim()));
        }

        return { magnetLink, image, features, fullContent: content };
    } catch (error) {
        console.error('[FitGirl] Error scraping game details:', error);
        return { magnetLink: '', image: '', features: [], fullContent: '' };
    }
}

export async function searchGames(query) {
    try {
        console.log(`[FitGirl] Searching website for "${query}"...`);
        // FitGirl uses + for spaces in search URLs
        const searchUrl = `${BASE_URL}/search/${query.replace(/\s+/g, '+')}`;
        console.log(`[FitGirl] Search URL: ${searchUrl}`);
        const html = await scrapeWithWindow(searchUrl);
        const $ = load(html);
        const games = [];

        console.log(`[FitGirl] Parsing search results...`);
        console.log(`[FitGirl] Found ${$('article.post').length} article.post elements`);
        console.log(`[FitGirl] Found ${$('article').length} article elements`);
        console.log(`[FitGirl] Found ${$('.post').length} .post elements`);

        $('article.post').each((i, elem) => {
            if (games.length >= 20) return false;

            const $article = $(elem);
            const titleElem = $article.find('h1.entry-title a, h2.entry-title a');
            let title = titleElem.text().trim();
            const pageUrl = titleElem.attr('href');
            const image = $article.find('img').first().attr('src') || '';
            const content = $article.find('.entry-content').text();
            const sizeMatch = content.match(/Repack Size[:\s]+([0-9.]+\s*[GM]B)/i);
            const size = sizeMatch ? sizeMatch[1] : 'Unknown';

            console.log(`[FitGirl] Found article: title="${title}", url="${pageUrl}", hasImage=${!!image}`);

            if (title && pageUrl) {
                title = title
                    .replace(/\s*–\s*FitGirl Repack/i, '')
                    .replace(/\s*-\s*FitGirl Repack/i, '')
                    .replace(/\s*\(.*?Repack.*?\)/i, '')
                    .replace(/\s*\[.*?Repack.*?\]/i, '')
                    .replace(/\s*Repack\s*$/i, '')
                    .replace(/\s*v\d+\.\d+.*$/i, '')
                    .replace(/\s*\+\s*\d+\s*DLCs?.*$/i, '')
                    .replace(/\s*\(.*?Edition\)$/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                games.push({
                    id: pageUrl.split('/').filter(Boolean).pop() || `game-${i}`,
                    title,
                    image,
                    size,
                    pageUrl
                });
            }
        });

        console.log(`[FitGirl] Search found ${games.length} results`);
        return games.slice(0, 20);
    } catch (error) {
        console.error('[FitGirl] Search error:', error);
        return [];
    }
}
