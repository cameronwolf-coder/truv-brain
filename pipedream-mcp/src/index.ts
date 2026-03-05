#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { PipedreamService } from "./services/pipedream.js";
import { getToolDefinitions, handleToolCall } from "./tools/index.js";

const PIPEDREAM_API_KEY = process.env.PIPEDREAM_API_KEY;
if (!PIPEDREAM_API_KEY) {
  throw new Error("PIPEDREAM_API_KEY environment variable is required");
}

const PIPEDREAM_ORG_ID = process.env.PIPEDREAM_ORG_ID;
if (!PIPEDREAM_ORG_ID) {
  throw new Error("PIPEDREAM_ORG_ID environment variable is required");
}

const pipedreamService = new PipedreamService(PIPEDREAM_API_KEY, PIPEDREAM_ORG_ID);

const server = new Server(
  {
    name: "pipedream-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getToolDefinitions() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    return await handleToolCall(
      pipedreamService,
      request.params.name,
      request.params.arguments as Record<string, unknown>
    );
  } catch (error: unknown) {
    console.error("Pipedream Error:", error);
    if (error instanceof Error) {
      throw new McpError(ErrorCode.InternalError, error.message);
    }
    throw new McpError(ErrorCode.InternalError, "An unexpected error occurred");
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pipedream MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
