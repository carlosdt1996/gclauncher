import { searchTorrents } from '../electron/utils/torrent-search.js';

async function test() {
    try {
        console.log('Testing torrent search for "Hollow Knight"...\n');
        const results = await searchTorrents('Hollow Knight', { maxResults: 5 });

        console.log('\n=== RESULTS ===');
        console.log('FitGirl Results:', results.fitgirlResults?.length || 0);
        console.log('Other Results:', results.otherResults?.length || 0);

        if (results.fitgirlResults && results.fitgirlResults.length > 0) {
            console.log('\n=== FITGIRL RESULTS ===');
            results.fitgirlResults.forEach((r, i) => {
                console.log(`\n${i + 1}. ${r.name}`);
                console.log(`   Source: ${r.source}`);
                console.log(`   Size: ${r.size}`);
                console.log(`   Seeds: ${r.seeders} | Leechers: ${r.leechers}`);
                console.log(`   Detail URL: ${r.detailUrl}`);
                console.log(`   Has Magnet: ${r.magnetLink ? 'YES ✓' : 'NO ✗'}`);
                if (r.magnetLink) {
                    console.log(`   Magnet (first 80 chars): ${r.magnetLink.substring(0, 80)}...`);
                }
            });
        }

        if (results.otherResults && results.otherResults.length > 0) {
            console.log('\n=== OTHER RESULTS ===');
            results.otherResults.forEach((r, i) => {
                console.log(`\n${i + 1}. ${r.name}`);
                console.log(`   Source: ${r.source}`);
                console.log(`   Has Magnet: ${r.magnetLink ? 'YES ✓' : 'NO ✗'}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

test();
