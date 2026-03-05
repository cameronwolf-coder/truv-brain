// Pipedream Step: sync_tasks_to_linear
// Creates Linear Issues from HubSpot webinar playbook tasks
// Writes linear_issue_id back to each HubSpot task for bi-directional sync
// Only runs when step-3 created tasks (Webinar events)
// Requires: LINEAR_API_KEY env var, HubSpot app connected

import { axios } from "@pipedream/platform";

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot"
    }
  },
  async run({ steps, $ }) {
    const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
    const TEAM_ID = "c935c1a0-a0fc-41e5-a598-a537fcd344de"; // Growth team

    // ── Issue workflow state IDs ──────────────────────────────────
    const STATES = {
      TODO: "ce315851-4e6e-495f-82fe-d800ddf4388b",
      IN_PROGRESS: "fae285fd-2f85-4c9e-80b5-f8e2780ad2d3",
      DONE: "e5970814-1386-4ee0-ac9a-6bb8307f76f8",
      CANCELED: "f7472bb0-b7d0-4bab-9679-2199873df58b"
    };

    // ── HubSpot Owner → Linear User mapping ─────────────────────
    const OWNER_MAP = {
      "82949240":  "e0bb82cc-96ed-4d37-a9c8-df774f929dcb",  // Cam Wolf
      "84510183":  "1301d24a-87ef-4674-94d8-99b3ee5ece78",  // Melissa Hausser
      "434899562": "966e7ba1-f9a7-448f-a4a6-516067bca022"   // Kaytren Bruner
    };

    // ── Priority mapping (HubSpot → Linear) ─────────────────────
    // Linear: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
    const PRIORITY_MAP = {
      HIGH: 2,
      MEDIUM: 3
    };

    // Get tasks from create_webinar_tasks and event from code (fetch_event_details)
    const taskResult = steps.create_webinar_tasks?.$return_value;
    const event = steps.code?.$return_value;

    if (!taskResult?.tasks?.length) {
      return $.flow.exit("No webinar tasks to sync — skipping Linear issue creation");
    }

    const tasks = taskResult.tasks;

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

    // ── Find or create the Linear project ──────────────────────────
    const EVENT_LABEL_ID = "f4ddf3c9-3f95-4c3e-8cd6-7b60348a1d8f";
    const projectName = `[MKTG-EVENT] ${event.name}`;

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

    let projectId = searchRes.data?.projects?.nodes?.find(p => p.name === projectName)?.id;

    // Create project if it doesn't exist yet (runs before sync_to_linear)
    if (!projectId) {
      const statusMap = {
        "Upcoming":    "48884dae-a45d-4901-bd82-a9dc8c3b6fbf",
        "In Progress": "c7780b3f-4ce9-4f7c-bb58-d80903fe460e",
        "Complete":    "05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e",
        "Completed":   "05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e"
      };
      const input = {
        name: projectName,
        teamIds: [TEAM_ID],
        description: `**Event:** ${event.name}\n**Type:** ${event.type}`,
        statusId: statusMap[event.status] || statusMap["Upcoming"]
      };
      if (event.startDate) input.startDate = event.startDate;
      if (event.endDate) input.targetDate = event.endDate;

      const createRes = await gql(`
        mutation($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            success
            project { id name }
          }
        }
      `, { input });

      projectId = createRes.data?.projectCreate?.project?.id;

      if (projectId) {
        await gql(`
          mutation($projectId: String!, $labelId: String!) {
            projectAddLabel(id: $projectId, labelId: $labelId) { success }
          }
        `, { projectId, labelId: EVENT_LABEL_ID });
      }
    }

    if (!projectId) {
      return $.flow.exit("Could not find or create Linear project — cannot attach issues");
    }

    // ── Helper: write linear_issue_id back to HubSpot task ──────
    const writeLinearIdToHubSpot = async (hubspotTaskId, linearIssueId) => {
      await axios($, {
        method: "PATCH",
        url: `https://api.hubapi.com/crm/v3/objects/tasks/${hubspotTaskId}`,
        headers: {
          Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`,
          "Content-Type": "application/json"
        },
        data: {
          properties: {
            linear_issue_id: linearIssueId
          }
        }
      });
    };

    // ── Create issues ───────────────────────────────────────────
    const results = [];
    for (const task of tasks) {
      try {
        // Build issue description with HubSpot Task ID for reverse sync
        const description = `${task.body}\n\n---\nHubSpot Task ID: ${task.id}`;

        // Map owner to Linear assignee
        const hubspotOwnerId = {
          MARKETING_OPS: "82949240",
          EVENT_MARKETING: "84510183",
          PRODUCT_MARKETING: "434899562",
          SALES: null
        }[task.owner];

        const assigneeId = hubspotOwnerId ? OWNER_MAP[hubspotOwnerId] : null;

        const input = {
          title: task.subject,
          description,
          teamId: TEAM_ID,
          projectId,
          stateId: STATES.TODO,
          priority: PRIORITY_MAP[task.priority] || 3,
          dueDate: task.dueDate
        };

        if (assigneeId) {
          input.assigneeId = assigneeId;
        }

        const res = await gql(`
          mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue { id identifier url }
            }
          }
        `, { input });

        const issue = res.data?.issueCreate?.issue;

        // Write Linear issue ID back to HubSpot task
        if (issue?.id) {
          await writeLinearIdToHubSpot(task.id, issue.id);
        }

        results.push({
          hubspotTaskId: task.id,
          linearIssueId: issue?.id,
          identifier: issue?.identifier,
          subject: task.subject,
          status: "created"
        });
      } catch (err) {
        results.push({
          hubspotTaskId: task.id,
          subject: task.subject,
          status: "failed",
          error: err.message || String(err)
        });
      }
    }

    const created = results.filter(r => r.status === "created");
    const failed = results.filter(r => r.status === "failed");

    return {
      projectId,
      totalIssues: tasks.length,
      created: created.length,
      failed: failed.length,
      issues: created,
      failedIssues: failed
    };
  }
});
