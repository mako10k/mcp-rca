import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PassThrough } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "../src/server.js";
import * as mcpServerKit from "../src/framework/mcpServerKit.js";

// Helper functions from server.test.ts
function sendMessage(stream: PassThrough, message: unknown) {
  stream.write(JSON.stringify(message) + "\n");
}

async function issueRequest(
  output: PassThrough,
  input: PassThrough,
  request: { id: number; method: string; params: unknown },
) {
  const responsePromise = new Promise((resolve) => {
    output.once("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      resolve(JSON.parse(lines[lines.length - 1]));
    });
  });

  sendMessage(input, { jsonrpc: "2.0", ...request });
  return responsePromise as Promise<{ result: { prompts: Array<{ name: string }> } }>;
}

describe("prompts", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "mcp-rca-prompts-tests-"));
    process.env.MCP_RCA_CASES_PATH = join(tmpDir, "cases.json");
  });

  afterEach(async () => {
    delete process.env.MCP_RCA_CASES_PATH;
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("lists prompts and can call them", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    const { server, transport } = await buildServer({ input, output });
    await mcpServerKit.connectToTransport(server, transport);

    // Initialize
    await issueRequest(output, input, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "TestClient", version: "0.0.1" },
        capabilities: {},
      },
    });

    sendMessage(input, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });

    // List prompts
    const promptList = await issueRequest(output, input, {
      id: 2,
      method: "prompts/list",
      params: {},
    });

    expect(promptList.result.prompts).toBeDefined();
    expect(promptList.result.prompts.length).toBeGreaterThan(0);

    // Check that our prompts are registered
    const promptNames = promptList.result.prompts.map((p: { name: string }) => p.name);
    expect(promptNames).toContain("rca_start_investigation");
    expect(promptNames).toContain("rca_next_step");
    expect(promptNames).toContain("rca_hypothesis_propose");
  });

  it("rca_start_investigation returns a message", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    const { server, transport } = await buildServer({ input, output });
    await mcpServerKit.connectToTransport(server, transport);

    await issueRequest(output, input, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "TestClient", version: "0.0.1" },
        capabilities: {},
      },
    });

    sendMessage(input, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

    const result = (await issueRequest(output, input, {
      id: 2,
      method: "prompts/get",
      params: {
        name: "rca_start_investigation",
        arguments: {},
      },
    })) as unknown as { result: { messages: Array<{ role: string; content: { type: string; text: string } }> } };

    expect(result.result.messages).toBeDefined();
    expect(result.result.messages.length).toBeGreaterThan(0);
    expect(result.result.messages[0].role).toBe("user");
    expect(result.result.messages[0].content.type).toBe("text");

    const text = result.result.messages[0].content.text;
    expect(text).toContain("Root Cause Analysis");
    expect(text).toContain("case_create");
    expect(text).toContain("observation_add");
  });

  it("rca_start_investigation accepts incidentSummary argument", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    const { server, transport } = await buildServer({ input, output });
    await mcpServerKit.connectToTransport(server, transport);

    await issueRequest(output, input, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "TestClient", version: "0.0.1" },
        capabilities: {},
      },
    });

    sendMessage(input, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

    const result = (await issueRequest(output, input, {
      id: 2,
      method: "prompts/get",
      params: {
        name: "rca_start_investigation",
        arguments: {
          incidentSummary: "API returning 500 errors",
        },
      },
    })) as unknown as { result: { messages: Array<{ content: { text: string } }> } };

    expect(result.result.messages).toBeDefined();
    const text = result.result.messages[0].content.text;
    expect(text).toContain("API returning 500 errors");
  });

  it("rca_next_step requires caseId and analyzes case state", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    const { server, transport } = await buildServer({ input, output });
    await mcpServerKit.connectToTransport(server, transport);

    await issueRequest(output, input, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "TestClient", version: "0.0.1" },
        capabilities: {},
      },
    });

    sendMessage(input, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

    // First create a case
    const createResult = (await issueRequest(output, input, {
      id: 2,
      method: "tools/call",
      params: {
        name: "case_create",
        arguments: {
          title: "Test case",
          severity: "SEV2",
        },
      },
    })) as unknown as { result: { structuredContent: { caseId: string } } };

    const caseId = createResult.result.structuredContent.caseId;

    // Now call the prompt
    const result = (await issueRequest(output, input, {
      id: 3,
      method: "prompts/get",
      params: {
        name: "rca_next_step",
        arguments: { caseId },
      },
    })) as unknown as { result: { messages: Array<{ content: { text: string } }> } };

    expect(result.result.messages).toBeDefined();
    const text = result.result.messages[0].content.text;
    expect(text).toContain("Case Progress Analysis");
    expect(text).toContain(caseId);
    expect(text).toContain("Current Phase");
    expect(text).toContain("Recommended Next Actions");
  });

  it("rca_hypothesis_propose generates guidance with observations", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    const { server, transport } = await buildServer({ input, output });
    await mcpServerKit.connectToTransport(server, transport);

    await issueRequest(output, input, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "TestClient", version: "0.0.1" },
        capabilities: {},
      },
    });

    sendMessage(input, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

    // Create a case with observations
    const createResult = (await issueRequest(output, input, {
      id: 2,
      method: "tools/call",
      params: {
        name: "case_create",
        arguments: {
          title: "Test case",
          severity: "SEV2",
        },
      },
    })) as unknown as { result: { structuredContent: { caseId: string } } };

    const caseId = createResult.result.structuredContent.caseId;

    await issueRequest(output, input, {
      id: 3,
      method: "tools/call",
      params: {
        name: "observation_add",
        arguments: {
          caseId,
          what: "CPU usage spiked to 95%",
        },
      },
    });

    await issueRequest(output, input, {
      id: 4,
      method: "tools/call",
      params: {
        name: "observation_add",
        arguments: {
          caseId,
          what: "Memory usage increased gradually over 2 hours",
        },
      },
    });

    // Call the hypothesis guide prompt
    const result = (await issueRequest(output, input, {
      id: 5,
      method: "prompts/get",
      params: {
        name: "rca_hypothesis_propose",
        arguments: { caseId },
      },
    })) as unknown as { result: { messages: Array<{ content: { text: string } }> } };

    expect(result.result.messages).toBeDefined();
    const text = result.result.messages[0].content.text;
    expect(text).toContain("Hypothesis Generation Guide");
    expect(text).toContain("CPU usage spiked to 95%");
    expect(text).toContain("Memory usage increased");
    expect(text).toContain("hypothesis_propose");
  });
});
