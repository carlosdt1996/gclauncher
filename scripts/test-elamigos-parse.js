
import { load } from 'cheerio';

const html = `
<body>
<div class="entry-content">
<p>Some text</p>
<h3>Need for Speed Hot Pursuit Remastered (2020), 17.11GB</h3>
<p>Info...</p>

<h3>DDOWNLOAD</h3>
<p><a href="https://filecrypt.cc/Container/1EC98386B3.html">https://filecrypt.cc/Container/1EC98386B3.html</a></p>
<p><a href="https://www.keeplinks.org/p16/691c48e00f415">https://www.keeplinks.org/p16/691c48e00f415</a></p>

<h3>RAPIDGATOR</h3>
<p><a href="https://filecrypt.cc/Container/D2B9FC37DB.html">https://filecrypt.cc/Container/D2B9FC37DB.html</a></p>
<p><a href="https://www.keeplinks.org/p16/691c48ed20a55">https://www.keeplinks.org/p16/691c48ed20a55</a></p>
</div>
</body>
`;

const $ = load(html);
const ddlLinks = [];

// Look for headers indicating DDL hosts
$('h3, h4, strong').each((i, elem) => {
    const text = $(elem).text().trim().toUpperCase();
    if (text.includes('RAPIDGATOR') || text.includes('DDOWNLOAD')) {
        const host = text.includes('RAPIDGATOR') ? 'Rapidgator' : 'DDownload';
        
        // Look at siblings until the next header
        let next = $(elem).next();
        while (next.length && !next.is('h3, h4, h2')) {
            next.find('a').each((j, a) => {
                const href = $(a).attr('href');
                if (href && (href.includes('filecrypt') || href.includes('keeplinks'))) {
                    ddlLinks.push({ host, url: href });
                }
            });
            next = next.next();
        }
    }
});

console.log('Extracted Links:', ddlLinks);
