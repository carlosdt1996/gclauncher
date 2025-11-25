import { BrowserWindow } from 'electron';
import { load } from 'cheerio';
import { searchGameDetailed } from './steamgriddb.js';
import store from './store.js';

// Torrent sites to search (in order of preference)
const TORRENT_SITES = [
    {
        name: 'FitGirl Site',
        search: searchFitGirlSite
    },
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

        // Fetch magnet links from detail pages in parallel (limit to avoid too many requests)
        const resultsNeedingFetch = fitgirlResults.filter(r => r._needsDetailFetch).slice(0, 5);
        if (resultsNeedingFetch.length > 0) {
            const magnetFetchPromises = resultsNeedingFetch.map(async (result) => {
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
            });
            await Promise.all(magnetFetchPromises);
        }

        // Filter to only return results with magnet links
        const validResults = fitgirlResults.filter(r => r.magnetLink);

        // Filter and rank by relevance (stricter threshold for Rutor)
        const relevantResults = filterAndRankResults(validResults, cleanQuery, 50);

        return relevantResults.slice(0, 5); // Return top 5 most relevant (quality over quantity)
    } catch (e) {
        console.error('[Rutor] Search failed:', e);
        return [];
    }
}

// Helper to convert game name to FitGirl URL format (lowercase, spaces to hyphens)
// Keeps the full game name including subtitles (e.g., "Hollow Knight: Silksong" -> "hollow-knight-silksong")
function gameNameToFitGirlUrl(gameName) {
    // Keep the full name, don't remove subtitles
    // FitGirl uses the full game name in URLs
    return gameName
        .toLowerCase()
        // Normalize Unicode characters (ö->o, ñ->n, etc.)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/ø/g, 'o') // Handle special cases
        .replace(/æ/g, 'ae')
        .replace(/œ/g, 'oe')
        .replace(/ß/g, 'ss')
        .replace(/:/g, '') // Remove colons
        .replace(/'/g, '') // Remove apostrophes
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '') // Remove special characters
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Direct FitGirl Site Search (fitgirl-repacks.site)
async function searchFitGirlSite(query, targetGameName = null, sequelNumber = null, targetSubtitle = null) {
    const BASE_URL = 'https://fitgirl-repacks.site';

    try {
        console.log(`[FitGirl Site] Searching for "${query}"...`);
        if (targetGameName) {
            console.log(`[FitGirl Site] Target game name from SteamGridDB: "${targetGameName}"`);
        }

        // FIRST TRY: Direct URL access if we have SteamGridDB name
        if (targetGameName) {
            const directUrlPath = gameNameToFitGirlUrl(targetGameName);
            const directUrl = `${BASE_URL}/${directUrlPath}/`;
            console.log(`[FitGirl Site] Trying direct URL first: ${directUrl}`);

            let directResult = null;
            try {
                const directHtml = await scrapeWithWindow(directUrl);
                const $direct = load(directHtml);

                // Debug: Check what page we actually loaded
                const actualUrl = $direct('link[rel="canonical"]').attr('href') || directUrl;
                const actualTitle = $direct('title').text();
                console.log(`[FitGirl Site] Loaded page - Title: "${actualTitle}"`);
                console.log(`[FitGirl Site] Canonical URL: ${actualUrl}`);
                console.log(`[FitGirl Site] HTML length: ${directHtml.length} bytes`);

                // Check if this is a valid game page (has title with game name)
                // Try multiple selectors to find the actual game title
                let pageTitle = '';

                // Strategy 1: Look for article title (most specific)
                pageTitle = $direct('article.post h1.entry-title').first().text().trim();

                // Strategy 2: Look for entry-title in article
                if (!pageTitle || pageTitle === 'FitGirl Repacks') {
                    pageTitle = $direct('article h1').first().text().trim();
                }

                // Strategy 3: Look for any h1 inside article
                if (!pageTitle || pageTitle === 'FitGirl Repacks') {
                    pageTitle = $direct('article.post').find('h1').first().text().trim();
                }

                // Strategy 4: Fallback to meta title or use target game name
                if (!pageTitle || pageTitle === 'FitGirl Repacks') {
                    const metaTitle = $direct('meta[property="og:title"]').attr('content');
                    if (metaTitle && metaTitle !== 'FitGirl Repacks') {
                        pageTitle = metaTitle;
                    } else {
                        // Last resort: use the target game name from SteamGridDB
                        pageTitle = targetGameName;
                    }
                }

                console.log(`[FitGirl Site] Extracted page title: "${pageTitle}"`);

                const hasValidContent = $direct('article.post').length > 0 ||
                    pageTitle.toLowerCase().includes(targetGameName.toLowerCase().split(':')[0].trim()) ||
                    $direct('.entry-content').length > 0;

                if (hasValidContent && pageTitle) {
                    console.log(`[FitGirl Site] ✅ Direct URL match found! Page title: \"${pageTitle}\"`);

                    // If we found the direct URL, return immediately without strict scoring
                    // This is a direct match from SteamGridDB, so we trust it
                    const $article = $direct('article.post').first() || $direct('body');

                    // Extract details
                    const image = $article.find('img').first().attr('src') || '';
                    const content = $article.find('.entry-content').text();
                    const sizeMatch = content.match(/Repack Size[:\s]+([0-9.]+\s*[GM]B)/i);
                    let size = sizeMatch ? sizeMatch[1] : 'Unknown';

                    // Extract magnet link directly from FitGirl page
                    let magnetLink = null;
                    let seeders = 100; // Default
                    let leechers = 0;

                    // Strategy 1: Look for magnet links in article content
                    magnetLink = $article.find('a[href^="magnet:"]').first().attr('href');
                    if (!magnetLink) {
                        magnetLink = $article.find('.entry-content a[href^="magnet:"]').first().attr('href');
                    }

                    // Strategy 2: Search all magnet links in the entire page
                    if (!magnetLink) {
                        $direct('a[href^="magnet:"]').each((i, elem) => {
                            if (!magnetLink) {
                                magnetLink = $direct(elem).attr('href');
                            }
                        });
                    }

                    // Strategy 3: Check for magnet in page HTML source (sometimes embedded in scripts or comments)
                    if (!magnetLink) {
                        const magnetMatch = directHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s"'<>]*/i);
                        if (magnetMatch) {
                            magnetLink = magnetMatch[0];
                        }
                    }

                    // Strategy 4: Look for magnet in data attributes
                    if (!magnetLink) {
                        $direct('a').each((i, elem) => {
                            const $link = $direct(elem);
                            const dataMagnet = $link.attr('data-magnet') || $link.attr('data-href') || $link.attr('data-url');
                            if (dataMagnet && dataMagnet.startsWith('magnet:')) {
                                magnetLink = dataMagnet;
                                return false; // Break the loop
                            }
                        });
                    }

                    // Debug: Log all links found on the page
                    const allLinks = [];
                    $direct('a').each((i, elem) => {
                        const href = $direct(elem).attr('href');
                        if (href) {
                            allLinks.push(href.substring(0, 50));
                        }
                    });
                    console.log(`[FitGirl Site] Total links found on page: ${allLinks.length}`);
                    console.log(`[FitGirl Site] Sample links:`, allLinks.slice(0, 10));

                    if (magnetLink) {
                        console.log(`[FitGirl Site] ✅ Found magnet link from FitGirl page`);
                        console.log(`[FitGirl Site] Magnet (first 100 chars): ${magnetLink.substring(0, 100)}`);
                    } else {
                        console.log(`[FitGirl Site] ⚠️ No magnet link found on FitGirl page`);
                        console.log(`[FitGirl Site] This might be normal - FitGirl may link to external torrent sites`);
                    }

                    if (magnetLink) {
                        // Clean title for display
                        const displayTitle = pageTitle
                            .replace(/\s*–\s*FitGirl Repack/i, '')
                            .replace(/\s*-\s*FitGirl Repack/i, '')
                            .replace(/\s*\(.*?Repack.*?\)/i, '')
                            .replace(/\s*\[.*?Repack.*?\]/i, '')
                            .replace(/\s*Repack\s*$/i, '')
                            .replace(/\s+/g, ' ')
                            .trim();

                        console.log(`[FitGirl Site] ✅ Returning direct match: "${displayTitle}" (${size}, Seeds: ${seeders}, Peers: ${leechers})`);
                        directResult = [{
                            name: displayTitle,
                            detailUrl: directUrl,
                            magnetLink: magnetLink,
                            seeders: seeders,
                            leechers: leechers,
                            size,
                            source: 'FitGirl Site',
                            repacker: 'FitGirl',
                            imageUrl: image,
                            relevanceScore: 150 // High score for direct match
                        }];
                    }
                } else {
                    console.log(`[FitGirl Site] Direct URL exists but doesn't seem to be a valid game page, trying alternative...`);
                }
            } catch (directError) {
                console.log(`[FitGirl Site] Direct URL failed (404 or error), trying alternative...`);
            }

            // If direct URL didn't work, try with alternative number format (romano <-> arábigo)
            if (!directResult) {
                const altGameName = convertRomanToArabic(targetGameName) || convertArabicToRoman(targetGameName);
                if (altGameName && altGameName !== targetGameName) {
                    console.log(`[FitGirl Site] Trying alternative number format: "${targetGameName}" -> "${altGameName}"`);
                    const altDirectUrlPath = gameNameToFitGirlUrl(altGameName);
                    const altDirectUrl = `${BASE_URL}/${altDirectUrlPath}/`;
                    console.log(`[FitGirl Site] Trying alternative direct URL: ${altDirectUrl}`);

                    try {
                        const altDirectHtml = await scrapeWithWindow(altDirectUrl);
                        const $altDirect = load(altDirectHtml);

                        let altPageTitle = '';
                        altPageTitle = $altDirect('article.post h1.entry-title').first().text().trim();
                        if (!altPageTitle || altPageTitle === 'FitGirl Repacks') {
                            altPageTitle = $altDirect('article h1').first().text().trim();
                        }
                        if (!altPageTitle || altPageTitle === 'FitGirl Repacks') {
                            altPageTitle = $altDirect('article.post').find('h1').first().text().trim();
                        }
                        if (!altPageTitle || altPageTitle === 'FitGirl Repacks') {
                            const metaTitle = $altDirect('meta[property="og:title"]').attr('content');
                            if (metaTitle && metaTitle !== 'FitGirl Repacks') {
                                altPageTitle = metaTitle;
                            } else {
                                altPageTitle = altGameName;
                            }
                        }

                        const altHasValidContent = $altDirect('article.post').length > 0 ||
                            altPageTitle.toLowerCase().includes(altGameName.toLowerCase().split(':')[0].trim()) ||
                            $altDirect('.entry-content').length > 0;

                        if (altHasValidContent && altPageTitle) {
                            console.log(`[FitGirl Site] ✅ Alternative direct URL match found! Page title: "${altPageTitle}"`);
                            const $altArticle = $altDirect('article.post').first() || $altDirect('body');

                            const image = $altArticle.find('img').first().attr('src') || '';
                            const content = $altArticle.find('.entry-content').text();
                            const sizeMatch = content.match(/Repack Size[:\s]+([0-9.]+\s*[GM]B)/i);
                            let size = sizeMatch ? sizeMatch[1] : 'Unknown';

                            let magnetLink = null;
                            let seeders = 100;
                            let leechers = 0;

                            magnetLink = $altArticle.find('a[href^="magnet:"]').first().attr('href');
                            if (!magnetLink) {
                                magnetLink = $altArticle.find('.entry-content a[href^="magnet:"]').first().attr('href');
                            }
                            if (!magnetLink) {
                                $altDirect('a[href^="magnet:"]').each((i, elem) => {
                                    if (!magnetLink) {
                                        magnetLink = $altDirect(elem).attr('href');
                                    }
                                });
                            }
                            if (!magnetLink) {
                                const magnetMatch = altDirectHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s"'<>]*/i);
                                if (magnetMatch) {
                                    magnetLink = magnetMatch[0];
                                }
                            }

                            if (magnetLink) {
                                const displayTitle = altPageTitle
                                    .replace(/\s*–\s*FitGirl Repack/i, '')
                                    .replace(/\s*-\s*FitGirl Repack/i, '')
                                    .replace(/\s*\(.*?Repack.*?\)/i, '')
                                    .replace(/\s*\[.*?Repack.*?\]/i, '')
                                    .replace(/\s*Repack\s*$/i, '')
                                    .replace(/\s+/g, ' ')
                                    .trim();

                                console.log(`[FitGirl Site] ✅ Returning alternative direct match: "${displayTitle}"`);
                                directResult = [{
                                    name: displayTitle,
                                    detailUrl: altDirectUrl,
                                    magnetLink: magnetLink,
                                    seeders: seeders,
                                    leechers: leechers,
                                    size,
                                    source: 'FitGirl Site',
                                    repacker: 'FitGirl',
                                    imageUrl: image,
                                    relevanceScore: 150
                                }];
                            }
                        }
                    } catch (altDirectError) {
                        console.log(`[FitGirl Site] Alternative direct URL also failed, trying search...`);
                    }
                }
            }

            // If we got a result from direct URL (original or alternative), return it
            if (directResult) {
                return directResult;
            }
        }

        // FALLBACK: Normal search if direct URL doesn't work
        if (sequelNumber !== null) {
            console.log(`[FitGirl Site] Looking specifically for sequel #${sequelNumber}`);
        }
        if (targetSubtitle) {
            const targetParts = extractGameParts(targetSubtitle);
            console.log(`[FitGirl Site] Target has subtitle: "${targetParts.subtitle}"`);
        }

        const searchUrl = `${BASE_URL}/search/${query.replace(/\s+/g, '+')}`;
        console.log(`[FitGirl Site] Search URL: ${searchUrl}`);

        const html = await scrapeWithWindow(searchUrl);
        const $ = load(html);
        const candidates = [];

        console.log(`[FitGirl Site] Parsing search results...`);
        console.log(`[FitGirl Site] Found ${$('article.post').length} article.post elements`);

        // Collect all candidates first
        $('article.post').each((i, elem) => {
            const $article = $(elem);
            const titleElem = $article.find('h1.entry-title a, h2.entry-title a');
            let title = titleElem.text().trim();
            const pageUrl = titleElem.attr('href');

            if (title && pageUrl) {
                let cleanTitle = title
                    .replace(/\s*–\s*FitGirl Repack/i, '')
                    .replace(/\s*-\s*FitGirl Repack/i, '')
                    .replace(/\s*\(.*?Repack.*?\)/i, '')
                    .replace(/\s*\[.*?Repack.*?\]/i, '')
                    .replace(/\s*Repack\s*$/i, '')
                    .replace(/\s*\+\s*UE Unlocker.*$/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                cleanTitle = cleanTitle
                    .replace(/\s*[–-]\s*[vV]\d+\.\d+.*$/i, '')
                    .replace(/\s*[–-]\s*Build\s+\d+.*$/i, '')
                    .replace(/\s*\+\s*\d+\s*DLCs?.*$/i, '')
                    .replace(/\s*\+\s*All DLCs?.*$/i, '')
                    .replace(/\s*\+\s*Multiplayer.*$/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                candidates.push({
                    originalTitle: title,
                    cleanTitle: cleanTitle,
                    pageUrl: pageUrl,
                    $article: $article
                });
            }
        });

        console.log(`[FitGirl Site] Found ${candidates.length} candidates`);

        // Process candidates
        return await processFitGirlCandidates(candidates, targetGameName || query, null, targetSubtitle);
    } catch (error) {
        console.error('[FitGirl Site] Search error:', error);
        return [];
    }
}

// Helper function to process FitGirl candidates and return result
async function processFitGirlCandidates(candidates, comparisonName, directPageUrl = null, targetSubtitle = null) {
    // Don't filter here - will filter at the end with scoring penalty
    let filteredCandidates = candidates;

    // Find the best match using strict relevance scoring
    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of filteredCandidates) {
        const score = calculateRelevanceScore(comparisonName, candidate.cleanTitle);

        // Only consider matches with very high relevance (exact or near-exact)
        if (score > bestScore && score >= 100) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    // If no high-score match found, try with a lower threshold but still strict
    if (!bestMatch) {
        for (const candidate of filteredCandidates) {
            const score = calculateRelevanceScore(comparisonName, candidate.cleanTitle);
            if (score > bestScore && score >= 80) {
                bestScore = score;
                bestMatch = candidate;
            }
        }
    }

    // If still no match, return empty (don't return irrelevant results)
    if (!bestMatch) {
        console.log(`[FitGirl Site] No relevant match found for "${comparisonName}" (best score was ${bestScore})`);
        return [];
    }

    console.log(`[FitGirl Site] Best match found: "${bestMatch.cleanTitle}" (score: ${bestScore})`);
    console.log(`[FitGirl Site] URL: ${bestMatch.pageUrl || directPageUrl}`);

    // Fetch details from the matched page
    const $article = bestMatch.$article;
    const image = $article.find('img').first().attr('src') || '';
    const content = $article.find('.entry-content').text();
    const sizeMatch = content.match(/Repack Size[:\s]+([0-9.]+\s*[GM]B)/i);
    const size = sizeMatch ? sizeMatch[1] : 'Unknown';

    // Try to get magnet link from the article
    let magnetLink = $article.find('a[href^="magnet:"]').first().attr('href');

    // If no magnet link in article, try from entry content
    if (!magnetLink) {
        magnetLink = $article.find('.entry-content a[href^="magnet:"]').first().attr('href');
    }

    // If still no magnet, fetch from detail page
    const pageUrl = bestMatch.pageUrl || directPageUrl;
    let seeders = 100; // Default
    let leechers = 0;

    if (!magnetLink && pageUrl) {
        try {
            console.log(`[FitGirl Site] Fetching magnet link from detail page: ${pageUrl}`);
            const detailHtml = await scrapeWithWindow(pageUrl);
            const $d = load(detailHtml);
            magnetLink = $d('a[href^="magnet:"]').first().attr('href');

            // Extract torrent stats from the page
            const seedsMatch = detailHtml.match(/Seeds?:\s*([\d,]+)/i);
            const peersMatch = detailHtml.match(/Peers?:\s*([\d,]+)/i);

            if (seedsMatch) {
                seeders = parseInt(seedsMatch[1].replace(/,/g, '')) || 100;
            }
            if (peersMatch) {
                leechers = parseInt(peersMatch[1].replace(/,/g, '')) || 0;
            }

            // Try to extract size from torrent info (e.g., "Files: 10 (1013.86MB)")
            const filesSizeMatch = detailHtml.match(/Files?:\s*\d+\s*\(([\d.]+\s*[GMK]?B)\)/i);
            if (filesSizeMatch) {
                size = filesSizeMatch[1];
            }
        } catch (e) {
            console.error(`[FitGirl Site] Failed to fetch magnet from detail page:`, e);
        }
    } else if (pageUrl && bestMatch.$article) {
        // If we already have the article, try to extract stats from it
        const articleHtml = bestMatch.$article.html() || '';
        const seedsMatch = articleHtml.match(/Seeds?:\s*([\d,]+)/i);
        const peersMatch = articleHtml.match(/Peers?:\s*([\d,]+)/i);

        if (seedsMatch) {
            seeders = parseInt(seedsMatch[1].replace(/,/g, '')) || 100;
        }
        if (peersMatch) {
            leechers = parseInt(peersMatch[1].replace(/,/g, '')) || 0;
        }

        // Try to extract size from torrent info
        const filesSizeMatch = articleHtml.match(/Files?:\s*\d+\s*\(([\d.]+\s*[GMK]?B)\)/i);
        if (filesSizeMatch) {
            size = filesSizeMatch[1];
        }
    }

    if (!magnetLink) {
        console.log(`[FitGirl Site] No magnet link found for "${bestMatch.cleanTitle}"`);
        return [];
    }

    // Clean the original title for display (keep editions but remove repack info)
    const displayTitle = bestMatch.originalTitle
        .replace(/\s*–\s*FitGirl Repack/i, '')
        .replace(/\s*-\s*FitGirl Repack/i, '')
        .replace(/\s*\(.*?Repack.*?\)/i, '')
        .replace(/\s*\[.*?Repack.*?\]/i, '')
        .replace(/\s*Repack\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Return only the best match
    const result = {
        name: displayTitle, // Use cleaned original title that keeps editions
        detailUrl: pageUrl,
        magnetLink: magnetLink,
        seeders: seeders, // Extracted from page stats
        leechers: leechers, // Extracted from page stats
        size,
        source: 'FitGirl Site',
        repacker: 'FitGirl',
        imageUrl: image,
        relevanceScore: bestScore
    };

    console.log(`[FitGirl Site] Extracted stats: Size=${size}, Seeds=${seeders}, Peers=${leechers}`);

    console.log(`[FitGirl Site] Returning single best match: "${result.name}"`);
    return [result]; // Return as array with single result
}

// Direct ElAmigos Search - focused on keeplinks
async function searchElAmigos(query, targetGameName = null) {
    const BASE_URL = 'https://elamigos.site';
    
    try {
        console.log(`[ElAmigos] Searching for "${query}"...`);
        
        // Scrape the main page directly (no search query parameter)
        console.log(`[ElAmigos] Scraping main page: ${BASE_URL}`);
        const mainPageHtml = await scrapeWithWindow(BASE_URL);
        const $main = load(mainPageHtml);
        const candidates = [];
        
        // Look for h3 elements on main page that contain the search text
        const searchTextLower = query.toLowerCase();
        const targetGameNameLower = targetGameName ? targetGameName.toLowerCase() : null;
        const comparisonText = targetGameNameLower || searchTextLower;
        const comparisonWords = comparisonText.split(/\s+/).filter(w => w.length > 2); // Filter out short words
        
        $main('h3').each((i, elem) => {
            if (candidates.length >= 50) return false; // Check more candidates
            const $h3 = $main(elem);
            
            const title = $h3.text().trim();
            const titleLower = title.toLowerCase();
            
            // STRICT: Title must contain all important words from search
            const allWordsMatch = comparisonWords.every(word => titleLower.includes(word));
            
            if (!allWordsMatch) {
                return; // Skip this candidate
            }
            
            // Find the link - could be in h3 itself or in parent/article
            let url = $h3.find('a').first().attr('href');
            if (!url) {
                // Try parent elements
                const $parent = $h3.parent();
                url = $parent.find('a').first().attr('href');
                if (!url && $parent.is('a')) {
                    url = $parent.attr('href');
                }
            }
            
            if (title && url) {
                // Make URL absolute if needed
                if (!url.startsWith('http')) {
                    url = url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/${url}`;
                }
                
                // Clean title
                const cleanTitle = title
                    .replace(/\s*–\s*ElAmigos/i, '')
                    .replace(/\s*-\s*ElAmigos/i, '')
                    .replace(/\s*\(.*?ElAmigos.*?\)/i, '')
                    .replace(/\s*\[.*?ElAmigos.*?\]/i, '')
                    .replace(/\s*,\s*[\d.]+\s*[GM]B.*$/i, '') // Remove size from title
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Only add if it looks like a game page link (not category, tag, etc.)
                if (url.includes('/game/') || url.includes('/post/') || url.includes('/entry/') || 
                    (!url.includes('/category/') && !url.includes('/tag/') && !url.includes('/author/'))) {
                    candidates.push({ 
                        originalTitle: title,
                        cleanTitle: cleanTitle,
                        url: url
                    });
                }
            }
        });

        console.log(`[ElAmigos] Found ${candidates.length} candidates for "${query}"`);

        // Find best match - must contain at least the search query text (case insensitive)
        let bestMatch = null;
        let bestScore = 0;
        const comparisonName = (targetGameName || query).toLowerCase().trim();

        for (const candidate of candidates) {
            const candidateTitleLower = candidate.cleanTitle.toLowerCase();
            
            // STRICT REQUIREMENT: Title must contain at least the main search terms
            // Check if all important words from search query are in the title
            // Use the same comparisonWords that was already calculated above
            const allWordsMatch = comparisonWords.every(word => candidateTitleLower.includes(word));
            
            if (!allWordsMatch) {
                console.log(`[ElAmigos] Rejecting "${candidate.cleanTitle}" - doesn't contain all search terms`);
                continue;
            }
            
            // Calculate relevance score
            const score = calculateRelevanceScore(targetGameName || query, candidate.cleanTitle);
            if (score > bestScore && score >= 80) {
                bestScore = score;
                bestMatch = candidate;
            }
        }

        if (!bestMatch) {
            console.log(`[ElAmigos] No relevant match found for "${comparisonName}" (must contain all search terms)`);
            return [];
        }

        console.log(`[ElAmigos] Best match found: "${bestMatch.cleanTitle}" (score: ${bestScore})`);
        console.log(`[ElAmigos] Game page URL: ${bestMatch.url}`);

        // Step 2: Fetch details from the matched game page
        try {
            const detailHtml = await scrapeWithWindow(bestMatch.url);
            const $d = load(detailHtml);

            // Parse size from title or content
            let size = 'Unknown';
            const titleText = $d('h1, h2, h3').first().text();
            const sizeMatch = titleText.match(/,\s*([0-9.]+\s*[GM]B)/i) || 
                            detailHtml.match(/Size[:\s]+([0-9.]+\s*[GM]B)/i);
            if (sizeMatch) size = sizeMatch[1];

            // Look specifically for keeplinks.org links
            let keeplink = null;
            $d('a').each((i, elem) => {
                const href = $d(elem).attr('href');
                if (href && href.includes('keeplinks.org')) {
                    keeplink = href;
                    return false; // Break
                }
            });

            // Also check in HTML source for keeplinks
            if (!keeplink) {
                const keeplinkMatch = detailHtml.match(/https?:\/\/[^\s"<>]*keeplinks\.org[^\s"<>]*/i);
                if (keeplinkMatch) {
                    keeplink = keeplinkMatch[0];
                }
            }

            // If no keeplink found, look for filecrypt or other DDL links as fallback
            if (!keeplink) {
                $d('a').each((i, elem) => {
                    const href = $d(elem).attr('href');
                    if (href && (href.includes('filecrypt.cc') || href.includes('filecrypt.co'))) {
                        keeplink = href;
                        return false;
                    }
                });
            }

            if (!keeplink) {
                console.log(`[ElAmigos] No keeplink found for "${bestMatch.cleanTitle}"`);
                return [];
            }

            // Clean title for display
            const displayTitle = bestMatch.originalTitle
                .replace(/\s*–\s*ElAmigos/i, '')
                .replace(/\s*-\s*ElAmigos/i, '')
                .replace(/\s*\(.*?ElAmigos.*?\)/i, '')
                .replace(/\s*\[.*?ElAmigos.*?\]/i, '')
                .replace(/\s+/g, ' ')
                .trim();

            console.log(`[ElAmigos] ✅ Found keeplink for "${displayTitle}"`);

            return [{
                name: displayTitle,
                detailUrl: bestMatch.url,
                keeplink: keeplink,
                size,
                source: 'ElAmigos Site',
                repacker: 'ElAmigos',
                relevanceScore: bestScore
            }];
        } catch (e) {
            console.error(`[ElAmigos] Failed to fetch details for ${bestMatch.cleanTitle}:`, e);
            return [];
        }
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
                // Reduce wait time from 2s to 1s - most pages load faster
                // Check if page is fully loaded before waiting
                let attempts = 0;
                const checkReady = async () => {
                    try {
                        // Try to get HTML immediately
                        const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
                        // Check if page seems complete (has body content)
                        if (html && html.length > 5000 && html.includes('</body>')) {
                            clearTimeout(timeout);
                            if (!win.isDestroyed()) win.destroy();
                            resolve(html);
                            return true;
                        }
                        // If not ready, wait a bit more
                        if (attempts < 2) {
                            attempts++;
                            await new Promise(r => setTimeout(r, 500));
                            return await checkReady();
                        }
                        // Final attempt after max waits
                        const finalHtml = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
                        clearTimeout(timeout);
                        if (!win.isDestroyed()) win.destroy();
                        resolve(finalHtml);
                        return true;
                    } catch (err) {
                        return false;
                    }
                };

                // Start checking immediately (don't wait 2s)
                await checkReady();
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

// Helper function to calculate relevance score between query and result title
function calculateRelevanceScore(query, title) {
    // Normalize both strings for comparison
    const normalize = (str) => {
        return str.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    };

    const normalizedQuery = normalize(query);
    const normalizedTitle = normalize(title);

    // Clean title of repacker info and version numbers for better matching
    const cleanTitleForMatching = normalizedTitle
        .replace(/\s*(fitgirl|fit girl|fit-girl|elamigos|dodi|rune|empress|tenoke)\s*/gi, ' ')
        .replace(/\s*(repack|repack|v\d+\.\d+|version|edition)\s*/gi, ' ')
        .replace(/\s*\+\s*\d+\s*dlcs?\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2); // Ignore short words
    const titleWords = cleanTitleForMatching.split(' ').filter(w => w.length > 2);
    const originalTitleWords = normalizedTitle.split(' ').filter(w => w.length > 2);

    if (queryWords.length === 0) return 0;

    let score = 0;
    let matchedWords = 0;
    const importantWords = new Set(); // Track which query words are matched

    // Exact match check (highest priority)
    if (cleanTitleForMatching.includes(normalizedQuery)) {
        score += 150; // Very high score for exact match
        return score; // Return early for exact matches
    }

    // Check if query is contained in title (high relevance)
    if (normalizedQuery.includes(cleanTitleForMatching) && cleanTitleForMatching.length > normalizedQuery.length * 0.7) {
        score += 120;
    }

    // Word-by-word matching - prioritize exact matches
    for (const queryWord of queryWords) {
        // Skip common words that don't help with matching
        const commonWords = ['the', 'and', 'or', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'game'];
        if (commonWords.includes(queryWord) && queryWords.length > 2) continue;

        let bestMatch = null;
        let bestScore = 0;

        // Check both cleaned and original title words
        for (const titleWord of [...titleWords, ...originalTitleWords]) {
            // Exact word match (highest score)
            if (titleWord === queryWord) {
                bestMatch = titleWord;
                bestScore = 50; // High score for exact word match
                break; // Take the first exact match
            }
            // Word starts with query word (good match)
            else if (titleWord.startsWith(queryWord) && queryWord.length >= 4) {
                const matchScore = 30 * (queryWord.length / titleWord.length);
                if (matchScore > bestScore) {
                    bestMatch = titleWord;
                    bestScore = matchScore;
                }
            }
            // Word contains query word (moderate match)
            else if (titleWord.includes(queryWord) && queryWord.length >= 4) {
                const matchScore = 15 * (queryWord.length / titleWord.length);
                if (matchScore > bestScore) {
                    bestMatch = titleWord;
                    bestScore = matchScore;
                }
            }
        }

        if (bestMatch) {
            score += bestScore;
            matchedWords++;
            importantWords.add(queryWord);
        }
    }

    // Critical: Must match at least 60% of important words (excluding common words)
    const importantQueryWords = queryWords.filter(w => {
        const commonWords = ['the', 'and', 'or', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'game'];
        return !commonWords.includes(w);
    });

    if (importantQueryWords.length > 0) {
        const matchRatio = matchedWords / importantQueryWords.length;
        if (matchRatio < 0.6) {
            score = 0; // Reject if less than 60% of important words match
            return 0;
        }

        // Bonus for matching all important words
        if (matchRatio === 1.0 && importantQueryWords.length > 1) {
            score += 80; // Very high bonus
        } else if (matchRatio >= 0.8) {
            score += 40; // Good bonus
        }
    }

    // Penalty for extra words (title has many more words than query)
    const extraWords = originalTitleWords.length - queryWords.length;
    if (extraWords > 8) {
        score *= 0.5; // Heavy penalty for too many extra words (50% reduction)
    } else if (extraWords > 5) {
        score *= 0.7; // Moderate penalty (30% reduction)
    }

    // Penalty for results that are too different in length
    const lengthRatio = cleanTitleForMatching.length / normalizedQuery.length;
    if (lengthRatio > 2.5 || lengthRatio < 0.4) {
        score *= 0.6; // Penalty for very different lengths
    }

    // Final check: minimum threshold for relevance
    if (score < 30) {
        return 0; // Too low relevance, reject
    }

    return Math.max(0, score); // Ensure non-negative score
}

// Filter and rank results by relevance
function filterAndRankResults(results, query, minScore = 30, sequelNumber = null, targetSubtitle = null) {
    // Calculate score for each result
    const scoredResults = results.map(result => {
        // If result already has a very high relevance score (from direct URL match),
        // skip subtitle penalties - we trust the direct match
        if (result.relevanceScore && result.relevanceScore >= 140) {
            console.log(`[Relevance] Keeping direct match without penalties: "${result.name}" - Score: ${result.relevanceScore}`);
            return result;
        }

        let relevanceScore = calculateRelevanceScore(query, result.name);

        // Apply SEVERE penalty for subtitle mismatch
        const resultParts = extractGameParts(result.name);

        // If looking for original game (no subtitle), heavily penalize results with subtitles
        if (targetSubtitle !== null) {
            const targetParts = extractGameParts(targetSubtitle);
            if (!targetParts.hasSubtitle && resultParts.hasSubtitle) {
                // Looking for original but result has subtitle - SEVERE penalty
                relevanceScore *= 0.1; // Reduce to 10% of original score
                console.log(`[Relevance] Heavy penalty for "${result.name}" - has subtitle but looking for original`);
            } else if (targetParts.hasSubtitle && !resultParts.hasSubtitle) {
                // Looking for sequel but result is original - moderate penalty
                relevanceScore *= 0.3;
            }
        } else if (sequelNumber === null || sequelNumber === 1) {
            // No sequel specified or looking for part 1 - penalize results with subtitles
            if (resultParts.hasSubtitle) {
                relevanceScore *= 0.1; // Reduce to 10% of original score
                console.log(`[Relevance] Heavy penalty for "${result.name}" - has subtitle but looking for original`);
            }
        }

        return {
            ...result,
            relevanceScore: relevanceScore
        };
    });

    // Filter by minimum score
    const filtered = scoredResults.filter(r => r.relevanceScore >= minScore);

    // Sort by relevance score (descending), then by seeders
    filtered.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
        }
        return (b.seeders || 0) - (a.seeders || 0);
    });

    console.log(`[Relevance] Filtered ${results.length} results to ${filtered.length} relevant results (min score: ${minScore})`);
    filtered.forEach(r => {
        console.log(`[Relevance] "${r.name}" - Score: ${r.relevanceScore}, Seeders: ${r.seeders || 0}`);
    });

    return filtered;
}

// Helper to extract sequel numbers from game name (e.g., "Red Dead Redemption 2" -> 2)
function extractSequelNumber(gameName) {
    // Try to find sequel numbers in various patterns
    // Pattern order matters - try most common patterns first

    // Pattern 1: Number followed by colon (e.g., "Game 2: Ultimate Edition")
    let match = gameName.match(/\s+(\d+)\s*:/);
    if (match && match[1]) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > 0 && num <= 20) {
            return num;
        }
    }

    // Pattern 2: Number followed by dash/em dash (e.g., "Game 2 – Edition")
    match = gameName.match(/\s+(\d+)\s*[–-]/);
    if (match && match[1]) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > 0 && num <= 20) {
            return num;
        }
    }

    // Pattern 3: Number at the end (e.g., "Game 2")
    match = gameName.match(/\s+(\d+)$/);
    if (match && match[1]) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > 0 && num <= 20) {
            return num;
        }
    }

    // Pattern 4: Number followed by space and word (e.g., "Game 2 Ultimate")
    match = gameName.match(/\s+(\d+)\s+[A-Za-z]/);
    if (match && match[1]) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > 0 && num <= 20) {
            return num;
        }
    }

    // Pattern 5: Roman numerals - try longer matches first to avoid false positives
    // Order is important: longer numerals first (e.g., "VIII" before "V" before "I")
    const romanMap = {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
        'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
        'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15
    };

    // Try longer roman numerals first (to avoid matching "I" when it's part of "IV", "VI", etc.)
    const romanOrder = ['VIII', 'VII', 'III', 'IV', 'VI', 'IX', 'II', 'X', 'V', 'I'];

    // Check all positions in the game name for roman numerals
    for (const roman of romanOrder) {
        const upper = roman.toUpperCase();
        if (!romanMap[upper]) continue;

        // Pattern 1: Roman numeral followed by colon
        match = gameName.match(new RegExp(`\\s+${roman}\\s*:`, 'i'));
        if (match) {
            return romanMap[upper];
        }

        // Pattern 2: Roman numeral followed by dash/em dash (e.g., "Game V –")
        match = gameName.match(new RegExp(`\\s+${roman}\\s*[–-]`, 'i'));
        if (match) {
            return romanMap[upper];
        }

        // Pattern 3: Roman numeral at the end
        match = gameName.match(new RegExp(`\\s+${roman}$`, 'i'));
        if (match) {
            // Additional check for 'I' to avoid false positives
            if (upper === 'I') {
                const beforeMatch = gameName.substring(0, match.index).trim();
                // Make sure 'I' is not part of another word
                if (beforeMatch.endsWith(' ') || beforeMatch.length === 0) {
                    return romanMap[upper];
                }
            } else {
                return romanMap[upper];
            }
        }

        // Pattern 4: Roman numeral followed by space and non-roman letter/number (e.g., "Game V v1.0")
        match = gameName.match(new RegExp(`\\s+${roman}(?:\\s+[^IVXa-z]|\\s+$)`, 'i'));
        if (match) {
            return romanMap[upper];
        }
    }

    return null; // No sequel number found
}

