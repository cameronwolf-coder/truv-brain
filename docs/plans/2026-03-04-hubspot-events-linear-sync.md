# HubSpot Events → Linear Projects Sync — Pipedream Workflow

## Overview

Automatically syncs HubSpot Events (custom object) to Linear Projects on the Growth team. When an event is created or updated in HubSpot, a corresponding Linear project is created or updated with matching dates, location, and status — keeping the Growth team's timeline view always current.

**Trigger:** HubSpot workflow webhook (on Event create/update)
**Destination:** Linear API (Growth team projects)

---

## IDs & Keys

| Resource | Value |
|----------|-------|
| HubSpot Custom Object | `2-56342751` (Events) |
| HubSpot Portal | `19933594` |
| Linear Team | Growth (`c935c1a0-a0fc-41e5-a598-a537fcd344de`, key: `MKTG`) |
| Linear API | `https://api.linear.app/graphql` |
| Slack Channel | `C0A9Y5HLQAF` (#outreach-intelligence) |

---

## Architecture

```
HubSpot Event Created/Updated
  → HubSpot Workflow fires (custom object trigger)
  → Sends POST to Pipedream HTTP endpoint with record ID
  → Pipedream: fetch full event properties from HubSpot API
  → Pipedream: search Linear for existing project by name
  → Pipedream: create or update Linear project
  → Pipedream: (optional) Slack notification for new events
```

---

## Workflow Steps

### Step 1: Trigger — HTTP Webhook

**Type:** HTTP / Webhook
**HTTP Method:** POST
**Response:** 200 OK (immediate)

Copy the generated endpoint URL — you'll paste it into the HubSpot workflow (Step 2).

---

### Step 2: HubSpot Workflow Setup (Manual — in HubSpot UI)

1. Go to **HubSpot → Automation → Workflows → Create workflow**
2. Choose **Custom object-based** → select **Events**
3. Set enrollment triggers:
   - **Event is created** (catches new events)
   - **Event Start Date is known** OR **Event Name is known** (catches updates)
4. Add action: **Send a webhook**
   - **Method:** POST
   - **Webhook URL:** `<Pipedream endpoint from Step 1>`
   - **Request body:** Include all Event properties
   - The webhook payload will include the `objectId` (record ID)
5. Under Settings → **Re-enrollment**: Enable re-enrollment so updates re-trigger the workflow
6. Turn on the workflow

**Alternative (if Operations Hub is not available):**
Use Pipedream's built-in HubSpot trigger: **New or Updated CRM Object** with object type `events` / `2-56342751`. This polls HubSpot periodically instead of using webhooks.

---

### Step 3: Code — Fetch Event Details from HubSpot

**Type:** Node.js Code Step (with HubSpot app connected)
**Name:** `fetch_event_details`

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
    const payload = steps.trigger.event.body;

    // HubSpot webhook sends objectId in the body
    // Adjust path based on actual payload structure
    const objectId = payload.objectId
      || payload.properties?.hs_object_id
      || payload.hs_object_id;

    if (!objectId) {
      $.flow.exit("No objectId found in webhook payload");
    }

    // Fetch the full event record with all properties
    const response = await axios($, {
      method: "GET",
      url: `https://api.hubapi.com/crm/v3/objects/2-56342751/${objectId}`,
      headers: {
        Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`
      },
      params: {
        properties: [
          "event_name",
          "event_start_date",
          "event_end_date",
          "event_location",
          "event_url",
          "event_status",
          "event_type"
        ].join(",")
      }
    });

    const props = response.properties || {};

    return {
      id: response.id,
      name: props.event_name || "Untitled Event",
      startDate: props.event_start_date || null,
      endDate: props.event_end_date || null,
      location: props.event_location || "",
      url: props.event_url || "",
      status: props.event_status || "Upcoming",
      type: props.event_type || "Conference"
    };
  }
});
```

---

### Step 4: Code — Sync to Linear

**Type:** Node.js Code Step
**Name:** `sync_to_linear`

**Environment Variable:** Add `LINEAR_API_KEY` to Pipedream workflow settings (generate a Personal API Key from Linear Settings → API).

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
    const TEAM_ID = "c935c1a0-a0fc-41e5-a598-a537fcd344de"; // Growth team
    const event = steps.fetch_event_details.$return_value;

    const projectName = `[MKTG-GROWTH] ${event.name}`;
    const summary = event.location
      ? `${event.name} — ${event.location}`
      : event.name;

    // Build description
    const descParts = [
      `**Event:** ${event.name}`,
      event.location ? `**Location:** ${event.location}` : null,
      event.startDate && event.endDate
        ? `**Dates:** ${formatDateRange(event.startDate, event.endDate)}`
        : null,
      `**Type:** ${event.type}`,
      event.url ? `**Website:** ${event.url}` : null
    ].filter(Boolean);
    const description = descParts.join("\n");

    // Map HubSpot status to Linear project state
    const stateMap = {
      "Upcoming": "planned",
      "In Progress": "started",
      "Completed": "completed"
    };
    const linearState = stateMap[event.status] || "planned";

    // 1. Search for existing project by name
    const searchQuery = `
      query($filter: ProjectFilter) {
        projects(filter: $filter) {
          nodes {
            id
            name
          }
        }
      }
    `;

    const searchRes = await axios($, {
      method: "POST",
      url: "https://api.linear.app/graphql",
      headers: {
        Authorization: LINEAR_API_KEY,
        "Content-Type": "application/json"
      },
      data: {
        query: searchQuery,
        variables: {
          filter: {
            name: { containsIgnoreCase: event.name },
            accessibleTeams: { some: { id: { eq: TEAM_ID } } }
          }
        }
      }
    });

    const existingProjects = searchRes.data?.projects?.nodes || [];
    const existingProject = existingProjects.find(
      p => p.name === projectName
    );

    if (existingProject) {
      // 2a. Update existing project
      const updateMutation = `
        mutation($id: String!, $input: ProjectUpdateInput!) {
          projectUpdate(id: $id, input: $input) {
            success
            project { id name }
          }
        }
      `;

      const input = {
        summary,
        description,
        state: linearState
      };

      // Only set dates if they exist (avoid clearing dates on partial updates)
      if (event.startDate) input.startDate = event.startDate;
      if (event.endDate) input.targetDate = event.endDate;

      await axios($, {
        method: "POST",
        url: "https://api.linear.app/graphql",
        headers: {
          Authorization: LINEAR_API_KEY,
          "Content-Type": "application/json"
        },
        data: {
          query: updateMutation,
          variables: { id: existingProject.id, input }
        }
      });

      return {
        action: "updated",
        projectId: existingProject.id,
        projectName,
        event: event.name
      };
    } else {
      // 2b. Create new project
      const createMutation = `
        mutation($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            success
            project { id name url }
          }
        }
      `;

      const input = {
        name: projectName,
        teamIds: [TEAM_ID],
        summary,
        description,
        icon: "calendar",
        state: linearState
      };

      if (event.startDate) input.startDate = event.startDate;
      if (event.endDate) input.targetDate = event.endDate;

      const createRes = await axios($, {
        method: "POST",
        url: "https://api.linear.app/graphql",
        headers: {
          Authorization: LINEAR_API_KEY,
          "Content-Type": "application/json"
        },
        data: {
          query: createMutation,
          variables: { input }
        }
      });

      const project = createRes.data?.projectCreate?.project;

      return {
        action: "created",
        projectId: project?.id,
        projectUrl: project?.url,
        projectName,
        event: event.name
      };
    }

    // Helper: format date range for description
    function formatDateRange(start, end) {
      const s = new Date(start + "T00:00:00");
      const e = new Date(end + "T00:00:00");
      const opts = { month: "long", day: "numeric", year: "numeric" };
      return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric" })}–${e.toLocaleDateString("en-US", opts)}`;
    }
  }
});
```

---

### Step 5: (Optional) Slack Notification for New Events

**Type:** Slack — Send Message
**Channel:** `C0A9Y5HLQAF` (#outreach-intelligence)
**Condition:** Only run when `steps.sync_to_linear.$return_value.action === "created"`

**Message:**
```
📅 *New Event Synced to Linear*

*{{steps.sync_to_linear.$return_value.projectName}}*
View in Linear: {{steps.sync_to_linear.$return_value.projectUrl}}
```

---

## Setup Instructions (Pipedream UI)

1. Create a new workflow in the **GTM Automation** project
2. Add **HTTP / Webhook** trigger → copy the endpoint URL
3. In **HubSpot**: create an Events workflow that POSTs to the Pipedream endpoint on create/update (see Step 2 above)
4. Add **Node.js Code** step → paste Step 3 code → connect HubSpot app
5. Add `LINEAR_API_KEY` to Pipedream environment variables (Settings → Environment Variables)
6. Add **Node.js Code** step → paste Step 4 code
7. (Optional) Add **Slack** step → paste Step 5 config
8. Test with a manual webhook payload, then deploy

---

## Environment Variables

| Variable | Where to Get |
|----------|-------------|
| `LINEAR_API_KEY` | Linear → Settings → API → Personal API Keys → Create key |
| HubSpot OAuth | Connect HubSpot app in Pipedream (auto-handles tokens) |

---

## Field Mapping Reference

| HubSpot Event Property | Linear Project Field | Notes |
|---|---|---|
| `event_name` | `name` | Prefixed with `[MKTG-GROWTH]` |
| `event_start_date` | `startDate` | ISO date |
| `event_end_date` | `targetDate` | ISO date |
| `event_location` | `summary` | Format: "Event Name — Location" |
| `event_url` | `description` | Included in markdown body |
| `event_status` | `state` | Upcoming→planned, In Progress→started, Completed→completed |
| `event_type` | `description` | Included in markdown body |

---

## Testing

1. **Dry run:** Send a test POST to the Pipedream endpoint with a sample payload:
   ```json
   { "objectId": "<any-event-record-id>" }
   ```
2. **Create test:** Add a new Event in HubSpot → verify it appears as a Linear project
3. **Update test:** Change the start date on an existing Event → verify the Linear project updates
4. **Duplicate check:** Trigger the same event twice → verify it updates (not duplicates)

---

## Limitations & Notes

- **HubSpot Operations Hub** is required for webhook actions in workflows. If not available, use Pipedream's HubSpot polling trigger instead (checks every 15 min)
- **Linear API key** should be a service account or Cameron's personal key
- **Re-enrollment** must be enabled in the HubSpot workflow for updates to re-trigger
- The sync is one-directional: HubSpot → Linear only. Changes in Linear won't flow back to HubSpot
