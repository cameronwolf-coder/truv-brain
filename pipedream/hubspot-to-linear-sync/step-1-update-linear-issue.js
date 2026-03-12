// Pipedream Step: update_linear_issue
// Updates Linear issue state when HubSpot task status changes
// Triggered by HubSpot workflow webhook sending { taskId, status, linearIssueId }
// Includes loop prevention: fetches current Linear state before writing
// Requires: LINEAR_API_KEY env var

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
    const payload = steps.trigger.event.body || steps.trigger.event;

    const { taskId, status, linearIssueId } = payload;

    if (!linearIssueId) {
      return $.flow.exit("No linearIssueId in payload — cannot update Linear");
    }

    if (!status) {
      return $.flow.exit("No status in payload");
    }

    // ── Issue workflow state IDs (Growth team) ──────────────────
    // HubSpot may send internal values (COMPLETED) or display labels (Completed)
    const STATE_MAP = {
      "COMPLETED":   "e5970814-1386-4ee0-ac9a-6bb8307f76f8",  // Done
      "IN_PROGRESS": "fae285fd-2f85-4c9e-80b5-f8e2780ad2d3",  // In Progress
      "NOT_STARTED": "ce315851-4e6e-495f-82fe-d800ddf4388b",  // Todo
      "DEFERRED":    "f7472bb0-b7d0-4bab-9679-2199873df58b",  // Canceled
      // Display label variants
      "Completed":   "e5970814-1386-4ee0-ac9a-6bb8307f76f8",
      "In progress": "fae285fd-2f85-4c9e-80b5-f8e2780ad2d3",
      "Not started": "ce315851-4e6e-495f-82fe-d800ddf4388b",
      "Deferred":    "f7472bb0-b7d0-4bab-9679-2199873df58b"
    };

    const targetStateId = STATE_MAP[status];
    if (!targetStateId) {
      return $.flow.exit(`Unknown HubSpot status: "${status}" — cannot map to Linear state`);
    }

    // ── Helper: Linear GraphQL ──────────────────────────────────
    const gql = async (query, variables) => {
      const res = await axios($, {
        method: "POST",
        url: "https://api.linear.app/graphql",
        headers: {
          Authorization: LINEAR_API_KEY,
          "Content-Type": "application/json"
        },
        data: { query, variables }
      });
      if (res.data?.errors) {
        throw new Error(`Linear GraphQL error: ${JSON.stringify(res.data.errors)}`);
      }
      return res;
    };

    // ── Loop prevention: fetch current Linear issue state ───────
    const currentRes = await gql(`
      query($id: String!) {
        issue(id: $id) {
          id
          identifier
          state { id name }
        }
      }
    `, { id: linearIssueId });

    const currentIssue = currentRes.data?.issue;
    if (!currentIssue) {
      return $.flow.exit(`Linear issue ${linearIssueId} not found`);
    }

    if (currentIssue.state.id === targetStateId) {
      return $.flow.exit(`Linear issue ${currentIssue.identifier} already in "${currentIssue.state.name}" — skipping to prevent loop`);
    }

    // ── Update issue state ──────────────────────────────────────
    const updateRes = await gql(`
      mutation($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue { id identifier state { name } }
        }
      }
    `, {
      id: linearIssueId,
      input: { stateId: targetStateId }
    });

    const updatedIssue = updateRes.data?.issueUpdate?.issue;

    return {
      action: "updated",
      linearIssueId,
      identifier: updatedIssue?.identifier,
      previousState: currentIssue.state.name,
      newState: updatedIssue?.state?.name,
      hubspotTaskId: taskId,
      source: `HubSpot task status changed to "${status}"`
    };
  }
});
