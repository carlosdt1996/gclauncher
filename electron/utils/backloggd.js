import { BrowserWindow, session } from 'electron';
import * as cheerio from 'cheerio';
import store from './store.js';

const BASE_URL = 'https://www.backloggd.com';

async function scrapeWithWindow(url) {
    console.log(`Scraping via Window: ${url}`);
    return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        win.loadURL(url);

        // Set a timeout
        const timeout = setTimeout(() => {
            if (!win.isDestroyed()) {
                console.error('Scrape timeout');
                win.destroy();
                reject(new Error('Timeout'));
            }
        }, 15000);

        win.webContents.on('dom-ready', async () => {
            try {
                // Wait a bit for any JS to run if needed, or just grab HTML
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
            console.error('Scrape failed:', errorDescription);
            clearTimeout(timeout);
            if (!win.isDestroyed()) win.destroy();
            reject(new Error(errorDescription));
        });
    });
}

export async function searchGame(query) {
    try {
        console.log(`Searching Backloggd for: ${query}`);
        const searchUrl = `${BASE_URL}/search/games/${encodeURIComponent(query)}`;

        const html = await scrapeWithWindow(searchUrl);
        const $ = cheerio.load(html);

        // Debug
        console.log('Search HTML length:', html.length);

        // Try multiple selectors
        let firstResult = $('.result .card').first();
        if (!firstResult.length) firstResult = $('.game-cover').first();
        if (!firstResult.length) firstResult = $('.card').first();

        console.log(`Search found result: ${firstResult.length > 0}`);

        if (firstResult.length) {
            let link = firstResult.is('a') ? firstResult : firstResult.find('a').first();
            if (!link.length && firstResult.parent().is('a')) link = firstResult.parent();

            const href = link.attr('href');
            const title = firstResult.find('.card-title').text().trim() || firstResult.attr('alt') || 'Unknown';

            console.log(`Found game: ${title}, URL: ${href}`);

            if (href) {
                return {
                    title,
                    url: `${BASE_URL}${href}`
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Backloggd Search Error:', error);
        return null;
    }
}

export async function getGameDetails(gameUrl) {
    try {
        console.log(`Fetching details from: ${gameUrl}`);
        const html = await scrapeWithWindow(gameUrl);
        const $ = cheerio.load(html);

        // 1. Get Rating
        let rating = $('#score h1').text().trim();
        if (!rating) rating = $('.rating-avg').text().trim();
        if (!rating) rating = $('h1.text-center').first().text().trim();

        // 2. Get Synopsis
        // Backloggd usually puts description in a paragraph within the main column
        // It might be in a div with class 'game-description' or similar, but often just <p> tags
        let synopsis = '';

        // Try specific description container if it exists
        const descContainer = $('#game-description'); // Hypothetical, check actual site structure if possible
        if (descContainer.length) {
            synopsis = descContainer.text().trim();
        } else {
            // Fallback: Look for the first substantial paragraph in the main content area
            // This is a bit heuristic.
            // Usually under the header or in a 'col-md-8'
            const paragraphs = $('.col-md-8 p');

            // Filter out short metadata paragraphs
            for (let i = 0; i < paragraphs.length; i++) {
                const text = $(paragraphs[i]).text().trim();
                if (text.length > 50) { // Assume synopsis is at least 50 chars
                    synopsis = text;
                    break;
                }
            }
        }

        // If still empty, try meta description
        if (!synopsis) {
            synopsis = $('meta[name="description"]').attr('content') || '';
        }

        return {
            rating: rating || 'N/A',
            synopsis: synopsis || 'No synopsis available.',
            url: gameUrl
        };
    } catch (error) {
        console.error('Backloggd Details Error:', error);
        return { rating: 'N/A', synopsis: 'Failed to load details.', url: gameUrl };
    }
}

export function loginToBackloggd() {
    return new Promise((resolve, reject) => {
        const loginWindow = new BrowserWindow({
            width: 500,
            height: 700,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            },
            autoHideMenuBar: true,
            title: 'Login to Backloggd'
        });

        loginWindow.loadURL(`${BASE_URL}/users/sign_in`);

        loginWindow.webContents.on('did-navigate', async (event, url) => {
            console.log('Backloggd Login Navigation:', url);
            if (url === 'https://www.backloggd.com/' || url.includes('/u/')) {
                try {
                    const cookies = await session.defaultSession.cookies.get({ domain: 'www.backloggd.com' });
                    const sessionCookie = cookies.find(c => c.name === '_backloggd_session');

                    if (sessionCookie) {
                        store.set('backloggd_session', sessionCookie.value);

                        let username = 'User';
                        if (url.includes('/u/')) {
                            username = url.split('/u/')[1].split('/')[0];
                        }
                        store.set('backloggd_username', username);

                        resolve({ success: true, username });
                        loginWindow.close();
                    }
                } catch (err) {
                    console.error('Cookie Error:', err);
                }
            }
        });

        loginWindow.on('closed', () => {
            resolve({ success: false, error: 'Window closed' });
        });
    });
}
