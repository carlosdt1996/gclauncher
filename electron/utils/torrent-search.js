import { BrowserWindow } from 'electron';
import { load } from 'cheerio';

// Torrent sites to search (in order of preference)
const TORRENT_SITES = [
    {
        name: 'Rutor.info',
        search: searchRutor
    },
    {
        name: 'BitSearch',
        searchUrl: (query) => `https://bitsearch.to/search?q=${encodeURIComponent(query)}`,
        parseResults: parseBitSearch
    }
];

// Direct Rutor.info Search (for FitGirl games)
async function searchRutor(query) {
    // Remove repacker names from query if present (e.g., "Game Name fitgirl" -> "Game Name")
    // Search with just the game name, filter for FitGirl later
    const repackerNames = ['fitgirl', 'fit girl', 'fit-girl', 'elamigos', 'el amigos', 'el-amigos', 'rune', 'empress', 'tenoke', 'dodi'];
    let cleanQuery = query;
    
    // Remove repacker names from the end of the query
    for (const repacker of repackerNames) {
        const regex = new RegExp(`\\s+${repacker.replace(/[-\s]/g, '[\\s-]?')}\\s*$`, 'i');
        cleanQuery = cleanQuery.replace(regex, '').trim();
    }
    
    try {
        // Use the simple path-based search format: /search/{query}
        const searchUrl = `https://rutor.info/search/${encodeURIComponent(cleanQuery)}`;
        
        if (cleanQuery !== query) {
            console.log(`[Rutor] Cleaned query: "${query}" -> "${cleanQuery}"`);
        }
        console.log(`[Rutor] Using search URL: ${searchUrl}`);
        const html = await scrapeWithWindow(searchUrl);
        const $ = load(html);
        const allResults = [];

        // Parse rutor.info search results - get ALL results first
        // Results are in a table with structure: Date | Name | Size | Peers
        $('table tr').each((i, elem) => {
            const $row = $(elem);
            
            // Skip header rows
            if ($row.find('th').length > 0) return;
            
            // Find the title link (the main link in the "Название" column)
            // Skip magnet and download links
            const titleLink = $row.find('td a').filter((i, el) => {
                const href = $(el).attr('href') || '';
                return !href.startsWith('magnet:') && 
                       !href.includes('/download/') && 
                       href.includes('/torrent/');
            }).first();
            
            const name = titleLink.text().trim();
            
            // Skip if no name
            if (!name) return;

            // Get detail URL
            let detailUrl = titleLink.attr('href');
            if (!detailUrl) return;
            
            // Make absolute URL if needed
            if (!detailUrl.startsWith('http')) {
                detailUrl = detailUrl.startsWith('/') ? `https://rutor.info${detailUrl}` : `https://rutor.info/${detailUrl}`;
            }

            // Extract size from the "Размер" column
            const cells = $row.find('td');
            let size = 'Unknown';
            // Size is typically in the 3rd column (index 2)
            if (cells.length >= 3) {
                const sizeText = cells.eq(2).text().trim();
                const sizeMatch = sizeText.match(/([0-9.]+\s*[GMKT]i?B)/i);
                if (sizeMatch) size = sizeMatch[1];
            }

            // Extract seeders/leechers from the "Пиры" column (last column)
            let seeders = 0;
            let leechers = 0;
            if (cells.length >= 4) {
                const peersText = cells.eq(3).text();
                // Parse format like "33 25" (seeders leechers) or with arrows/images
                // Extract all numbers from the text
                const numbers = peersText.match(/\d+/g);
                if (numbers && numbers.length >= 2) {
                    seeders = parseInt(numbers[0]) || 0;
                    leechers = parseInt(numbers[1]) || 0;
                } else if (numbers && numbers.length === 1) {
                    seeders = parseInt(numbers[0]) || 0;
                }
            }

            // Get magnet link from the row (usually marked with [M])
            let magnetLink = $row.find('a[href^="magnet:"]').first().attr('href');
            
            allResults.push({
                name,
                detailUrl,
                magnetLink: magnetLink || '', // Will be fetched from detail page if needed
                seeders,
                leechers,
                size,
                source: 'Rutor.info',
                repacker: 'Unknown', // Will be determined after filtering
                _needsDetailFetch: !magnetLink
            });
        });

        // Filter for FitGirl results only (case insensitive)
        const fitgirlResults = allResults.filter(result => {
            const nameLower = result.name.toLowerCase();
            return nameLower.includes('fitgirl') || 
                   nameLower.includes('fit girl') || 
                   nameLower.includes('fit-girl');
        });

        // Set repacker to FitGirl for filtered results
        fitgirlResults.forEach(result => {
            result.repacker = 'FitGirl';
        });

        console.log(`[Rutor] Found ${allResults.length} total results, ${fitgirlResults.length} FitGirl results`);

        // Fetch magnet links from detail pages if needed (limit to avoid too many requests)
        const resultsNeedingFetch = fitgirlResults.filter(r => r._needsDetailFetch).slice(0, 10);
        for (const result of resultsNeedingFetch) {
            if (result.detailUrl) {
                try {
                    const detailHtml = await scrapeWithWindow(result.detailUrl);
                    const $d = load(detailHtml);
                    const magnet = $d('a[href^="magnet:"]').first().attr('href');
                    if (magnet) {
                        result.magnetLink = magnet;
                    }
                    delete result._needsDetailFetch;
                } catch (e) {
                    console.error(`[Rutor] Failed to fetch magnet for ${result.name}:`, e);
                }
            }
        }

        // Filter to only return results with magnet links
        return fitgirlResults.filter(r => r.magnetLink);
    } catch (e) {
        console.error('[Rutor] Search failed:', e);
        return [];
    }
}