// Helper to extract base game name and subtitle/sequel identifier
function extractGameParts(gameName) {
    // Normalize the name
    const normalized = gameName.trim();

    // Try to split by colon (most common pattern for subtitles)
    const colonMatch = normalized.match(/^(.+?)\s*:\s*(.+)$/);
    if (colonMatch) {
        return {
            baseName: colonMatch[1].trim(),
            subtitle: colonMatch[2].trim(),
            hasSubtitle: true
        };
    }

    // Try to split by dash/em dash (alternative pattern)
    const dashMatch = normalized.match(/^(.+?)\s*[–-]\s*(.+)$/);
    if (dashMatch) {
        // Check if the part after dash looks like a subtitle (not a build number or edition)
        const afterDash = dashMatch[2].trim();
        // If it starts with "Build", "v", or looks like a version, it's not a subtitle
        if (!/^(Build|v\d|Version|\d+\.\d+)/i.test(afterDash)) {
            return {
                baseName: dashMatch[1].trim(),
                subtitle: afterDash,
                hasSubtitle: true
            };
        }
    }

    // Check for "The [Something]" pattern (e.g., "Dying Light The Beast")
    const theMatch = normalized.match(/^(.+?)\s+The\s+(.+)$/i);
    if (theMatch) {
        return {
            baseName: theMatch[1].trim(),
            subtitle: `The ${theMatch[2].trim()}`,
            hasSubtitle: true
        };
    }

    // No subtitle found
    return {
        baseName: normalized,
        subtitle: null,
        hasSubtitle: false
    };
}

