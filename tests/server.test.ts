import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { PrioritizeInput, PrioritizeOutput } from "../src/tools/prioritize.js";
import type { ToolDefinition } from "../src/tools/types.js";

describe("buildServer", () => {
  it("registers core tools with the MCP server stub", async () => {
    const server = await buildServer({ input: new PassThrough(), output: new PassThrough() });
    const toolNames = Array.from(server.tools.keys());

    expect(toolNames).toEqual([
      "hypothesis/propose",
      "test/plan",
      "test/prioritize",
      "conclusion/finalize",
    ]);

    const prioritizeTool = server.tools.get(
      "test/prioritize",
    ) as ToolDefinition<PrioritizeInput, PrioritizeOutput> | undefined;
    expect(prioritizeTool).toBeDefined();

    const input: PrioritizeInput = {
      strategy: "RICE",
      items: [
        { id: "a", reach: 10, impact: 2, confidence: 0.5, effort: 5 },
        { id: "b", reach: 30, impact: 5, confidence: 0.9, effort: 8 },
        { id: "c", reach: 5, impact: 3, confidence: 0.7, effort: 2 },
      ],
    };

    const output = await prioritizeTool!.handler(input, {
      requestId: "test",
      now: () => new Date(),
    });
    expect(output.ranked).toHaveLength(3);
    expect(output.ranked[0].rank).toBe(1);
    expect(output.ranked[0].score).toBeGreaterThan(output.ranked[1].score);
  });

  it("start() resolves successfully via the MCP server stub", async () => {
    const server = await buildServer({ input: new PassThrough(), output: new PassThrough() });
    await expect(server.start()).resolves.toBeUndefined();
  });

  it("prints a notice and exits immediately when stdin is a TTY", async () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean };
    input.isTTY = true;
    const output = new PassThrough();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const server = await buildServer({ input, output });
    await expect(server.start()).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("mcp-rca 0.1.0 operates as an MCP server"),
    );

    consoleSpy.mockRestore();
  });

  it("responds to initialize, tools/list, and tools/call requests", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = await buildServer({ input, output });
    await server.start();

    const initializeResponsePromise = readResponse(output);
    sendMessage(input, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const initializeResponse = await initializeResponsePromise;

    expect(initializeResponse.result.serverInfo).toEqual({ name: "mcp-rca", version: "0.1.0" });

    const toolsListResponsePromise = readResponse(output);
    sendMessage(input, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const toolsListResponse = await toolsListResponsePromise;

    expect(Array.isArray(toolsListResponse.result.tools)).toBe(true);
    expect(toolsListResponse.result.tools).toContainEqual(
      expect.objectContaining({ name: "test/prioritize" }),
    );

    const toolCallResponsePromise = readResponse(output);
    const prioritizeInput: PrioritizeInput = {
      strategy: "RICE",
      items: [
        { id: "x", reach: 10, impact: 5, confidence: 0.9, effort: 2 },
        { id: "y", reach: 5, impact: 4, confidence: 0.7, effort: 1 },
      ],
    };

    sendMessage(input, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "test/prioritize", arguments: prioritizeInput },
    });

    const toolCallResponse = await toolCallResponsePromise;
    expect(toolCallResponse.result.content).toHaveLength(1);
    expect(toolCallResponse.result.content[0].type).toBe("application/json");
    expect(toolCallResponse.result.content[0].data.ranked[0].rank).toBe(1);

    input.end();
    output.end();
  });
});

function sendMessage(stream: PassThrough, message: unknown) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`);
  stream.write(header);
  stream.write(payload);
}

async function readResponse(stream: PassThrough): Promise<any> {
  let buffer = Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const delimiterIndex = buffer.indexOf(Buffer.from("\r\n\r\n"));
      if (delimiterIndex === -1) {
        return;
      }

      const header = buffer.slice(0, delimiterIndex).toString("utf8");
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
      if (!lengthMatch) {
        stream.off("data", onData);
        reject(new Error("Missing Content-Length header"));
        return;
      }

      const length = Number.parseInt(lengthMatch[1], 10);
      const frameEnd = delimiterIndex + 4 + length;
      if (buffer.length < frameEnd) {
        return;
      }

      const body = buffer.slice(delimiterIndex + 4, frameEnd).toString("utf8");
      buffer = buffer.slice(frameEnd);
      stream.off("data", onData);
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    };

    stream.on("data", onData);
  });
}
