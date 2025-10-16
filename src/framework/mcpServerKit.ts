import { randomUUID } from "node:crypto";
import { type Readable, type Writable } from "node:stream";
import type { ToolDefinition, ToolContext } from "../tools/types.js";

const JSONRPC_VERSION = "2.0";
const HEADER_DELIMITER = Buffer.from("\r\n\r\n");

export interface McpServerOptions {
  name: string;
  version: string;
  capabilities?: Record<string, unknown>;
}

export interface TransportStreams {
  input?: Readable;
  output?: Writable;
}

interface RegisteredTool extends ToolDefinition {
  name: string;
}

interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown> | undefined;
}

interface JsonRpcSuccess {
  jsonrpc: typeof JSONRPC_VERSION;
  id: string | number | null;
  result: unknown;
}

interface JsonRpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcFailure {
  jsonrpc: typeof JSONRPC_VERSION;
  id: string | number | null;
  error: JsonRpcErrorShape;
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

type RequestHandler = (request: JsonRpcRequest) => Promise<void>;

class JsonRpcStreamTransport {
  private readonly input: Readable;
  private readonly output: Writable;
  private buffer = Buffer.alloc(0);
  private listening = false;
  private handler: RequestHandler | null = null;
  private readonly interactive: boolean;

  constructor(streams?: TransportStreams) {
    this.input = streams?.input ?? process.stdin;
    this.output = streams?.output ?? process.stdout;
    this.interactive = Boolean((this.input as Readable & { isTTY?: boolean }).isTTY);
  }

  listen(handler: RequestHandler) {
    if (this.listening) {
      this.handler = handler;
      return;
    }

    this.handler = handler;
    this.listening = true;

    this.input.on("data", (chunk) => {
      const data = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : (chunk as Buffer);
      this.buffer = Buffer.concat([this.buffer, data]);
      this.processBuffer();
    });

    if (typeof (this.input as Readable & { resume?: () => void }).resume === "function") {
      (this.input as Readable & { resume: () => void }).resume();
    }
  }

  isInteractive() {
    return this.interactive;
  }

