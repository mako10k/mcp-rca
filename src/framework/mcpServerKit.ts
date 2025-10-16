import type { ToolDefinition } from "../tools/types.js";

export interface McpServerOptions {
  name: string;
  version: string;
  capabilities?: Record<string, unknown>;
}

interface RegisteredTool extends ToolDefinition {
  name: string;
}

export interface McpServer {
  options: McpServerOptions;
  tools: Map<string, RegisteredTool>;
  registerTool: (tool: RegisteredTool) => void;
  start: () => Promise<void>;
  listen: () => Promise<void>;
}

export async function createMcpServer(options: McpServerOptions): Promise<McpServer> {
  const tools = new Map<string, RegisteredTool>();

  const registerTool = (tool: RegisteredTool) => {
    tools.set(tool.name, tool);
  };

  const noopStart = async () => {
    // Placeholder server lifecycle hook.
  };

  return {
    options,
    tools,
    registerTool,
    start: noopStart,
    listen: noopStart,
  };
}