// Direct ElAmigos Search
async function searchElAmigos(query) {
    // Try elamigos.site
    const searchUrl = `https://elamigos.site/?s=${encodeURIComponent(query)}`;
    try {
        const html = await scrapeWithWindow(searchUrl);
        const $ = load(html);
        const candidates = [];

        // Parse search results (assuming standard WP structure or similar)
        $('article, .post').each((i, elem) => {
            if (candidates.length >= 3) return false;
            const $article = $(elem);
            const titleLink = $article.find('h2 a, h1 a, .entry-title a').first();
            const title = titleLink.text().trim();
            const url = titleLink.attr('href');

            if (title && url) {
                candidates.push({ title, url });
            }
        });

        console.log(`[ElAmigos] Found ${candidates.length} candidates for "${query}"`);

        const results = [];
        for (const cand of candidates) {
            try {
                console.log(`[ElAmigos] Fetching details for ${cand.title}...`);
                const detailHtml = await scrapeWithWindow(cand.url);
                const $d = load(detailHtml);

                // Parse size from title (e.g. "Game Name, 17.11GB")
                let size = 'Unknown';
                const titleText = $d('h3').first().text();
                const sizeMatch = titleText.match(/,\s*([0-9.]+\s*[GM]B)/i);
                if (sizeMatch) size = sizeMatch[1];

                // 1. Try direct magnet (rare on main site)
                let magnetLink = $d('a[href^="magnet:"]').first().attr('href');

                // 2. Try to find the "Download" section links
                if (!magnetLink) {
                    // Look for links to elamigos-games.com or similar, or "Download Torrent" buttons
                    const torrentLink = $d('a').filter((i, el) => {
                         return $d(el).text().toLowerCase().includes('torrent') || 
                                ($d(el).attr('href') && $d(el).attr('href').includes('torrent'));
                    }).first().attr('href');

                    if (torrentLink && torrentLink.startsWith('magnet:')) {
                        magnetLink = torrentLink;
                    }
                }
                
                // 3. Check for ANY magnet link in source
                if (!magnetLink) {
                    const match = detailHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/);
                    if (match) magnetLink = match[0];
                }

                // 4. Extract DDL Links (Rapidgator/DDownload)
                const ddlLinks = [];
                $d('h3, h4, strong').each((i, elem) => {
                    const text = $d(elem).text().trim().toUpperCase();
                    if (text.includes('RAPIDGATOR') || text.includes('DDOWNLOAD')) {
                        const host = text.includes('RAPIDGATOR') ? 'Rapidgator' : 'DDownload';
                        
                        let next = $d(elem).next();
                        while (next.length && !next.is('h3, h4, h2')) {
                            next.find('a').each((j, a) => {
                                const href = $d(a).attr('href');
                                if (href && (href.includes('filecrypt') || href.includes('keeplinks'))) {
                                    ddlLinks.push({ host, url: href });
                                }
                            });
                            next = next.next();
                        }
                    }
                });

                if (magnetLink) {
                    results.push({
                        name: cand.title,
                        detailUrl: cand.url,
                        magnetLink,
                        seeders: 100,
                        leechers: 100,
                        size,
                        source: 'ElAmigos Site',
                        repacker: 'ElAmigos'
                    });
                }

                // Push DDL results
                ddlLinks.forEach(link => {
                    results.push({
                        name: cand.title,
                        detailUrl: link.url,
                        magnetLink: '', // Empty for DDL
                        ddlUrl: link.url,
                        seeders: 0,
                        leechers: 0,
                        size,
                        source: `ElAmigos - ${link.host}`,
                        repacker: 'ElAmigos'
                    });
                });

            } catch (e) {
                console.error(`[ElAmigos] Failed to fetch details for ${cand.title}:`, e);
            }
        }
        return results;
    } catch (e) {
        console.error('[ElAmigos] Search failed:', e);
        return [];
    }
}