  send(message: JsonRpcResponse) {
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`);
    this.output.write(header);
    this.output.write(payload);
  }

  private processBuffer() {
    while (true) {
      const headerIndex = this.buffer.indexOf(HEADER_DELIMITER);
      if (headerIndex === -1) {
        return;
      }

      const headerChunk = this.buffer.slice(0, headerIndex).toString("utf8");
      const contentLength = this.parseContentLength(headerChunk);

      if (contentLength === null) {
        console.error("Invalid MCP frame: missing Content-Length header");
        this.buffer = Buffer.alloc(0);
        return;
      }

      const frameLength = headerIndex + HEADER_DELIMITER.length + contentLength;
      if (this.buffer.length < frameLength) {
        return;
      }

      const body = this.buffer
        .slice(headerIndex + HEADER_DELIMITER.length, frameLength)
        .toString("utf8");

      this.buffer = this.buffer.slice(frameLength);

      try {
        const message = JSON.parse(body) as JsonRpcRequest;
        if (this.handler) {
          void this.handler(message).catch((error) => {
            console.error("MCP handler failed", error);
          });
        }
      } catch (error) {
        console.error("Failed to parse MCP message", error);
      }
    }
  }

  private parseContentLength(headerChunk: string): number | null {
    const lines = headerChunk.split(/\r?\n/);
    for (const line of lines) {
      const [name, value] = line.split(":");
      if (!name || !value) continue;
      if (name.trim().toLowerCase() === "content-length") {
        const length = Number.parseInt(value.trim(), 10);
        return Number.isFinite(length) ? length : null;
      }
    }
    return null;
  }
}

export interface McpServer {
  options: McpServerOptions;
  tools: Map<string, RegisteredTool>;
  registerTool: (tool: RegisteredTool) => void;
  start: () => Promise<void>;
  listen: () => Promise<void>;
}

class McpServerImpl implements McpServer {
  public readonly options: McpServerOptions;
  public readonly tools = new Map<string, RegisteredTool>();

  private readonly transport: JsonRpcStreamTransport;
  private initialized = false;
  private shutdownRequested = false;
  private started = false;

  constructor(options: McpServerOptions, streams?: TransportStreams) {
    this.options = options;
    this.transport = new JsonRpcStreamTransport(streams);
  }

  registerTool = (tool: RegisteredTool) => {
    this.tools.set(tool.name, tool);
  };

  start = async (): Promise<void> => {
    if (this.started) {
      return;
    }

    this.started = true;

    if (this.transport.isInteractive()) {
      this.printInteractiveNotice();
      return;
    }

    this.transport.listen(async (request) => {
      await this.handleRequest(request);
    });
  };

  listen = async (): Promise<void> => {
    await this.start();
  };

  private async handleRequest(request: JsonRpcRequest) {
    if (!request || typeof request.method !== "string" || request.jsonrpc !== JSONRPC_VERSION) {
      return;
    }

    const hasId = Object.prototype.hasOwnProperty.call(request, "id");
    const requestId = hasId ? request.id ?? null : undefined;

    try {
      const result = await this.routeRequest(request);
      if (hasId) {
        this.transport.send({ jsonrpc: JSONRPC_VERSION, id: requestId ?? null, result });
      }
    } catch (error) {
      if (!hasId) {
        console.error("Unhandled MCP notification error", error);
        return;
      }

      const rpcError: JsonRpcErrorShape =
        error instanceof McpError
          ? { code: error.code, message: error.message, data: error.data }
          : { code: -32603, message: "Internal server error" };

      this.transport.send({ jsonrpc: JSONRPC_VERSION, id: requestId ?? null, error: rpcError });
    }
  }

  private async routeRequest(request: JsonRpcRequest): Promise<unknown> {
    switch (request.method) {
      case "initialize":
        this.initialized = true;
        return this.handleInitialize();
      case "initialized":
        return {};
      case "shutdown":
        this.shutdownRequested = true;
        return {};
      case "exit":
        if (this.shutdownRequested) {
          process.exit(0);
        } else {
          process.exit(1);
        }
        return {};
      case "ping":
        return { ok: true };
      case "tools/list":
        this.ensureInitialized();
        return this.handleToolsList();
      case "tools/call":
        this.ensureInitialized();
        return await this.handleToolCall(request);
      case "resources/list":
        this.ensureInitialized();
        return { resources: [] };
      case "resources/read":
        this.ensureInitialized();
        return { contents: [] };
      default:
        throw new McpError(-32601, `Method not found: ${request.method}`);
    }
  }

  private handleInitialize() {
    return {
      serverInfo: {
        name: this.options.name,
        version: this.options.version,
      },
      capabilities: this.options.capabilities ?? {},
    };
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new McpError(-32002, "Server not initialized");
    }
  }

  private handleToolsList() {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }));

    return { tools };
  }

  private async handleToolCall(request: JsonRpcRequest) {
    const params = (request.params ?? {}) as Record<string, unknown>;
    const toolName = params.name;
    if (typeof toolName !== "string" || toolName.length === 0) {
      throw new McpError(-32602, "Tool name must be provided");
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new McpError(-32001, `Unknown tool: ${toolName}`);
    }

    const args = params.arguments ?? {};
    const requestId = request.id !== undefined && request.id !== null ? String(request.id) : randomUUID();

    const context: ToolContext = {
      requestId,
      now: () => new Date(),
      logger: this.createLogger(tool.name, requestId),
    };

    try {
      const output = await tool.handler(args, context);
      return {
        content: [
          {
            type: "application/json",
            data: output,
          },
        ],
      };
    } catch (error) {
      throw new McpError(-32002, `Tool execution failed for ${tool.name}`, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private createLogger(toolName: string, requestId: string) {
    return {
      info: (message: string, meta?: unknown) => {
        console.error(
          JSON.stringify({
            level: "info",
            tool: toolName,
            requestId,
            message,
            meta,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      error: (message: string, meta?: unknown) => {
        console.error(
          JSON.stringify({
            level: "error",
            tool: toolName,
            requestId,
            message,
            meta,
            timestamp: new Date().toISOString(),
          }),
        );
      },
    };
  }

  private printInteractiveNotice() {
    const { name, version } = this.options;
    const message = `${name} ${version} operates as an MCP server over stdio. Launch it via an MCP-compatible client.`;
    console.error(message);
  }
}

class McpError extends Error {
  constructor(public readonly code: number, message: string, public readonly data?: unknown) {
    super(message);
  }
}

export async function createMcpServer(
  options: McpServerOptions,
  streams?: TransportStreams,
): Promise<McpServer> {
  return new McpServerImpl(options, streams ?? {});
}
