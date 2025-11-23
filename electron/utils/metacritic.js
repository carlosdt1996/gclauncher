import { BrowserWindow } from 'electron';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.metacritic.com';

async function scrapeWithWindow(url) {
    console.log(`[Metacritic] Scraping: ${url}`);
    return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
            width: 1000,
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
                console.error('[Metacritic] Scrape timeout');
                win.destroy();
                reject(new Error('Timeout'));
            }
        }, 20000);

        win.webContents.on('dom-ready', async () => {
            try {
                // Wait a bit for dynamic content
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
            console.error('[Metacritic] Scrape failed:', errorDescription);
            clearTimeout(timeout);
            if (!win.isDestroyed()) win.destroy();
            reject(new Error(errorDescription));
        });
    });
}


export async function searchMetacritic(query) {
    try {
        console.log(`[Metacritic] Searching for: ${query}`);
        // Search specifically for games
        const searchUrl = `${BASE_URL}/search/${encodeURIComponent(query)}/?page=1&category=13`;

        const html = await scrapeWithWindow(searchUrl);
        const $ = cheerio.load(html);

        // Metacritic search results structure
        // New design (2024/2025)
        let firstResult = $('a.c-pageSiteSearch-results-item').first();

        // Fallbacks for older designs
        if (!firstResult.length) {
            firstResult = $('.c-globalSearch_results .c-globalSearch_result').first();
        }
        if (!firstResult.length) {
            firstResult = $('.search_results .result').first();
        }

        if (firstResult.length) {
            const href = firstResult.attr('href');
            const title = firstResult.find('[data-testid="product-title"]').text().trim() || 
                          firstResult.find('.c-globalSearch_result-title').text().trim() ||
                          firstResult.text().trim();
            
            // Try to extract score from search result
            let score = firstResult.find('[data-testid="product-metascore"] span').text().trim();

            console.log(`[Metacritic] Found game: ${title}, URL: ${href}, Score: ${score}`);

            if (href) {
                return {
                    title,
                    url: `${BASE_URL}${href}`,
                    score: score || null
                };
            }
        } else {
            console.log('[Metacritic] No results found');
        }

        return null;
    } catch (error) {
        console.error('[Metacritic] Search Error:', error);
        return null;
    }
}

export async function getMetacriticScore(gameUrl) {
    try {
        console.log(`[Metacritic] Fetching score from: ${gameUrl}`);
        const html = await scrapeWithWindow(gameUrl);
        const $ = cheerio.load(html);

        // Try to find the Metascore
        // Selector 1: Newest design (2024/2025)
        let score = $('[data-testid="product-metascore"] span').first().text().trim();

        if (!score) {
            score = $('.c-siteReviewScore span').first().text().trim();
        }

        // Selector 2: Previous new design (desktop)
        if (!score) {
            score = $('.c-productScoreInfo_scoreNumber span').first().text().trim();
        }

        // Selector 2: Old design / fallback
        if (!score) {
            score = $('.metascore_w.large').first().text().trim();
        }

        // Selector 3: Another variation (mobile/responsive)
        if (!score) {
            score = $('div[title^="Metascore"] span').text().trim();
        }

        // Selector 4: Specific to game pages sometimes
        if (!score) {
            score = $('.c-siteReviewScore_background .c-siteReviewScore_xsmall').first().text().trim();
        }

        console.log(`[Metacritic] Found score: ${score}`);
        return score || 'N/A';
    } catch (error) {
        console.error('[Metacritic] Score Error:', error);
        return 'N/A';
    }
}
