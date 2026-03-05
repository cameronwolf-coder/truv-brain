// Pipedream Step: fetch_and_parse_rss
// Fetches Truv changelog RSS feed, filters to entries from last 7 days
// Package required: fast-xml-parser

import { XMLParser } from 'fast-xml-parser';

export default defineComponent({
  async run({ steps, $ }) {
    const RSS_URL = "https://truv.com/changelog/rss"; // UPDATE when Anna provides actual URL

    const response = await fetch(RSS_URL);
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feed = parser.parse(xml);

    const items = feed?.rss?.channel?.item || feed?.feed?.entry || [];
    const itemArray = Array.isArray(items) ? items : [items];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentEntries = itemArray
      .filter(item => {
        const pubDate = new Date(item.pubDate || item.published || item.updated);
        return pubDate >= sevenDaysAgo;
      })
      .map(item => ({
        title: item.title || "Untitled",
        date: new Date(item.pubDate || item.published || item.updated)
          .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        description: (item.description || item.summary || item.content || "")
          .replace(/<[^>]*>/g, '')
          .substring(0, 250) + "...",
        url: item.link || item.guid || "#"
      }));

    if (recentEntries.length === 0) {
      $.flow.exit("No new changelog entries in the last 7 days. Skipping send.");
    }

    const heroDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    return {
      entries: recentEntries,
      hero_date: heroDate,
      entry_count: recentEntries.length
    };
  }
});