// Scrape using BrowserWindow to bypass Cloudflare (similar to fitgirl.js)
async function scrapeWithWindow(url) {
    console.log(`[TorrentSearch] Scraping: ${url}`);
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
                console.error('[TorrentSearch] Scrape timeout');
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
            console.error('[TorrentSearch] Scrape failed:', errorDescription);
            clearTimeout(timeout);
            if (!win.isDestroyed()) win.destroy();
            reject(new Error(errorDescription));
        });
    });
}


// BitSearch Provider
const BITSEARCH_URL = 'https://bitsearch.to';
function parseBitSearch(html) {
    const $ = load(html);
    const results = [];

    // Results are in a container with class space-y-4
    $('.space-y-4 > div').each((i, elem) => {
        const $row = $(elem);
        const nameElem = $row.find('h3 a');
        const name = nameElem.text().trim();
        const detailUrl = nameElem.attr('href');
        const magnetLink = $row.find('a[href^="magnet:"]').first().attr('href');

        // Stats
        const size = $row.find('.fa-download').first().next('span').text().trim() ||
            $row.find('.fa-download').first().parent().text().trim();

        const seeders = parseInt($row.find('.fa-arrow-up').next('.font-medium').text().trim()) || 0;
        const leechers = parseInt($row.find('.fa-arrow-down').next('.font-medium').text().trim()) || 0;

        if (name && magnetLink) {
            results.push({
                name,
                detailUrl: detailUrl ? `${BITSEARCH_URL}${detailUrl}` : '',
                magnetLink,
                seeders,
                leechers,
                size,
                source: 'BitSearch'
            });
        }
    });

    return results;
}

// Filter results for FitGirl, ElAmigos, RUNE, EMPRESS, TENOKE, and DODI repacks
function filterRepacks(results, repackers = ['fitgirl', 'elamigos', 'rune', 'empress', 'tenoke', 'dodi']) {
    return results.filter(result => {
        const nameLower = result.name.toLowerCase();
        const match = repackers.some(repacker => {
            if (repacker === 'fitgirl') {
                return nameLower.includes('fitgirl') || nameLower.includes('fit girl') || nameLower.includes('fit-girl');
            } else if (repacker === 'elamigos') {
                return nameLower.includes('elamigos') || nameLower.includes('el amigos') || nameLower.includes('el-amigos');
            } else if (repacker === 'rune') {
                return nameLower.includes('rune');
            } else if (repacker === 'empress') {
                return nameLower.includes('empress');
            } else if (repacker === 'tenoke') {
                return nameLower.includes('tenoke');
            } else if (repacker === 'dodi') {
                return nameLower.includes('dodi');
            }
            return false;
        });
        return match;
    });
}

// Helper to convert Roman numerals to Arabic
function convertRomanToArabic(text) {
    const romanMap = {
        'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
        'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10',
        'XI': '11', 'XII': '12', 'XIII': '13', 'XIV': '14', 'XV': '15'
    };

    const words = text.split(/\s+/);
    let modified = false;

    const newWords = words.map(word => {
        // Remove common punctuation for checking
        const cleanWord = word.replace(/[:\-]/g, '');
        const upper = cleanWord.toUpperCase();

        if (romanMap[upper]) {
            modified = true;
            return romanMap[upper];
        }
        return word;
    });

    return modified ? newWords.join(' ') : null;
}

