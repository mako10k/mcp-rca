import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import * as mcpServerKit from "../src/framework/mcpServerKit.js";
import { LLMProviderManager } from "../src/llm/LLMProviderManager.js";
import { buildServer, start } from "../src/server.js";
import type { PrioritizeInput } from "../src/tools/prioritize.js";

const tempCasesDir = mkdtempSync(join(tmpdir(), "mcp-rca-tests-"));
const tempCasesPath = join(tempCasesDir, "cases.json");
process.env.MCP_RCA_CASES_PATH = tempCasesPath;

describe("mcp server", () => {
  it("lists resources and tools and can service tool calls", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
  const { server, transport } = await buildServer({ input, output });
  await mcpServerKit.connectToTransport(server, transport);

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
  version: "0.1.1",
    });
    expect(initializeResponse.result.protocolVersion).toBe("2025-06-18");
    expect(initializeResponse.result.capabilities.sampling).toEqual({});

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
      expect.arrayContaining([
        expect.objectContaining({ name: "case_create" }),
        expect.objectContaining({ name: "test_prioritize" }),
      ]),
    );

    const caseCreateResponse = await issueRequest(output, input, {
      id: 3,
      method: "tools/call",
      params: {
  name: "case_create",
        arguments: {
          title: "Database outage",
          severity: "SEV2",
          tags: ["database", "backend"],
        },
      },
    });

    expect(caseCreateResponse.result.structuredContent.caseId).toMatch(/^case_/);
    expect(caseCreateResponse.result.structuredContent.case.title).toBe("Database outage");
    const createdCaseId = caseCreateResponse.result.structuredContent.caseId;

    const observationResponse = await issueRequest(output, input, {
      id: 4,
      method: "tools/call",
      params: {
        name: "observation_add",
        arguments: {
          caseId: createdCaseId,
          what: "Error budget burn detected",
          context: "Latency dashboards spiked at 09:05 UTC",
        },
      },
    });

    expect(observationResponse.result.structuredContent.observation.what).toContain("Error budget burn");
    expect(observationResponse.result.structuredContent.case.observations).toHaveLength(1);
    expect(observationResponse.result.structuredContent.case.observations[0].caseId).toBe(createdCaseId);
    const createdObservationId = observationResponse.result.structuredContent.observation.id;

    const observationUpdateRequest = {
      id: 5,
      method: "tools/call",
      params: {
        name: "observation_update",
        arguments: {
          caseId: createdCaseId,
          observationId: createdObservationId,
          context: "Updated context after SLO review",
        },
      },
    } as const;

    const observationUpdateResponse = await issueRequest(output, input, observationUpdateRequest);

    expect(observationUpdateResponse.error).toBeUndefined();
    expect(observationUpdateResponse.result.structuredContent.observation.context).toBe(
      "Updated context after SLO review",
    );

    const caseGetResponse = await issueRequest(output, input, {
      id: 6,
      method: "tools/call",
      params: {
        name: "case_get",
        arguments: {
          caseId: createdCaseId,
          include: ["observations"],
          observationLimit: 1,
        },
      },
    });

    expect(caseGetResponse.result.structuredContent.case.id).toBe(createdCaseId);
    expect(caseGetResponse.result.structuredContent.case.observations).toHaveLength(1);
    expect(caseGetResponse.result.structuredContent.case.observations[0].context).toBe(
      "Updated context after SLO review",
    );
    expect(caseGetResponse.result.structuredContent.cursors).toBeUndefined();

    const observationRemoveResponse = await issueRequest(output, input, {
      id: 7,
      method: "tools/call",
      params: {
        name: "observation_remove",
        arguments: {
          caseId: createdCaseId,
          observationId: createdObservationId,
        },
      },
    });

    expect(observationRemoveResponse.result.structuredContent.observation.id).toBe(createdObservationId);
    expect(observationRemoveResponse.result.structuredContent.case.observations).toHaveLength(0);

    const caseListResponse = await issueRequest(output, input, {
      id: 8,
      method: "tools/call",
      params: {
        name: "case_list",
        arguments: {
          query: "Database",
        },
      },
    });

    expect(caseListResponse.result.structuredContent.cases).toHaveLength(1);
    expect(caseListResponse.result.structuredContent.cases[0].id).toBe(createdCaseId);
    expect(caseListResponse.result.structuredContent.total).toBeGreaterThanOrEqual(1);
    expect(caseListResponse.result.structuredContent.cases[0].observationCount).toBe(0);

    const caseUpdateResponse = await issueRequest(output, input, {
      id: 9,
      method: "tools/call",
      params: {
        name: "case_update",
        arguments: {
          caseId: createdCaseId,
          severity: "SEV1",
          status: "archived",
        },
      },
    });

  expect(caseUpdateResponse.error).toBeUndefined();
  expect(caseUpdateResponse.result.structuredContent.case.status).toBe("archived");
    expect(caseUpdateResponse.result.structuredContent.case.severity).toBe("SEV1");

    const archivedListResponse = await issueRequest(output, input, {
      id: 10,
      method: "tools/call",
      params: {
        name: "case_list",
        arguments: {},
      },
    });

    expect(archivedListResponse.result.structuredContent.cases).toHaveLength(0);

    const includeArchivedResponse = await issueRequest(output, input, {
      id: 11,
      method: "tools/call",
      params: {
        name: "case_list",
        arguments: {
          includeArchived: true,
        },
      },
    });

    expect(includeArchivedResponse.result.structuredContent.cases).toHaveLength(1);
    expect(includeArchivedResponse.result.structuredContent.cases[0].status).toBe("archived");

    const prioritizeInput: PrioritizeInput = {
      strategy: "RICE",
      items: [
        { id: "x", reach: 10, impact: 5, confidence: 0.9, effort: 2 },
        { id: "y", reach: 5, impact: 4, confidence: 0.7, effort: 1 },
      ],
    };

    const toolCallResponse = await issueRequest(output, input, {
      id: 12,
      method: "tools/call",
      params: { name: "test_prioritize", arguments: prioritizeInput },
    });

    expect(toolCallResponse.result.structuredContent).toBeDefined();
    expect(toolCallResponse.result.structuredContent.ranked[0].rank).toBe(1);

    const originalProvider = process.env.LLM_PROVIDER;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    const llmSpy = vi
      .spyOn(LLMProviderManager.prototype, "generateMessage")
      .mockResolvedValue({ content: "Stub response", model: "test-model" });

    const samplingResponse = await issueRequest(output, input, {
      id: 15,
      method: "sampling/createMessage",
      params: {
        messages: [
          { role: "user", content: { type: "text", text: "Hello" } },
        ],
        maxTokens: 16,
      },
    });

    expect(samplingResponse.error).toBeUndefined();
    expect(samplingResponse.result).toEqual({
      model: "test-model",
      role: "assistant",
      stopReason: "endTurn",
      content: { type: "text", text: "Stub response" },
    });

    llmSpy.mockRestore();
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }

    const resourcesListResponse = await issueRequest(output, input, {
      id: 13,
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
      id: 14,
      method: "resources/read",
      params: { uri: "doc://mcp-rca/README" },
    });

    expect(resourceReadResponse.result.contents).toHaveLength(1);
    expect(resourceReadResponse.result.contents[0].text).toContain("# mcp-rca");

    expect(createdCaseId).toBeDefined();

    await server.close();
    await transport.close();
  });

  it("supports starting even when stdin is a TTY", async () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean };
    input.isTTY = true;
    const output = new PassThrough();
    const connectSpy = vi
      .spyOn(mcpServerKit, "connectToTransport")
      .mockResolvedValue();

    await expect(start({ input, output })).resolves.toBeUndefined();

    expect(connectSpy).toHaveBeenCalled();

    connectSpy.mockRestore();
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
