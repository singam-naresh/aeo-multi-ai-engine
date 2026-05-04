import axios from 'axios';

const SCRAPE_TIMEOUT_MS = 2000;

// Signal vocabulary to extract from scraped titles
const SIGNAL_WORDS = [
  'battery', 'fps', 'camera', 'ram', 'ssd', 'gpu', 'cpu', 'processor',
  'display', 'performance', 'speed', 'price', 'value', 'gaming',
  'photography', 'coding', 'developer', 'student', 'budget', 'lightweight',
];

/**
 * Fetches top search result titles from DuckDuckGo HTML endpoint.
 * Returns up to 5 titles, or [] on any failure.
 * Timeout: 2 seconds max — never blocks the main pipeline.
 *
 * @param {string} query
 * @returns {Promise<string[]>}
 */
export async function fetchTopSearchTitles(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      timeout: SCRAPE_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AEO-Engine/1.0)',
        'Accept': 'text/html',
      },
    });

    // Extract result titles using a simple regex — no DOM parser needed
    // DuckDuckGo HTML wraps result titles in <a class="result__a">...</a>
    const titleRegex = /<a[^>]+class="result__a"[^>]*>([^<]+)<\/a>/gi;
    const titles = [];
    let match;
    while ((match = titleRegex.exec(data)) !== null && titles.length < 5) {
      const title = match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
      if (title.length > 5) titles.push(title);
    }

    return titles;
  } catch (_) {
    // Silently ignore — scraping is best-effort only
    return [];
  }
}

/**
 * Extract signal words from scraped titles.
 * Returns an array of matched signal words (deduplicated).
 *
 * @param {string[]} titles
 * @returns {string[]}
 */
export function extractSignalsFromTitles(titles) {
  if (!titles || titles.length === 0) return [];
  const combined = titles.join(' ').toLowerCase();
  return SIGNAL_WORDS.filter((word) => new RegExp(`\\b${word}\\b`).test(combined));
}