// Main search function
export async function searchTorrents(gameName, options = {}) {
    const {
        repackers = ['fitgirl', 'elamigos', 'rune', 'empress', 'tenoke', 'dodi'],
        maxResults = 20,
        minSeeders = 0
    } = options;

    console.log(`[TorrentSearch] Searching for "${gameName}" (repackers: ${repackers.join(', ')})`);

    let queries = [gameName];
    const altQuery = convertRomanToArabic(gameName);
    if (altQuery) {
        console.log(`[TorrentSearch] Adding alternative query: "${altQuery}"`);
        queries.push(altQuery);
    }

    const allResults = [];
    const seenMagnets = new Set();

    // Helper to perform search for a single query on a single site
    const searchSite = async (query, site) => {
        try {
            console.log(`[TorrentSearch] Searching ${site.name} for "${query}"...`);
            let results = [];
            if (site.search) {
                // Custom search function (for direct sites)
                results = await site.search(query);
            } else {
                // Standard scraper
                const searchUrl = site.searchUrl(query);
                const html = await scrapeWithWindow(searchUrl);
                results = site.parseResults(html);
            }
            console.log(`[TorrentSearch] Found ${results.length} results from ${site.name}`);
            return { siteName: site.name, results };
        } catch (error) {
            console.warn(`[TorrentSearch] Error searching ${site.name}:`, error.message);
            return { siteName: site.name, results: [] };
        }
    };

    // Sequential search: Rutor first, then BitSearch as fallback
    const performSearch = async (searchQueries) => {
        const allSiteResults = [];

        // First, search Rutor.info for all queries
        for (const query of searchQueries) {
            const rutorSite = TORRENT_SITES.find(s => s.name === 'Rutor.info');
            if (rutorSite) {
                const result = await searchSite(query, rutorSite);
                allSiteResults.push(result);
            }
        }

        // Check if Rutor has any results
        const hasRutorResults = allSiteResults.some(r => r.siteName === 'Rutor.info' && r.results && r.results.length > 0);

        // Only search BitSearch if Rutor has no results
        if (!hasRutorResults) {
            console.log('[TorrentSearch] No Rutor.info results found. Searching BitSearch as fallback...');
            const bitSearchSite = TORRENT_SITES.find(s => s.name === 'BitSearch');
            if (bitSearchSite) {
                for (const query of searchQueries) {
                    const result = await searchSite(query, bitSearchSite);
                    allSiteResults.push(result);
                }
            }
        } else {
            console.log('[TorrentSearch] Rutor.info (FitGirl) results found. Skipping BitSearch.');
        }

        for (const { siteName, results } of allSiteResults) {
            if (!results || results.length === 0) continue;

            // Exclusive Priority Filter: Rutor.info (FitGirl) > Others
            if (hasRutorResults) {
                if (siteName !== 'Rutor.info') continue;
            }

            let filtered = results;
            const isDirectSite = siteName === 'Rutor.info';

            if (!isDirectSite) {
                filtered = filterRepacks(results, repackers);
                console.log(`[TorrentSearch] ${filtered.length} results from ${siteName} match repack filters`);
            } else {
                console.log(`[TorrentSearch] Skipping repack filter for direct site ${siteName}`);
            }

            for (const result of filtered) {
                // Use magnet link as unique key if available, otherwise name
                const key = result.magnetLink || result.name;
                if (!seenMagnets.has(key)) {
                    seenMagnets.add(key);
                    
                    // Infer repacker if not set
                    if (!result.repacker) {
                        if (siteName === 'Rutor.info') result.repacker = 'FitGirl';
                        else if (siteName === 'FitGirl Site') result.repacker = 'FitGirl';
                        else {
                            // Try to guess from name
                            const lowerName = result.name.toLowerCase();
                            if (lowerName.includes('fitgirl')) result.repacker = 'FitGirl';
                            else if (lowerName.includes('dodi')) result.repacker = 'DODI';
                            else if (lowerName.includes('elamigos')) result.repacker = 'ElAmigos';
                            else if (lowerName.includes('empress')) result.repacker = 'Empress';
                            else if (lowerName.includes('tenoke')) result.repacker = 'Tenoke';
                            else if (lowerName.includes('rune')) result.repacker = 'Rune';
                            else result.repacker = 'Unknown';
                        }
                    }

                    allResults.push(result);
                }
            }
        }
    };

    // 1. Initial Search
    await performSearch(queries);

    // 2. Fallback: Specific Repacker Search
    if (allResults.length === 0) {
        console.log('[TorrentSearch] No results found. Attempting specific repacker searches...');
        const specificQueries = [];
        
        // Exclude Rune and Tenoke from specific search queries (only use for filtering)
        const activeSearchRepackers = repackers.filter(r => !['rune', 'tenoke'].includes(r.toLowerCase()));

        for (const repacker of activeSearchRepackers) {
            specificQueries.push(`${gameName} ${repacker}`);
        }
        
        if (specificQueries.length > 0) {
            await performSearch(specificQueries);
        }
    }

    // Filter by minimum seeders
    const finalResults = allResults
        .filter(r => r.seeders >= minSeeders && r.magnetLink)
        .sort((a, b) => b.seeders - a.seeders)
        .slice(0, maxResults);

    console.log(`[TorrentSearch] Returning ${finalResults.length} unique results`);
    return finalResults;
}

// Get detailed info about a specific torrent
export async function getTorrentDetails(detailUrl, source) {
    try {
        const html = await scrapeWithWindow(detailUrl);
        const $ = load(html);

        const magnetLink = $('a[href^="magnet:"]').first().attr('href') || '';
        const description = $('.nfo pre').text().trim();

        return {
            magnetLink,
            description
        };
    } catch (error) {
        console.error(`[TorrentSearch] Error getting torrent details:`, error);
        return {
            magnetLink: '',
            description: ''
        };
    }
}
