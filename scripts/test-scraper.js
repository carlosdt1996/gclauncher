import { app } from 'electron';
import { searchTorrents } from '../electron/utils/torrent-search.js';

app.whenReady().then(async () => {
    console.log('Starting scraper test...');
    try {
        const results = await searchTorrents('Cyberpunk 2077', { maxResults: 5 });
        console.log('Search Results:', JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Scraper failed:', error);
    }
    app.quit();
});
