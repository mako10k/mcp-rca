import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { connectToTransport } from "../src/framework/mcpServerKit.js";
import { buildServer, start } from "../src/server.js";
import type { PrioritizeInput } from "../src/tools/prioritize.js";

describe("mcp server", () => {
  it("lists resources and tools and can service tool calls", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const { server, transport } = await buildServer({ input, output });
    await connectToTransport(server, transport);

    const initializeResponse = await issueRequest(output, input, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "TestClient", version: "0.0.1" },
        capabilities: {},
      },
    });

    expect(initializeResponse.result.serverInfo).toEqual({
      name: "mcp-rca",
      title: "mcp-rca",
      version: "0.1.0",
    });
    expect(initializeResponse.result.protocolVersion).toBe("2025-06-18");

    sendMessage(input, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });

    const toolsListResponse = await issueRequest(output, input, {
      id: 2,
      method: "tools/list",
      params: {},
    });

    expect(Array.isArray(toolsListResponse.result.tools)).toBe(true);
    expect(toolsListResponse.result.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "test/prioritize" })]),
    );

    const prioritizeInput: PrioritizeInput = {
      strategy: "RICE",
      items: [
        { id: "x", reach: 10, impact: 5, confidence: 0.9, effort: 2 },
        { id: "y", reach: 5, impact: 4, confidence: 0.7, effort: 1 },
      ],
    };

    const toolCallResponse = await issueRequest(output, input, {
      id: 3,
      method: "tools/call",
      params: { name: "test/prioritize", arguments: prioritizeInput },
    });

    expect(toolCallResponse.result.structuredContent).toBeDefined();
    expect(toolCallResponse.result.structuredContent.ranked[0].rank).toBe(1);

    const resourcesListResponse = await issueRequest(output, input, {
      id: 4,
      method: "resources/list",
      params: {},
    });

    expect(Array.isArray(resourcesListResponse.result.resources)).toBe(true);
    expect(
      resourcesListResponse.result.resources.some(
        (resource: { uri: string }) => resource.uri === "doc://mcp-rca/README",
      ),
    ).toBe(true);

    const resourceReadResponse = await issueRequest(output, input, {
      id: 5,
      method: "resources/read",
      params: { uri: "doc://mcp-rca/README" },
    });

    expect(resourceReadResponse.result.contents).toHaveLength(1);
    expect(resourceReadResponse.result.contents[0].text).toContain("# mcp-rca");

    await server.close();
    await transport.close();
  });

  it("prints a notice and returns when stdin is a TTY", async () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean };
    input.isTTY = true;
    const output = new PassThrough();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(start({ input, output })).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("mcp-rca 0.1.0 operates as an MCP server"),
    );

    consoleSpy.mockRestore();
  });
});

async function issueRequest(
  output: PassThrough,
  input: PassThrough,
  request: {
    id: number;
    method: string;
    params: Record<string, unknown>;
  },
) {
  const responsePromise = readResponse(output);
  sendMessage(input, {
    jsonrpc: "2.0",
    ...request,
  });
  return responsePromise;
}

function sendMessage(stream: PassThrough, message: unknown) {
  stream.write(`${JSON.stringify(message)}\n`);
}

async function readResponse(stream: PassThrough): Promise<any> {
  let buffer = "";

  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      const remainder = buffer.slice(newlineIndex + 1);
      buffer = "";
      stream.off("data", onData);
      if (remainder) {
        stream.unshift(Buffer.from(remainder, "utf8"));
      }
      try {
        resolve(JSON.parse(line));
      } catch (error) {
        reject(error);
      }
    };

    stream.on("data", onData);
  });
}
