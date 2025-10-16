import { fileURLToPath } from "node:url";
import { createMcpServer } from "./framework/mcpServerKit.js";
import { conclusionTool } from "./tools/conclusion.js";
import { hypothesisProposeTool } from "./tools/hypothesis.js";
import { prioritizeTool } from "./tools/prioritize.js";
import { testPlanTool } from "./tools/test_plan.js";
import type { ToolDefinition } from "./tools/types.js";

const TOOL_REGISTRY: Array<ToolDefinition<any, any>> = [
  hypothesisProposeTool,
  testPlanTool,
  prioritizeTool,
  conclusionTool,
];

function registerTool(server: any, tool: ToolDefinition) {
  if (typeof server.registerTool === "function") {
    server.registerTool(tool);
  } else if (typeof server.tool === "function") {
    server.tool(tool);
  } else if (
    typeof server.addTool === "function" &&
    tool.name &&
    typeof tool.handler === "function"
  ) {
    server.addTool(tool.name, tool);
  } else {
    throw new Error(`Unknown MCP server interface for tool ${tool.name}`);
  }
}

export async function buildServer() {
  const server = await createMcpServer({
    name: "mcp-rca",
    version: "0.1.0",
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
    },
  });

  TOOL_REGISTRY.forEach((tool) => registerTool(server, tool));

  return server;
}

export async function start() {
  const server = await buildServer();
  if (typeof server.start === "function") {
    return server.start();
  }
  if (typeof server.listen === "function") {
    return server.listen();
  }
  throw new Error("MCP server implementation does not expose a start method.");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  start().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start mcp-rca server", error);
    process.exit(1);
  });
}
