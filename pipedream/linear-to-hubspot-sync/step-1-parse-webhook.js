// Pipedream Step: parse_linear_webhook
// Parses Linear webhook payload for issue state changes
// Extracts HubSpot Task ID from the issue description
// Exits early if not a state change or no linked HubSpot task

export default defineComponent({
  async run({ steps, $ }) {
    const payload = steps.trigger.event.body || steps.trigger.event;

    // Linear webhooks: action = "update", type = "Issue"
    if (payload.type !== "Issue" || payload.action !== "update") {
      return $.flow.exit(`Skipping — not an Issue update (type: ${payload.type}, action: ${payload.action})`);
    }

    // Check if state changed (updatedFrom contains previous values)
    const updatedFrom = payload.updatedFrom || {};
    if (!updatedFrom.stateId) {
      return $.flow.exit("Skipping — no state change in this update");
    }

    const issue = payload.data;
    if (!issue) {
      return $.flow.exit("No issue data in webhook payload");
    }

    // Extract HubSpot Task ID from issue description
    const description = issue.description || "";
    const match = description.match(/HubSpot Task ID:\s*(\d+)/);
    if (!match) {
      return $.flow.exit("No HubSpot Task ID found in issue description — not a synced issue");
    }

    const hubspotTaskId = match[1];
    const linearStateName = issue.state?.name || null;
    const linearIssueId = issue.id;

    // Map Linear status → HubSpot task status
    const STATUS_MAP = {
      "Done":        "COMPLETED",
      "Completed":   "COMPLETED",
      "In Progress": "IN_PROGRESS",
      "In Review":   "IN_PROGRESS",
      "Todo":        "NOT_STARTED",
      "Backlog":     "NOT_STARTED",
      "Canceled":    "DEFERRED",
      "Duplicate":   "DEFERRED"
    };

    const hubspotStatus = STATUS_MAP[linearStateName];
    if (!hubspotStatus) {
      return $.flow.exit(`Unknown Linear state: "${linearStateName}" — cannot map to HubSpot`);
    }

    return {
      linearIssueId,
      linearStateName,
      hubspotTaskId,
      hubspotStatus,
      issueIdentifier: issue.identifier || null
    };
  }
});