// Helper to check if a title matches the specific sequel (by number or subtitle)
function matchesSequel(title, sequelNumber, targetSubtitle = null) {
    const titleParts = extractGameParts(title);
    const titleSequelNum = extractSequelNumber(title);

    // If we have a target subtitle from SteamGridDB, use it for matching
    if (targetSubtitle) {
        const targetParts = extractGameParts(targetSubtitle);

        // If target has a subtitle, we're looking for a specific sequel
        if (targetParts.hasSubtitle) {
            // Result must also have a subtitle (reject original game)
            if (!titleParts.hasSubtitle) {
                // Target has subtitle but result doesn't - likely the original game, reject
                console.log(`[Sequel Match] Rejecting "${title}" - target has subtitle "${targetParts.subtitle}" but result doesn't`);
                return false;
            }

            // Both have subtitles - check if they match
            const targetSubtitleLower = targetParts.subtitle.toLowerCase().trim();
            const titleSubtitleLower = titleParts.subtitle.toLowerCase().trim();

            // Normalize subtitles (remove common words that might differ)
            const normalizeSubtitle = (sub) => {
                return sub
                    .replace(/\s*edition\s*/gi, '')
                    .replace(/\s*deluxe\s*/gi, '')
                    .replace(/\s*ultimate\s*/gi, '')
                    .replace(/\s*definitive\s*/gi, '')
                    .replace(/\s*collector.*?\s*/gi, '')
                    .replace(/\s*digital\s*/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            const normalizedTarget = normalizeSubtitle(targetSubtitleLower);
            const normalizedTitle = normalizeSubtitle(titleSubtitleLower);

            // Check if subtitles match (exact or contains)
            if (normalizedTarget === normalizedTitle ||
                normalizedTarget.includes(normalizedTitle) ||
                normalizedTitle.includes(normalizedTarget)) {
                console.log(`[Sequel Match] Accepting "${title}" - subtitle matches "${targetParts.subtitle}"`);
                return true;
            }

            // Subtitles don't match - different sequel
            console.log(`[Sequel Match] Rejecting "${title}" - subtitle "${titleParts.subtitle}" doesn't match "${targetParts.subtitle}"`);
            return false;
        } else {
            // Target has no subtitle (looking for original game)
            // REJECT results that have subtitles (they are sequels, not the original)
            if (titleParts.hasSubtitle) {
                console.log(`[Sequel Match] Rejecting "${title}" - looking for original game but result has subtitle "${titleParts.subtitle}"`);
                return false;
            }
            // Both have no subtitle - likely the original game
            console.log(`[Sequel Match] Accepting "${title}" - both are original games (no subtitles)`);
            return true;
        }
    }

    // If no targetSubtitle but we're looking for original game (no sequel number or sequel number is 1)
    // Reject results with subtitles as they are sequels
    if ((sequelNumber === null || sequelNumber === 1) && titleParts.hasSubtitle) {
        console.log(`[Sequel Match] Rejecting "${title}" - looking for original game (no subtitle) but result has subtitle "${titleParts.subtitle}"`);
        return false;
    }

    // Fallback to number-based matching if no subtitle
    // If no sequel number and no targetSubtitle, we're looking for the original game
    // Reject results with subtitles (they are sequels)
    if (sequelNumber === null || sequelNumber === undefined) {
        if (titleParts.hasSubtitle) {
            console.log(`[Sequel Match] Rejecting "${title}" - looking for original game but result has subtitle "${titleParts.subtitle}"`);
            return false;
        }
        console.log(`[Sequel Match] No sequel specified, accepting "${title}" (no subtitle)`);
        return true; // No sequel specified and no subtitle = original game
    }

    // If we're looking for a specific sequel number
    console.log(`[Sequel Match] Comparing sequel numbers: target=${sequelNumber}, title="${title}" has=${titleSequelNum}`);

    if (sequelNumber > 1) {
        // If no sequel number in title, reject it (likely part 1 or unrelated)
        if (titleSequelNum === null || titleSequelNum === undefined) {
            console.log(`[Sequel Match] Rejecting "${title}" - looking for sequel ${sequelNumber} but title has no number`);
            return false;
        }
        // Must match exactly
        if (titleSequelNum === sequelNumber) {
            console.log(`[Sequel Match] Accepting "${title}" - sequel numbers match: ${sequelNumber}`);
            return true;
        } else {
            console.log(`[Sequel Match] Rejecting "${title}" - sequel number ${titleSequelNum} doesn't match ${sequelNumber}`);
            return false;
        }
    } else if (sequelNumber === 1) {
        // Looking for part 1 - accept if no number (likely part 1) or if number is 1
        if (!titleSequelNum) {
            console.log(`[Sequel Match] Accepting "${title}" - no number = likely part 1`);
            return true; // No number = likely part 1
        }
        const matches = titleSequelNum === 1;
        console.log(`[Sequel Match] ${matches ? 'Accepting' : 'Rejecting'} "${title}" - sequel number is ${titleSequelNum}`);
        return matches;
    }

    // Fallback: exact match required
    const matches = titleSequelNum === sequelNumber;
    console.log(`[Sequel Match] ${matches ? 'Accepting' : 'Rejecting'} "${title}" - sequel numbers ${titleSequelNum} vs ${sequelNumber}`);
    return matches;
}

// Helper to check if a title matches the specific sequel number
function matchesSequelNumber(title, sequelNumber) {
    if (sequelNumber === null || sequelNumber === undefined) return true; // No sequel specified, accept all

    const titleSequel = extractSequelNumber(title);

    // If we're looking for a specific sequel number
    if (sequelNumber > 1) {
        // If no sequel number in title, reject it (likely part 1 or unrelated)
        if (!titleSequel) {
            return false;
        }
        // Must match exactly
        return titleSequel === sequelNumber;
    } else if (sequelNumber === 1) {
        // Looking for part 1 - accept if no number (likely part 1) or if number is 1
        if (!titleSequel) return true; // No number = likely part 1
        return titleSequel === 1;
    }

    // Fallback: exact match required
    return titleSequel === sequelNumber;
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

// Helper to convert Arabic numerals to Roman
function convertArabicToRoman(text) {
    const arabicToRomanMap = {
        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
        '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
        '11': 'XI', '12': 'XII', '13': 'XIII', '14': 'XIV', '15': 'XV'
    };

    const words = text.split(/\s+/);
    let modified = false;

    const newWords = words.map(word => {
        // Remove common punctuation for checking
        const cleanWord = word.replace(/[:\-]/g, '');
        
        // Check if it's a number (1-15)
        if (arabicToRomanMap[cleanWord]) {
            modified = true;
            return arabicToRomanMap[cleanWord];
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

    // Start SteamGridDB check in parallel with initial search setup
    // We'll wait for it only when we need it (before final filtering)
    let targetGameName = null;
    let sequelNumber = null;
    let targetSubtitle = null;

    const steamGridPromise = (async () => {
        try {
            const apiKey = store.get('apiKey');
            if (apiKey) {
                console.log(`[TorrentSearch] Checking SteamGridDB for exact game name...`);
                const steamGridResults = await searchGameDetailed(gameName, apiKey);
                if (steamGridResults && steamGridResults.length > 0) {
                    // Use the first (best) match from SteamGridDB
                    const name = steamGridResults[0].name;
                    console.log(`[TorrentSearch] Found SteamGridDB match: "${name}"`);

                    // Extract game parts to check for subtitle
                    const gameParts = extractGameParts(name);
                    let subtitle = null;
                    let seqNum = null;

                    if (gameParts.hasSubtitle) {
                        subtitle = name; // Pass full name for subtitle matching
                        console.log(`[TorrentSearch] Detected subtitle sequel: "${gameParts.subtitle}"`);
                    } else {
                        seqNum = extractSequelNumber(name);
                        if (seqNum !== null) {
                            console.log(`[TorrentSearch] Detected sequel number: ${seqNum}`);
                        }
                    }

                    return { name, subtitle, sequelNumber: seqNum };
                }
            }
        } catch (error) {
            console.warn(`[TorrentSearch] Error checking SteamGridDB:`, error.message);
        }
        return null;
    })();

    // Wait for SteamGridDB result (or use original gameName immediately)
    const steamGridResult = await steamGridPromise;
    if (steamGridResult) {
        targetGameName = steamGridResult.name;
        targetSubtitle = steamGridResult.subtitle;
        sequelNumber = steamGridResult.sequelNumber;
    }

    // Use SteamGridDB name if available, otherwise use original
    const searchQuery = targetGameName || gameName;

    let queries = [searchQuery];

    const allResults = [];
    const seenMagnets = new Set();

    // Helper to perform search for a single query on a single site
    const searchSite = async (query, site, targetGameName = null, sequelNumber = null, targetSubtitle = null) => {
        try {
            console.log(`[TorrentSearch] Searching ${site.name} for "${query}"...`);
            let results = [];
            if (site.search) {
                // Custom search function (for direct sites like FitGirl)
                // Check if it's FitGirl Site and pass additional parameters
                if (site.name === 'FitGirl Site') {
                    results = await site.search(query, targetGameName, sequelNumber, targetSubtitle);
                } else {
                    results = await site.search(query);
                }
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

    // Parallel search: FitGirl Site, ElAmigos, and conditionally Rutor
    const performSearch = async (searchQueries) => {
        const allSiteResults = [];

        // Parallel search: FitGirl Site and ElAmigos simultaneously
        const fitgirlSite = TORRENT_SITES.find(s => s.name === 'FitGirl Site');
        const rutorSite = TORRENT_SITES.find(s => s.name === 'Rutor.info');

        // Create search promises for FitGirl and ElAmigos
        const searchPromises = [];

        // FitGirl Site searches
        if (fitgirlSite) {
            for (const query of searchQueries) {
                searchPromises.push(
                    searchSite(query, fitgirlSite, targetGameName, sequelNumber, targetSubtitle)
                        .catch(err => {
                            console.warn(`[TorrentSearch] FitGirl Site search failed for "${query}":`, err.message);
                            return { siteName: 'FitGirl Site', results: [] };
                        })
                );
            }
        }

        // ElAmigos searches (always search, in parallel with FitGirl)
        for (const query of searchQueries) {
            searchPromises.push(
                (async () => {
                    try {
                        console.log(`[TorrentSearch] Searching ElAmigos for "${query}"...`);
                        const results = await searchElAmigos(query, targetGameName);
                        console.log(`[TorrentSearch] Found ${results.length} results from ElAmigos`);
                        return { siteName: 'ElAmigos Site', results };
                    } catch (err) {
                        console.warn(`[TorrentSearch] ElAmigos search failed for "${query}":`, err.message);
                        return { siteName: 'ElAmigos Site', results: [] };
                    }
                })()
            );
        }

        // Wait for FitGirl and ElAmigos searches to complete
        const initialResults = await Promise.all(searchPromises);
        allSiteResults.push(...initialResults);

        // Check if FitGirl Site has any results
        const hasFitGirlSiteResults = allSiteResults.some(r => r.siteName === 'FitGirl Site' && r.results && r.results.length > 0);

        // Only search Rutor if FitGirl has no results
        if (!hasFitGirlSiteResults && rutorSite) {
            console.log('[TorrentSearch] No FitGirl Site results found. Searching Rutor.info...');
            const rutorPromises = [];
            for (const query of searchQueries) {
                rutorPromises.push(
                    searchSite(query, rutorSite)
                        .catch(err => {
                            console.warn(`[TorrentSearch] Rutor.info search failed for "${query}":`, err.message);
                            return { siteName: 'Rutor.info', results: [] };
                        })
                );
            }
            const rutorResults = await Promise.all(rutorPromises);
            allSiteResults.push(...rutorResults);
        } else if (hasFitGirlSiteResults) {
            console.log('[TorrentSearch] FitGirl Site results found. Skipping Rutor.info search.');
        }

        // Check if Rutor has any results (for BitSearch decision)
        const hasRutorResults = allSiteResults.some(r => r.siteName === 'Rutor.info' && r.results && r.results.length > 0);

        // Only search BitSearch if FitGirl Site and Rutor have no results
        if (!hasFitGirlSiteResults && !hasRutorResults) {
            console.log('[TorrentSearch] No FitGirl Site or Rutor.info results found. Searching BitSearch as fallback...');
            const bitSearchSite = TORRENT_SITES.find(s => s.name === 'BitSearch');
            if (bitSearchSite) {
                // Parallel BitSearch queries
                const bitSearchPromises = searchQueries.map(query =>
                    searchSite(query, bitSearchSite)
                        .catch(err => {
                            console.warn(`[TorrentSearch] BitSearch search failed for "${query}":`, err.message);
                            return { siteName: 'BitSearch', results: [] };
                        })
                );
                const bitSearchResults = await Promise.all(bitSearchPromises);
                allSiteResults.push(...bitSearchResults);
            }
        } else {
            console.log('[TorrentSearch] FitGirl Site or Rutor.info results found. Skipping BitSearch.');
        }

        for (const { siteName, results } of allSiteResults) {
            if (!results || results.length === 0) continue;

            // Exclusive Priority Filter: FitGirl Site > Rutor.info > Others
            // BUT: Always include ElAmigos Site results regardless of FitGirl
            if (hasFitGirlSiteResults) {
                // Skip Rutor and others, but keep FitGirl and ElAmigos
                if (siteName !== 'FitGirl Site' && siteName !== 'ElAmigos Site') continue;
            } else if (hasRutorResults) {
                // Skip others, but keep Rutor and ElAmigos
                if (siteName !== 'Rutor.info' && siteName !== 'ElAmigos Site') continue;
            }
            // If no FitGirl or Rutor, include everything (including ElAmigos)

            let filtered = results;
            const isDirectSite = siteName === 'Rutor.info' || siteName === 'FitGirl Site';

            if (!isDirectSite) {
                filtered = filterRepacks(results, repackers);
                console.log(`[TorrentSearch] ${filtered.length} results from ${siteName} match repack filters`);
            } else {
                console.log(`[TorrentSearch] Skipping repack filter for direct site ${siteName}`);
            }

            // Don't filter here - will filter at the end with scoring penalty

            for (const result of filtered) {
                // Use magnet link as unique key if available, otherwise name
                const key = result.magnetLink || result.name;
                if (!seenMagnets.has(key)) {
                    seenMagnets.add(key);

                    // Infer repacker if not set
                    if (!result.repacker) {
                        if (siteName === 'Rutor.info' || siteName === 'FitGirl Site') {
                            result.repacker = 'FitGirl';
                        } else {
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

    // 1. Initial Search with original query
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

    // First, filter only by magnetLink or keeplink (don't filter by seeders yet - score very relevant results first)
    let filteredResults = allResults
        .filter(r => r.magnetLink || r.keeplink);

    // Separate FitGirl Site and ElAmigos Site results from others BEFORE filtering
    // These sites are trusted and should not be filtered
    const trustedSources = ['FitGirl Site', 'ElAmigos Site'];
    const trustedResults = filteredResults.filter(r => trustedSources.includes(r.source));
    const otherResults = filteredResults.filter(r => !trustedSources.includes(r.source));

    console.log(`[TorrentSearch] Found ${trustedResults.length} trusted results (FitGirl/ElAmigos) and ${otherResults.length} other results`);

    // Apply relevance filtering ONLY to non-trusted results
    const originalQuery = queries[0];
    let filteredOtherResults = filterAndRankResults(otherResults, originalQuery, 40, sequelNumber, targetSubtitle);

    // Now filter by minimum seeders for other results
    filteredOtherResults = filteredOtherResults.filter(r => {
        // Allow results with very high relevance score even if they have 0 seeders
        if (r.relevanceScore && r.relevanceScore > 100) {
            return true; // Keep highly relevant results regardless of seeders
        }
        // For other results, apply minimum seeders filter
        return r.seeders >= minSeeders;
    });

    // FINAL FILTER: Apply strict sequel/subtitle filtering ONLY to non-trusted results
    if ((sequelNumber !== null || targetSubtitle !== null) && filteredOtherResults.length > 0) {
        const beforeCount = filteredOtherResults.length;
        filteredOtherResults = filteredOtherResults.filter(result => {
            const matches = matchesSequel(result.name, sequelNumber, targetSubtitle);
            if (!matches) {
                console.log(`[TorrentSearch] FINAL FILTER - Rejecting "${result.name}" (wrong sequel/subtitle)`);
            }
            return matches;
        });
        if (beforeCount !== filteredOtherResults.length) {
            console.log(`[TorrentSearch] FINAL sequel/subtitle filter: ${beforeCount} -> ${filteredOtherResults.length} results`);
        }
    }

    // Combine trusted results (no filtering) with filtered other results
    const allFilteredResults = [...trustedResults, ...filteredOtherResults];

    // Separate FitGirl Site, ElAmigos Site, and other results for return
    const fitgirlSiteResults = allFilteredResults
        .filter(r => r.source === 'FitGirl Site');

    const elamigosSiteResults = allFilteredResults
        .filter(r => r.source === 'ElAmigos Site');

    const nonFitgirlResults = allFilteredResults
        .filter(r => r.source !== 'FitGirl Site' && r.source !== 'ElAmigos Site')
        .slice(0, maxResults);

    // Limit results (already sorted by relevance)
    const fitgirlResultsLimited = fitgirlSiteResults.slice(0, maxResults);
    const elamigosResultsLimited = elamigosSiteResults.slice(0, maxResults);

    console.log(`[TorrentSearch] Returning ${fitgirlResultsLimited.length} FitGirl Site results, ${elamigosResultsLimited.length} ElAmigos Site results, and ${nonFitgirlResults.length} other results`);

    return {
        fitgirlResults: fitgirlResultsLimited,
        elamigosResults: elamigosResultsLimited,
        otherResults: nonFitgirlResults
    };
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
