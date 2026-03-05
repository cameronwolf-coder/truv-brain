# Outreach Intelligence - Pipedream Workflow

## Overview
Automated weekly workflow that scores dormant HubSpot contacts and creates campaign lists.

**Schedule:** Every Friday at 7:30 AM CST
**Slack Channel:** #outreach-intelligence (C0A9Y5HLQAF)

---

## Setup Instructions

### Step 1: Create New Workflow
1. Go to https://pipedream.com/new
2. Click "New Workflow"

### Step 2: Add Schedule Trigger
- **Trigger Type:** Schedule
- **Cron Expression:** `30 13 * * 5`
  - (7:30 AM CST = 13:30 UTC during standard time)
  - Adjust to `30 12 * * 5` during daylight saving
- **Timezone:** America/Chicago

### Step 3: Add HubSpot - Search CRM
- **App:** HubSpot
- **Action:** Search CRM
- **Object Type:** Contacts
- **Properties to return:**
  ```
  firstname, lastname, email, jobtitle, company, lifecyclestage,
  hs_lead_status, hs_email_last_open_date, hs_email_last_click_date,
  notes_last_updated, sales_vertical, industry
  ```
- **Limit:** 200

### Step 4: Add Code Step - Score & Filter Contacts
- **Language:** Node.js

```javascript
export default defineComponent({
  async run({ steps, $ }) {
    const contacts = steps.search_crm.$return_value?.results || [];

    // Lifecycle stages to EXCLUDE (active customers)
    const EXCLUDED_STAGES = [
      "opportunity", "1154636674", "customer", "268792390",
      "1012659574", "1154761341", "1070076549", "other"
    ];

    // Lifecycle stage scores
    const LIFECYCLE_SCORES = {
      "268636563": 80,     // Closed Lost
      "268798100": 75,     // Churned Customer
      "salesqualifiedlead": 60,
      "marketingqualifiedlead": 50,
      "lead": 40,
      "subscriber": 30,
    };

    // Scoring weights
    const WEIGHTS = {
      engagement: 0.25,
      timing: 0.25,
      deal_context: 0.30,
      external_trigger: 0.20,
    };

    function daysSince(dateStr) {
      if (!dateStr) return 365;
      try {
        const dt = new Date(dateStr);
        const now = new Date();
        return Math.floor((now - dt) / (1000 * 60 * 60 * 24));
      } catch {
        return 365;
      }
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
      const lifecycle = props.lifecyclestage || "";
      return LIFECYCLE_SCORES[lifecycle] || 30;
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

    // Filter out excluded lifecycle stages
    const filtered = contacts.filter(c => {
      const stage = c.properties?.lifecyclestage || "";
      return !EXCLUDED_STAGES.includes(stage);
    });

    // Score and sort
    const scored = filtered.map(scoreContact);
    scored.sort((a, b) => b.total_score - a.total_score);

    // Take top 50 for campaign
    const topContacts = scored.slice(0, 50);

    // Generate date string for list name
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    return {
      listName: `Re-engagement ${dateStr}`,
      contactCount: topContacts.length,
      totalScored: scored.length,
      topContacts: topContacts,
      contactIds: topContacts.map(c => c.id),
      // Top 10 for Slack summary
      slackSummary: topContacts.slice(0, 10).map(c =>
        `• *${c.firstname} ${c.lastname}* (${c.company}) - Score: ${c.total_score}`
      ).join('\n'),
    };
  },
});
```

### Step 5: Add HubSpot - Create List
- **App:** HubSpot
- **Action:** Create List (or use API Request)
- **List Name:** `{{steps.code.$return_value.listName}}`
- **Object Type:** CONTACT
- **Processing Type:** MANUAL (static list)

### Step 6: Add HubSpot - Add Contacts to List
- **App:** HubSpot
- **Action:** Add Contact to List
- **List ID:** `{{steps.create_list.$return_value.listId}}`
- **Contact IDs:** `{{steps.code.$return_value.contactIds}}`

### Step 7: Add Slack - Send Message
- **App:** Slack
- **Action:** Send Message
- **Channel:** C0A9Y5HLQAF (outreach-intelligence)
- **Message:**
```
🎯 *Weekly Outreach Intelligence Report*

📊 *Summary*
• Contacts scored: {{steps.code.$return_value.totalScored}}
• Added to list: {{steps.code.$return_value.contactCount}}
• List name: {{steps.code.$return_value.listName}}

🔝 *Top 10 Re-engagement Opportunities*
{{steps.code.$return_value.slackSummary}}

📋 <https://app.hubspot.com/contacts/YOUR_PORTAL_ID/lists/{{steps.create_list.$return_value.listId}}|View HubSpot List>
```

---

## Configuration Values

| Setting | Value |
|---------|-------|
| Schedule | Friday 7:30 AM CST |
| Cron | `30 13 * * 5` (UTC) |
| Slack Channel | C0A9Y5HLQAF |
| Contacts per list | 50 |
| HubSpot List ID (test) | 101845508 |

## Excluded Lifecycle Stages
- opportunity
- 1154636674 (Opportunity)
- customer
- 268792390 (Live Customer)
- 1012659574 (Indirect Customer)
- 1154761341 (Customer)
- 1070076549 (Advocate)
- other (Disqualified)

## Scoring Weights
- Engagement: 25%
- Timing: 25%
- Deal Context: 30%
- External Triggers: 20%
