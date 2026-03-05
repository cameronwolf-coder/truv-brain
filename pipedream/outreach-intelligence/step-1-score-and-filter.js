// Pipedream Step: code (score and filter)
// Filters out excluded lifecycle stages, scores contacts, returns top 50

export default defineComponent({
  async run({ steps, $ }) {
    const contacts = steps.search_crm.$return_value?.results || [];

    const EXCLUDED_STAGES = [
      "opportunity", "1154636674", "customer", "268792390",
      "1012659574", "1154761341", "1070076549", "other"
    ];

    const LIFECYCLE_SCORES = {
      "268636563": 80,     // Closed Lost
      "268798100": 75,     // Churned Customer
      "salesqualifiedlead": 60,
      "marketingqualifiedlead": 50,
      "lead": 40,
      "subscriber": 30,
    };

    const WEIGHTS = {
      engagement: 0.25,
      timing: 0.25,
      deal_context: 0.30,
      external_trigger: 0.20,
    };

    function daysSince(dateStr) {
      if (!dateStr) return 365;
      try {
        return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
      } catch { return 365; }
    }

    function scoreEngagement(props) {
      let score = 0;
      const lastOpen = props.hs_email_last_open_date;
      if (lastOpen) {
        const days = daysSince(lastOpen);
        if (days < 30) score += 40;
        else if (days < 90) score += 25;
        else if (days < 180) score += 10;
      }
      const lastClick = props.hs_email_last_click_date;
      if (lastClick) {
        const days = daysSince(lastClick);
        if (days < 30) score += 50;
        else if (days < 90) score += 30;
        else if (days < 180) score += 15;
      }
      return Math.min(score, 100);
    }

    function scoreTiming(props) {
      let score = 50;
      const notesUpdated = props.notes_last_updated;
      if (notesUpdated) {
        const days = daysSince(notesUpdated);
        if (days < 90) score += 20;
        else if (days > 365) score -= 20;
      }
      return Math.max(0, Math.min(score, 100));
    }

    function scoreDealContext(props) {
      return LIFECYCLE_SCORES[props.lifecyclestage || ""] || 30;
    }

    function scoreContact(contact) {
      const props = contact.properties || {};
      const engagement = scoreEngagement(props);
      const timing = scoreTiming(props);
      const dealContext = scoreDealContext(props);
      const external = 40; // Placeholder

      const total =
        engagement * WEIGHTS.engagement +
        timing * WEIGHTS.timing +
        dealContext * WEIGHTS.deal_context +
        external * WEIGHTS.external_trigger;

      return {
        id: contact.id,
        firstname: props.firstname || "",
        lastname: props.lastname || "",
        email: props.email || "",
        jobtitle: props.jobtitle || "",
        company: props.company || "",
        lifecyclestage: props.lifecyclestage || "",
        sales_vertical: props.sales_vertical || "",
        engagement_score: engagement,
        timing_score: timing,
        deal_context_score: dealContext,
        total_score: Math.round(total * 10) / 10,
      };
    }

    const filtered = contacts.filter(c => {
      const stage = c.properties?.lifecyclestage || "";
      return !EXCLUDED_STAGES.includes(stage);
    });

    const scored = filtered.map(scoreContact);
    scored.sort((a, b) => b.total_score - a.total_score);
    const topContacts = scored.slice(0, 50);

    const dateStr = new Date().toISOString().split('T')[0];

    return {
      listName: `Re-engagement ${dateStr}`,
      contactCount: topContacts.length,
      totalScored: scored.length,
      topContacts,
      contactIds: topContacts.map(c => c.id),
      slackSummary: topContacts.slice(0, 10).map(c =>
        `• *${c.firstname} ${c.lastname}* (${c.company}) - Score: ${c.total_score}`
      ).join('\n'),
    };
  },
});
