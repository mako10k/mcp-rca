import { Readable, Writable } from "node:stream";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";

export type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export interface McpServerOptions {
  name: string;
  version: string;
  title?: string;
  instructions?: string;
}

export type ServerRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export interface TransportStreams {
  input?: Readable;
  output?: Writable;
}

export function createMcpServer(options: McpServerOptions): McpServer {
  return new McpServer(
    {
      name: options.name,
      version: options.version,
      title: options.title ?? options.name,
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true, subscribe: true },
        logging: {},
        sampling: {},
      },
      instructions: options.instructions,
    },
  );
}

export async function connectToTransport(
  server: McpServer,
  transport: StdioServerTransport,
): Promise<void> {
  await server.connect(transport);
}

export function createTransport(streams?: TransportStreams): StdioServerTransport {
  return new StdioServerTransport(streams?.input, streams?.output);
}

export type UnderlyingServer = Server;
