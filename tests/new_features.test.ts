import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { LLMProviderManager } from "../src/llm/LLMProviderManager.js";
import { buildServer } from "../src/server.js";
import * as mcpServerKit from "../src/framework/mcpServerKit.js";

describe("new features", () => {
  it("hypothesis_propose returns IDs and creates a test plan when provided", async () => {
    const oldPath = process.env.MCP_RCA_CASES_PATH;
    const tempCasesDir = mkdtempSync(join(tmpdir(), "mcp-rca-new-"));
    const tempCasesPath = join(tempCasesDir, "cases.json");
    process.env.MCP_RCA_CASES_PATH = tempCasesPath;

    const input = new PassThrough();
    const output = new PassThrough();
    const { server, transport } = await buildServer({ input, output });

    try {
  await mcpServerKit.connectToTransport(server, transport);
  await connectAndInit(output, input);

      // Create a case
      const caseCreate = await issueRequest(output, input, {
        id: 1,
        method: "tools/call",
        params: {
          name: "case_create",
          arguments: { title: "Test incident", severity: "SEV2" },
        },
      });
      const caseId = caseCreate.result.structuredContent.caseId as string;
      expect(caseId).toMatch(/^case_/);

      // Stub LLM so hypothesis generator returns deterministic content
      const llmSpy = vi
        .spyOn(LLMProviderManager.prototype, "generateMessage")
        .mockResolvedValue({
          content: JSON.stringify([
            {
              text: "Cache miss spike",
              rationale: "Upstream eviction policy changed",
              testPlan: { method: "Inspect cache stats", expected: "High miss ratio", metric: "cache_miss" },
            },
          ]),
          model: "unit-llm",
        });

      const propose = await issueRequest(output, input, {
        id: 2,
        method: "tools/call",
        params: {
          name: "hypothesis_propose",
          arguments: { caseId, text: "Latency increased" },
        },
      });

      llmSpy.mockRestore();

      const proposed = propose.result.structuredContent.hypotheses as Array<any>;
      expect(Array.isArray(proposed)).toBe(true);
      expect(proposed.length).toBe(1);
      expect(proposed[0].id).toMatch(/^hyp_/);
      expect(proposed[0].caseId).toBe(caseId);
      expect(typeof proposed[0].createdAt).toBe("string");
      expect(typeof proposed[0].updatedAt).toBe("string");
      // Initial test plan is created from generator output
      expect(proposed[0].testPlan).toBeDefined();
      expect(proposed[0].testPlan.id).toMatch(/^tp_/);
      expect(proposed[0].testPlan.hypothesisId).toBe(proposed[0].id);
      expect(proposed[0].testPlan.method).toBe("Inspect cache stats");
    } finally {
      await server.close();
      await transport.close();
      if (oldPath === undefined) delete process.env.MCP_RCA_CASES_PATH; else process.env.MCP_RCA_CASES_PATH = oldPath;
    }
  });

  it("persists and updates git/deploy metadata on Case/Observation/TestPlan", async () => {
    const oldPath = process.env.MCP_RCA_CASES_PATH;
    const tempCasesDir = mkdtempSync(join(tmpdir(), "mcp-rca-new-"));
    const tempCasesPath = join(tempCasesDir, "cases.json");
    process.env.MCP_RCA_CASES_PATH = tempCasesPath;

    const input = new PassThrough();
    const output = new PassThrough();
    const { server, transport } = await buildServer({ input, output });

    try {
  await mcpServerKit.connectToTransport(server, transport);
  await connectAndInit(output, input);

      // Create case with metadata
      const caseCreate = await issueRequest(output, input, {
        id: 10,
        method: "tools/call",
        params: {
          name: "case_create",
          arguments: { title: "Meta case", severity: "SEV3", gitBranch: "feat/x", gitCommit: "abc123", deployEnv: "staging" },
        },
      });
      const createdCase = caseCreate.result.structuredContent.case as any;
      const caseId = createdCase.id as string;
      expect(createdCase.gitBranch).toBe("feat/x");
      expect(createdCase.gitCommit).toBe("abc123");
      expect(createdCase.deployEnv).toBe("staging");

      // Add observation with metadata
      const observationAdd = await issueRequest(output, input, {
        id: 11,
        method: "tools/call",
        params: {
          name: "observation_add",
          arguments: { caseId, what: "Spike seen", gitBranch: "feat/x", gitCommit: "abc123", deployEnv: "staging" },
        },
      });
      const obs = observationAdd.result.structuredContent.observation as any;
      expect(obs.gitBranch).toBe("feat/x");
      expect(obs.gitCommit).toBe("abc123");
      expect(obs.deployEnv).toBe("staging");

      // Clear observation gitCommit via update (nullable)
      const observationUpdate = await issueRequest(output, input, {
        id: 12,
        method: "tools/call",
        params: {
          name: "observation_update",
          arguments: { caseId, observationId: obs.id, gitCommit: null },
        },
      });
      const updatedObs = observationUpdate.result.structuredContent.observation as any;
      expect(Object.prototype.hasOwnProperty.call(updatedObs, "gitCommit")).toBe(false);

      // Create test plan with metadata
      // First, need a hypothesis to attach
      const llmSpy = vi
        .spyOn(LLMProviderManager.prototype, "generateMessage")
        .mockResolvedValue({
          content: JSON.stringify([{ text: "IO saturation", rationale: "Disk ops high" }]),
          model: "unit-llm",
        });
      const propose = await issueRequest(output, input, {
        id: 13,
        method: "tools/call",
        params: { name: "hypothesis_propose", arguments: { caseId, text: "Errors up" } },
      });
      llmSpy.mockRestore();
      const hypId = (propose.result.structuredContent.hypotheses as any[])[0].id as string;

      const testPlanCreate = await issueRequest(output, input, {
        id: 14,
        method: "tools/call",
        params: {
          name: "test_plan",
          arguments: { caseId, hypothesisId: hypId, method: "Run fio", expected: "High iops", gitBranch: "feat/x", gitCommit: "abc123", deployEnv: "staging" },
        },
      });
      const testPlanId = testPlanCreate.result.structuredContent.testPlanId as string;
      expect(testPlanId).toMatch(/^tp_/);

      // Update test plan: change deployEnv and clear gitBranch
      const testPlanUpdate = await issueRequest(output, input, {
        id: 15,
        method: "tools/call",
        params: {
          name: "test_plan_update",
          arguments: { caseId, testPlanId, deployEnv: "prod", gitBranch: null },
        },
      });
      const updatedPlan = testPlanUpdate.result.structuredContent.testPlan as any;
      expect(updatedPlan.deployEnv).toBe("prod");
      expect(Object.prototype.hasOwnProperty.call(updatedPlan, "gitBranch")).toBe(false);

      // Clear case-level metadata
      const caseUpdate = await issueRequest(output, input, {
        id: 16,
        method: "tools/call",
        params: { name: "case_update", arguments: { caseId, gitBranch: null, gitCommit: null, deployEnv: null } },
      });
      const updatedCase = caseUpdate.result.structuredContent.case as any;
      expect(Object.prototype.hasOwnProperty.call(updatedCase, "gitBranch")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(updatedCase, "gitCommit")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(updatedCase, "deployEnv")).toBe(false);
    } finally {
      await server.close();
      await transport.close();
      if (oldPath === undefined) delete process.env.MCP_RCA_CASES_PATH; else process.env.MCP_RCA_CASES_PATH = oldPath;
    }
  });
});

async function connectAndInit(output: PassThrough, input: PassThrough) {
  const initializeResponse = await issueRequest(output, input, {
    id: 100,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      clientInfo: { name: "TestClient", version: "0.0.1" },
      capabilities: {},
    },
  });
  expect(initializeResponse.result.serverInfo.name).toBe("mcp-rca");
  // notifications/initialized
  sendMessage(input, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
}

async function issueRequest(
  output: PassThrough,
  input: PassThrough,
  request: { id: number; method: string; params: Record<string, unknown> },
) {
  const responsePromise = readResponse(output);
  sendMessage(input, { jsonrpc: "2.0", ...request });
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
      if (newlineIndex === -1) return;
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      const remainder = buffer.slice(newlineIndex + 1);
      buffer = "";
      stream.off("data", onData);
      if (remainder) stream.unshift(Buffer.from(remainder, "utf8"));
      try {
        resolve(JSON.parse(line));
      } catch (error) {
        reject(error);
      }
    };
    stream.on("data", onData);
  });
}
