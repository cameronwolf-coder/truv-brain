# Marketing Hub — Pipedream Workflows

Three Pipedream workflows power the Slack automation and Google Calendar sync for the Marketing Hub. All live in the **GTM Automation** project.

---

## Workflow A: Weekly Marketing Roundup

**Trigger:** Schedule — Every Monday at 8:00 AM CST
**Channel:** #marketing-updates (create this channel first)

### Step 1: Fetch Completed Items (Linear)

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sinceDate = weekAgo.toISOString().split("T")[0];

    const query = `query {
      team(id: "c935c1a0-a0fc-41e5-a598-a537fcd344de") {
        issues(
          filter: {
            completedAt: { gte: "${sinceDate}" }
            state: { type: { eq: "completed" } }
          }
          first: 50
          orderBy: completedAt
        ) {
          nodes {
            title url
            project { name }
            completedAt
          }
        }
      }
    }`;

    const response = await axios($, {
      method: "POST",
      url: "https://api.linear.app/graphql",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.LINEAR_API_KEY,
      },
      data: { query },
    });

    return response.data.team.issues.nodes;
  },
});
```

### Step 2: Fetch Upcoming Items (Linear)

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startDate = now.toISOString().split("T")[0];
    const endDate = weekLater.toISOString().split("T")[0];

    const query = `query {
      team(id: "c935c1a0-a0fc-41e5-a598-a537fcd344de") {
        issues(
          filter: { dueDate: { gte: "${startDate}", lte: "${endDate}" } }
          first: 50
          orderBy: dueDate
        ) {
          nodes {
            title url dueDate
            assignee { name }
            project { name }
          }
        }
      }
    }`;

    const response = await axios($, {
      method: "POST",
      url: "https://api.linear.app/graphql",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.LINEAR_API_KEY,
      },
      data: { query },
    });

    return response.data.team.issues.nodes;
  },
});
```

### Step 3: Format Slack Message

```javascript
export default defineComponent({
  async run({ steps, $ }) {
    const completed = steps.fetch_completed.$return_value || [];
    const upcoming = steps.fetch_upcoming.$return_value || [];

    const completedLines = completed.length > 0
      ? completed.map((i) => {
          const project = i.project ? `[${i.project.name}] ` : "";
          return `• ${project}<${i.url}|${i.title}>`;
        }).join("\n")
      : "• _No items completed this week_";

    const upcomingLines = upcoming.length > 0
      ? upcoming.map((i) => {
          const assignee = i.assignee ? ` — ${i.assignee.name}` : "";
          const project = i.project ? `[${i.project.name}] ` : "";
          const due = new Date(i.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return `• ${project}<${i.url}|${i.title}> (${due}${assignee})`;
        }).join("\n")
      : "• _Nothing due this week_";

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: "📅 Weekly Marketing Roundup", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Last Week — Completed (${completed.length})*\n${completedLines}`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*This Week — Upcoming (${upcoming.length})*\n${upcomingLines}`,
        },
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "View full calendar → <https://truv-brain.vercel.app/marketing-hub|Marketing Hub>",
          },
        ],
      },
    ];

    return { blocks, text: `Weekly Marketing Roundup: ${completed.length} completed, ${upcoming.length} upcoming` };
  },
});
```

### Step 4: Post to Slack

Use the **Slack — Send Message** action:
- Channel: `#marketing-updates`
- Message text: `{{steps.format_message.$return_value.text}}`
- Blocks: `{{steps.format_message.$return_value.blocks}}`
- Bot name: `Marketing Hub`

---

## Workflow B: Event-Driven Alerts

**Trigger:** Linear webhook — Issue state changes

### Setup: Create Linear Webhook

In Pipedream, use a **Webhook** trigger. Then register it with Linear:

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "mutation { webhookCreate(input: { url: \"YOUR_PIPEDREAM_WEBHOOK_URL\", teamId: \"c935c1a0-a0fc-41e5-a598-a537fcd344de\", resourceTypes: [\"Issue\"] }) { success webhook { id } } }"
  }'
```

### Step 1: Filter to Completed Issues

```javascript
export default defineComponent({
  async run({ steps, $ }) {
    const body = steps.trigger.event.body;

    // Only process issue updates
    if (body.type !== "Issue" || body.action !== "update") {
      $.flow.exit("Not an issue update");
    }

    // Only fire when state changes to completed
    const data = body.data;
    const updatedFields = body.updatedFrom;

    if (!updatedFields?.stateId) {
      $.flow.exit("State did not change");
    }

    // Check if new state is completed type
    if (data.state?.type !== "completed") {
      $.flow.exit("Not marked as completed");
    }

    return {
      title: data.title,
      url: data.url,
      assignee: data.assignee?.name || "Unassigned",
      project: data.project?.name || null,
    };
  },
});
```

### Step 2: Post to Slack

Use the **Slack — Send Message** action:
- Channel: `#marketing-updates`
- Message:
```
✅ *Completed:* <{{steps.filter.$return_value.url}}|{{steps.filter.$return_value.title}}>
{{#if steps.filter.$return_value.project}}Project: {{steps.filter.$return_value.project}} | {{/if}}Assignee: {{steps.filter.$return_value.assignee}}
```

---

## Workflow C: Google Calendar Sync

**Trigger:** Schedule — Daily at 6:00 AM CST

### Step 1: Call GCal Sync Endpoint

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const response = await axios($, {
      method: "POST",
      url: "https://truv-brain.vercel.app/api/marketing-hub/gcal-sync",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GCAL_SYNC_SECRET}`,
      },
    });

    console.log(`GCal sync: ${response.created} created, ${response.updated} updated, ${response.deleted} deleted`);
    return response;
  },
});
```

---

## Environment Variables Needed

| Variable | Where | Purpose |
|----------|-------|---------|
| `LINEAR_API_KEY` | Pipedream env + Vercel | Linear GraphQL API access |
| `GOOGLE_CALENDAR_ID` | Vercel env | Shared Google Calendar to sync to |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Vercel env | Google service account credentials |
| `GCAL_SYNC_SECRET` | Pipedream env + Vercel | Shared secret for sync endpoint auth |

## Setup Checklist

- [ ] Create `#marketing-updates` Slack channel
- [ ] Create shared Google Calendar (e.g., "Marketing Calendar")
- [ ] Share Google Calendar with service account email (Editor access)
- [ ] Add `GOOGLE_CALENDAR_ID` to Vercel env vars
- [ ] Generate `GCAL_SYNC_SECRET` (any random string) and add to both Vercel + Pipedream
- [ ] Create Workflow A in Pipedream (Weekly Roundup)
- [ ] Create Workflow B in Pipedream (Event-Driven Alerts)
- [ ] Create Workflow C in Pipedream (GCal Sync)
- [ ] Register Linear webhook for Workflow B
- [ ] Test each workflow manually before enabling schedules
