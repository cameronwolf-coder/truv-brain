# Changelog Weekly Email — Pipedream Workflow

## Overview

Weekly automation that checks the Truv changelog RSS feed for new posts. If new entries exist from the past 7 days, it sends a digest email to subscribers via Knock → SendGrid.

**Schedule:** Every Monday at 8:00 AM CST
**Behavior:** Skip if no new posts (no empty emails sent)

---

## IDs & Keys

| Resource | Value |
|----------|-------|
| SendGrid Template | `d-d8a9aeef798844c68a8f09a455c06141` |
| Knock Workflow | `changelog-weekly-digest` |
| ASM Group (unsubscribe) | `29746` (Product Changelog) |
| HubSpot Subscriber List | `1799` |
| RSS Feed URL | `https://truv.com/changelog/rss` *(placeholder — waiting on Anna)* |

---

## Workflow Steps

### Step 1: Trigger — Schedule

**Type:** Schedule
**Cron:** `0 14 * * 1` (every Monday at 14:00 UTC = 8:00 AM CST)

---

### Step 2: Code — Fetch & Parse RSS Feed

**Type:** Node.js Code Step
**Name:** `fetch_and_parse_rss`

```javascript
import { XMLParser } from 'fast-xml-parser';

export default defineComponent({
  async run({ steps, $ }) {
    // Fetch RSS feed
    const RSS_URL = "https://truv.com/changelog/rss"; // UPDATE when Anna provides
    const response = await fetch(RSS_URL);

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feed = parser.parse(xml);

    // Handle both RSS 2.0 and Atom formats
    const items = feed?.rss?.channel?.item || feed?.feed?.entry || [];
    const itemArray = Array.isArray(items) ? items : [items];

    // Filter to entries from the last 7 days
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
          .replace(/<[^>]*>/g, '')  // Strip HTML tags
          .substring(0, 250) + "...",
        url: item.link || item.guid || "#"
      }));

    if (recentEntries.length === 0) {
      $.flow.exit("No new changelog entries in the last 7 days. Skipping send.");
    }

    // Format the date for the hero section
    const heroDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      entries: recentEntries,
      hero_date: heroDate,
      entry_count: recentEntries.length
    };
  }
});
```

**Package:** Add `fast-xml-parser` in the step's package configuration.

---

### Step 3: Code — Fetch HubSpot Subscribers

**Type:** Node.js Code Step (with HubSpot app connected)
**Name:** `fetch_hubspot_subscribers`

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot"
    }
  },
  async run({ steps, $ }) {
    const listId = "1799"; // Changelog Subscribers list
    let contacts = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const response = await axios($, {
        method: "GET",
        url: `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all`,
        headers: {
          Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`
        },
        params: {
          count: 100,
          vidOffset: offset,
          property: ["email", "firstname"]
        }
      });

      const batch = (response.contacts || []).map(c => ({
        email: c.properties?.email?.value || c["identity-profiles"]?.[0]?.identities?.find(i => i.type === "EMAIL")?.value,
        name: c.properties?.firstname?.value || "there"
      })).filter(c => c.email); // Only include contacts with emails

      contacts = contacts.concat(batch);
      hasMore = response["has-more"] || false;
      offset = response["vid-offset"] || 0;
    }

    console.log(`Found ${contacts.length} subscribers in list ${listId}`);
    return { contacts, count: contacts.length };
  }
});
```

---

### Step 4: Code — Trigger Knock Workflow

**Type:** Node.js Code Step
**Name:** `trigger_knock_workflow`

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const KNOCK_API_KEY = "sk_test_cmHbp8EMjI1LP7S4qmWR9mqhhQf5DWs_Q9VAmiQNDag"; // Knock public API key
    const WORKFLOW_KEY = "changelog-weekly-digest";

    const entries = steps.fetch_and_parse_rss.$return_value.entries;
    const heroDate = steps.fetch_and_parse_rss.$return_value.hero_date;
    const contacts = steps.fetch_hubspot_subscribers.$return_value.contacts;

    const subject = `Truv Changelog — ${heroDate}`;
    const previewText = entries.length === 1
      ? entries[0].title
      : `${entries.length} product updates this week`;

    // Trigger Knock workflow for each recipient
    const results = [];

    // Batch in groups of 10 to avoid rate limits
    for (let i = 0; i < contacts.length; i += 10) {
      const batch = contacts.slice(i, i + 10);

      const promises = batch.map(contact =>
        axios($, {
          method: "POST",
          url: `https://api.knock.app/v1/workflows/${WORKFLOW_KEY}/trigger`,
          headers: {
            Authorization: `Bearer ${KNOCK_API_KEY}`,
            "Content-Type": "application/json"
          },
          data: {
            recipients: [
              {
                id: contact.email,
                email: contact.email,
                name: contact.name
              }
            ],
            data: {
              subject: subject,
              preview_text: previewText,
              hero_date: heroDate,
              entries: entries
            }
          }
        }).then(r => ({ email: contact.email, status: "sent" }))
          .catch(e => ({ email: contact.email, status: "failed", error: e.message }))
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "failed").length;

    console.log(`Triggered ${sent} sends, ${failed} failures`);

    return {
      total: contacts.length,
      sent,
      failed,
      subject,
      entry_count: entries.length,
      failures: results.filter(r => r.status === "failed")
    };
  }
});
```

---

## Setup Instructions (Pipedream UI)

1. Create a new workflow in the **GTM Automation** project
2. Add a **Schedule** trigger: `0 14 * * 1` (Monday 8 AM CST)
3. Add **Node.js Code** step → paste Step 2 code → add `fast-xml-parser` package
4. Add **Node.js Code** step → paste Step 3 code → connect HubSpot app
5. Add **Node.js Code** step → paste Step 4 code
6. Test with manual trigger
7. Deploy

---

## Testing

1. **Dry run:** Manually trigger the workflow — it will fetch the RSS feed, pull contacts, and send
2. **RSS not ready?** Temporarily replace the RSS URL with a test XML file hosted somewhere, or use a public RSS feed to validate the parsing logic
3. **Test recipient:** Add your own email to HubSpot list 1799 temporarily to receive the test email
4. **Check Knock dashboard:** Verify the workflow execution shows up in the Knock logs

---

## Placeholders

- [ ] **RSS feed URL** — replace `https://truv.com/changelog/rss` when Anna provides the actual URL
- [ ] **HubSpot list** — confirm list `1799` is correct and contacts are cleaned up
- [ ] **Sender identity** — currently `insights@email.truv.com` / `Truv` — confirm with Kaytren
