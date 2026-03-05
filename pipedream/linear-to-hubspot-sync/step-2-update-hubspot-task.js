// Pipedream Step: update_hubspot_task
// Updates HubSpot task status based on Linear issue state change
// Includes loop prevention: fetches current status before writing
// Requires: HubSpot app connected

import { axios } from "@pipedream/platform";

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot"
    }
  },
  async run({ steps, $ }) {
    const parsed = steps.parse_linear_webhook.$return_value;
    const { hubspotTaskId, hubspotStatus, linearIssueId, linearStateName } = parsed;

    // ── Loop prevention: fetch current HubSpot task status ──────
    const current = await axios($, {
      method: "GET",
      url: `https://api.hubapi.com/crm/v3/objects/tasks/${hubspotTaskId}`,
      headers: {
        Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`
      },
      params: {
        properties: "hs_task_status"
      }
    });

    const currentStatus = current.properties?.hs_task_status;
    if (currentStatus === hubspotStatus) {
      return $.flow.exit(`HubSpot task ${hubspotTaskId} already "${hubspotStatus}" — skipping to prevent loop`);
    }

    // ── Update task status ──────────────────────────────────────
    await axios($, {
      method: "PATCH",
      url: `https://api.hubapi.com/crm/v3/objects/tasks/${hubspotTaskId}`,
      headers: {
        Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`,
        "Content-Type": "application/json"
      },
      data: {
        properties: {
          hs_task_status: hubspotStatus
        }
      }
    });

    return {
      action: "updated",
      hubspotTaskId,
      previousStatus: currentStatus,
      newStatus: hubspotStatus,
      source: `Linear issue state changed to "${linearStateName}"`,
      linearIssueId
    };
  }
});
