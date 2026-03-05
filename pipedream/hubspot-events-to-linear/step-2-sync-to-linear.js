// Pipedream Step: sync_to_linear
// Creates or updates a Linear project based on HubSpot Event data
// Requires: LINEAR_API_KEY in Pipedream environment variables

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
    const TEAM_ID = "c935c1a0-a0fc-41e5-a598-a537fcd344de"; // Growth team
    const EVENT_LABEL_ID = "f4ddf3c9-3f95-4c3e-8cd6-7b60348a1d8f"; // "Event" project label
    const event = steps.fetch_event_details.$return_value;

    const projectName = `[MKTG-EVENT] ${event.name}`;

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

    // Map HubSpot status to Linear statusId UUIDs
    const statusMap = {
      "Upcoming":    "48884dae-a45d-4901-bd82-a9dc8c3b6fbf",  // Planned
      "In Progress": "c7780b3f-4ce9-4f7c-bb58-d80903fe460e",  // In Progress
      "Complete":    "05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e",  // Completed
      "Completed":   "05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e",  // Completed (alias)
    };
    const statusId = statusMap[event.status] || statusMap["Upcoming"];

    // Helper for GraphQL calls
    async function gql(query, variables) {
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
    }

    // 1. Search for existing project by name
    const searchRes = await gql(`
      query($filter: ProjectFilter) {
        projects(filter: $filter) {
          nodes { id name }
        }
      }
    `, {
      filter: {
        name: { containsIgnoreCase: event.name },
        accessibleTeams: { some: { id: { eq: TEAM_ID } } }
      }
    });

    const existing = searchRes.data?.projects?.nodes?.find(p => p.name === projectName);

    if (existing) {
      // 2a. Update existing project
      const input = { description, statusId };
      if (event.startDate) input.startDate = event.startDate;
      if (event.endDate) input.targetDate = event.endDate;

      await gql(`
        mutation($id: String!, $input: ProjectUpdateInput!) {
          projectUpdate(id: $id, input: $input) {
            success
            project { id name }
          }
        }
      `, { id: existing.id, input });

      return {
        action: "updated",
        projectId: existing.id,
        projectName,
        event: event.name
      };
    } else {
      // 2b. Create new project
      const input = {
        name: projectName,
        teamIds: [TEAM_ID],
        description,
        statusId
      };
      if (event.startDate) input.startDate = event.startDate;
      if (event.endDate) input.targetDate = event.endDate;

      const createRes = await gql(`
        mutation($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            success
            project { id name url }
          }
        }
      `, { input });

      const project = createRes.data?.projectCreate?.project;

      // Apply "Event" project label
      if (project?.id) {
        await gql(`
          mutation($projectId: String!, $labelId: String!) {
            projectAddLabel(id: $projectId, labelId: $labelId) {
              success
            }
          }
        `, { projectId: project.id, labelId: EVENT_LABEL_ID });
      }

      return {
        action: "created",
        projectId: project?.id,
        projectUrl: project?.url,
        projectName,
        event: event.name
      };
    }

    function formatDateRange(start, end) {
      const s = new Date(start + "T00:00:00");
      const e = new Date(end + "T00:00:00");
      const opts = { month: "long", day: "numeric", year: "numeric" };
      return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric" })}–${e.toLocaleDateString("en-US", opts)}`;
    }
  }
});
