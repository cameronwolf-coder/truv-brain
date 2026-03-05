import { PipedreamService } from "../services/pipedream.js";

export const getToolDefinitions = () => [
  {
    name: "pipedream_get_user",
    description: "Get current Pipedream user info and workspace details",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "pipedream_list_workflows",
    description:
      "List all workflows in the workspace. Returns workflow IDs, triggers, and step counts. Note: fetches details for each workflow so use a small limit for quick results.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max workflows to return (default 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "pipedream_get_workflow",
    description:
      "Get details of a specific workflow by ID (starts with p_). Returns triggers, steps, and configuration.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Workflow ID (e.g. p_abc123)",
        },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "pipedream_create_workflow",
    description:
      "Create a new workflow from a template. Requires a project ID and template ID from Pipedream.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Project ID (starts with proj_)",
        },
        template_id: {
          type: "string",
          description: "Template ID from a workflow share link (starts with tch_)",
        },
        name: {
          type: "string",
          description: "Name for the new workflow",
        },
        steps: {
          type: "array",
          description: "Step definitions with namespace and props",
        },
        triggers: {
          type: "array",
          description: "Trigger definitions with type and props",
        },
        auto_deploy: {
          type: "boolean",
          description: "Auto-deploy the workflow (default true)",
        },
      },
      required: ["project_id", "template_id", "name"],
    },
  },
  {
    name: "pipedream_update_workflow",
    description: "Activate or deactivate a workflow",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Workflow ID (e.g. p_abc123)",
        },
        active: {
          type: "boolean",
          description: "true to activate, false to deactivate",
        },
      },
      required: ["workflow_id", "active"],
    },
  },
  {
    name: "pipedream_trigger_workflow",
    description:
      "Trigger a workflow via its HTTP endpoint URL. Only works for workflows with HTTP triggers.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint_url: {
          type: "string",
          description: "The workflow's HTTP trigger endpoint URL",
        },
        payload: {
          type: "object",
          description: "JSON payload to send to the workflow (optional)",
        },
      },
      required: ["endpoint_url"],
    },
  },
  {
    name: "pipedream_list_sources",
    description: "List event sources in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max sources to return (default 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "pipedream_get_source_events",
    description: "Get recent events from an event source",
    inputSchema: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "Source ID (starts with dc_)",
        },
        limit: {
          type: "number",
          description: "Max events to return (default 10)",
        },
      },
      required: ["source_id"],
    },
  },
  {
    name: "pipedream_update_source",
    description: "Activate or deactivate an event source",
    inputSchema: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "Source ID (starts with dc_)",
        },
        active: {
          type: "boolean",
          description: "true to activate, false to deactivate",
        },
      },
      required: ["source_id", "active"],
    },
  },
  {
    name: "pipedream_delete_source_events",
    description: "Delete all events from an event source",
    inputSchema: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "Source ID (starts with dc_)",
        },
      },
      required: ["source_id"],
    },
  },
  {
    name: "pipedream_list_subscriptions",
    description:
      "List all subscriptions (connections between emitters and listeners) in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max subscriptions to return (default 100)",
        },
      },
      required: [],
    },
  },
  {
    name: "pipedream_create_subscription",
    description:
      "Subscribe a listener (workflow/source) to events from an emitter (source/trigger)",
    inputSchema: {
      type: "object",
      properties: {
        emitter_id: {
          type: "string",
          description: "ID of the emitter (source or trigger)",
        },
        listener_id: {
          type: "string",
          description: "ID of the listener (workflow)",
        },
        event_name: {
          type: "string",
          description: "Event name to filter (optional, e.g. $errors)",
        },
      },
      required: ["emitter_id", "listener_id"],
    },
  },
  {
    name: "pipedream_delete_subscription",
    description: "Delete a subscription",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: {
          type: "string",
          description: "Subscription ID (starts with sub_)",
        },
      },
      required: ["subscription_id"],
    },
  },
  {
    name: "pipedream_search_components",
    description:
      "Search the Pipedream component registry for available actions and triggers",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g. 'slack send message', 'hubspot create contact')",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "pipedream_list_apps",
    description: "List or search available Pipedream app integrations",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (optional, e.g. 'slack', 'hubspot')",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
      required: [],
    },
  },
];

export async function handleToolCall(
  service: PipedreamService,
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ content: Array<{ type: string; text: string }> }> {
  let result: unknown;

  switch (name) {
    case "pipedream_get_user":
      result = await service.getCurrentUser();
      break;

    case "pipedream_list_workflows":
      result = await service.listWorkflows((args.limit as number) || 10);
      break;

    case "pipedream_get_workflow":
      result = await service.getWorkflow(args.workflow_id as string);
      break;

    case "pipedream_create_workflow":
      result = await service.createWorkflow({
        projectId: args.project_id as string,
        templateId: args.template_id as string,
        name: args.name as string,
        steps: args.steps as unknown[] | undefined,
        triggers: args.triggers as unknown[] | undefined,
        autoDeploy: args.auto_deploy as boolean | undefined,
      });
      break;

    case "pipedream_update_workflow":
      result = await service.updateWorkflow(
        args.workflow_id as string,
        args.active as boolean
      );
      break;

    case "pipedream_trigger_workflow":
      result = await service.triggerWorkflow(
        args.endpoint_url as string,
        args.payload
      );
      break;

    case "pipedream_list_sources":
      result = await service.listSources((args.limit as number) || 10);
      break;

    case "pipedream_get_source_events":
      result = await service.getSourceEvents(
        args.source_id as string,
        (args.limit as number) || 10
      );
      break;

    case "pipedream_update_source":
      result = await service.updateSource(
        args.source_id as string,
        args.active as boolean
      );
      break;

    case "pipedream_delete_source_events":
      result = await service.deleteSourceEvents(args.source_id as string);
      break;

    case "pipedream_list_subscriptions":
      result = await service.listSubscriptions((args.limit as number) || 100);
      break;

    case "pipedream_create_subscription":
      result = await service.createSubscription(
        args.emitter_id as string,
        args.listener_id as string,
        args.event_name as string | undefined
      );
      break;

    case "pipedream_delete_subscription":
      result = await service.deleteSubscription(args.subscription_id as string);
      break;

    case "pipedream_search_components":
      result = await service.searchComponents(
        args.query as string,
        (args.limit as number) || 10
      );
      break;

    case "pipedream_list_apps":
      result = await service.listApps(
        args.query as string | undefined,
        (args.limit as number) || 10
      );
      break;

    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
