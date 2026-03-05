// Pipedream Step: trigger_knock_workflow
// Triggers Knock changelog-weekly-digest workflow for each subscriber
// Batches in groups of 10 to avoid rate limits

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const KNOCK_API_KEY = process.env.KNOCK_API_KEY;
    const WORKFLOW_KEY = "changelog-weekly-digest";

    const entries = steps.fetch_and_parse_rss.$return_value.entries;
    const heroDate = steps.fetch_and_parse_rss.$return_value.hero_date;
    const contacts = steps.fetch_hubspot_subscribers.$return_value.contacts;

    const subject = `Truv Changelog — ${heroDate}`;
    const previewText = entries.length === 1
      ? entries[0].title
      : `${entries.length} product updates this week`;

    const results = [];

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
            recipients: [{
              id: contact.email,
              email: contact.email,
              name: contact.name
            }],
            data: {
              subject,
              preview_text: previewText,
              hero_date: heroDate,
              entries
            }
          }
        }).then(() => ({ email: contact.email, status: "sent" }))
          .catch(e => ({ email: contact.email, status: "failed", error: e.message }))
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "failed").length;

    return { total: contacts.length, sent, failed, subject, entry_count: entries.length };
  }
});
