import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import * as mcpServerKit from "../src/framework/mcpServerKit.js";
import { buildServer } from "../src/server.js";

const tempCasesDir = mkdtempSync(join(tmpdir(), "mcp-rca-guidance-tests-"));
const tempCasesPath = join(tempCasesDir, "cases.json");
process.env.MCP_RCA_CASES_PATH = tempCasesPath;

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

describe("guidance tools", () => {
  it("lists guidance tools and returns phase guidance", async () => {
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

    const names = toolsListResponse.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      "guidance_phase",
      "guidance_best_practices",
      "guidance_prompt_scaffold",
      "guidance_followups",
      "guidance_prompts_catalog",
    ]));

    const phaseResponse = await issueRequest(output, input, {
      id: 3,
      method: "tools/call",
      params: {
        name: "guidance_phase",
        arguments: { phase: "testing" },
      },
    });

    expect(phaseResponse.error).toBeUndefined();
    expect(phaseResponse.result.structuredContent.steps.length).toBeGreaterThan(0);
    expect(phaseResponse.result.structuredContent.toolHints).toEqual(
      expect.arrayContaining(["test_plan"]),
    );

    const catalogResponse = await issueRequest(output, input, {
      id: 4,
      method: "tools/call",
      params: {
        name: "guidance_prompts_catalog",
        arguments: {},
      },
    });

    expect(catalogResponse.error).toBeUndefined();
    const promptNames = catalogResponse.result.structuredContent.prompts.map((p: any) => p.name);
    expect(promptNames).toEqual(expect.arrayContaining([
      "rca_next_step",
      "rca_hypothesis_propose",
    ]));

    await server.close();
    await transport.close();
  });
});
