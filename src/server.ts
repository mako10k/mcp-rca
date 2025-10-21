import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  connectToTransport,
  createMcpServer,
  createTransport,
  type McpServer,
  type ServerRequestExtra,
  type TransportStreams,
} from "./framework/mcpServerKit.js";
import { log } from "./logger.js";
import { LLMProviderManager } from "./llm/LLMProviderManager.js";
import { setSamplingServer } from "./llm/samplingClient.js";
import type { LLMRequestOptions, Message } from "./llm/LLMProvider.js";
import { caseCreateTool } from "./tools/case.js";
import { caseGetTool } from "./tools/case_get.js";
import { caseListTool } from "./tools/case_list.js";
import { caseUpdateTool } from "./tools/case_update.js";
import { conclusionTool } from "./tools/conclusion.js";
import { hypothesisProposeTool } from "./tools/hypothesis.js";
import { hypothesisUpdateTool } from "./tools/hypothesis_update.js";
import { hypothesisRemoveTool } from "./tools/hypothesis_remove.js";
import { hypothesisFinalizeTool } from "./tools/hypothesis_finalize.js";
import { observationAddTool } from "./tools/observation.js";
import { observationRemoveTool } from "./tools/observation_remove.js";
import { observationUpdateTool } from "./tools/observation_update.js";
import { prioritizeTool } from "./tools/prioritize.js";
import { testPlanTool } from "./tools/test_plan.js";
import { testPlanUpdateTool } from "./tools/test_plan_update.js";
import { testPlanRemoveTool } from "./tools/test_plan_remove.js";
import { bulkDeleteProvisionalTool } from "./tools/bulk_delete_provisional.js";
import type { ToolContext, ToolDefinition } from "./tools/types.js";

// Keep server version in sync with package.json
const require = createRequire(import.meta.url);
const { version: pkgVersion } = require("../package.json") as { version: string };
export const SERVER_VERSION = pkgVersion;

type CreateMessageRequest = z.infer<typeof CreateMessageRequestSchema>;

const TOOL_REGISTRY: Array<ToolDefinition<any, any>> = [
  caseCreateTool,
  caseGetTool,
  caseListTool,
  caseUpdateTool,
  observationAddTool,
  observationUpdateTool,
  observationRemoveTool,
  hypothesisProposeTool,
  hypothesisUpdateTool,
  hypothesisRemoveTool,
  hypothesisFinalizeTool,
  testPlanTool,
  testPlanUpdateTool,
  testPlanRemoveTool,
  prioritizeTool,
  bulkDeleteProvisionalTool,
  conclusionTool,
];

let samplingManager: LLMProviderManager | undefined;

export async function buildServer(streams?: TransportStreams) {
  log({
    level: "info",
    component: "server",
    message: "Building MCP RCA server",
    meta: {
      version: SERVER_VERSION,
      casesPathEnv: process.env.MCP_RCA_CASES_PATH || "(default)",
    },
  });

  const server = createMcpServer({
    name: "mcp-rca",
    version: SERVER_VERSION,
    title: "mcp-rca",
  });

  TOOL_REGISTRY.forEach((tool) => registerTool(server, tool));
  await registerDefaultResources(server);
  registerSamplingHandler(server);

  const transport = createTransport(streams);
  return { server, transport };
}

export async function start(streams?: TransportStreams) {
  const { server, transport } = await buildServer(streams);

  await connectToTransport(server, transport);
}

async function loadFirstAvailable(paths: string[]): Promise<{ path: string; text: string }> {
  const attempts: Array<{ path: string; error: unknown }> = [];

  for (const candidate of paths) {
    try {
      const text = await readFile(candidate, "utf8");
      return { path: candidate, text };
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code;
      attempts.push({ path: candidate, error: errno === "ENOENT" ? undefined : error });
      if (errno !== "ENOENT") {
        throw error;
      }
    }
  }

  const error = new Error(`Resource not found in any candidate paths: ${paths.join(", ")}`);
  (error as Error & { attempts?: Array<{ path: string; error: unknown }> }).attempts = attempts;
  throw error;
}

async function registerDefaultResources(server: McpServer) {
  const moduleDir = fileURLToPath(new URL("..", import.meta.url));
  const projectRoot = resolve(moduleDir, "..");

  const resources = [
    {
      uri: "doc://mcp-rca/README",
      name: "Project README",
      description: "High-level overview and setup instructions for mcp-rca.",
      mimeType: "text/markdown",
      candidates: [
        resolve(moduleDir, "README.md"),
        resolve(projectRoot, "README.md"),
      ],
    },
    {
      uri: "doc://mcp-rca/AGENT",
      name: "Agent Specification",
      description: "Detailed design goals and capabilities of the RCA MCP agent.",
      mimeType: "text/markdown",
      candidates: [
        resolve(moduleDir, "AGENT.md"),
        resolve(projectRoot, "AGENT.md"),
      ],
    },
    {
      uri: "doc://mcp-rca/prompts/hypothesis",
      name: "Hypothesis Prompt",
      description: "Prompt template used for generating RCA hypotheses.",
      mimeType: "text/markdown",
      candidates: [
        resolve(moduleDir, "src", "llm", "prompts", "hypothesis.md"),
        resolve(projectRoot, "src", "llm", "prompts", "hypothesis.md"),
        resolve(moduleDir, "dist", "llm", "prompts", "hypothesis.md"),
        resolve(projectRoot, "dist", "llm", "prompts", "hypothesis.md"),
      ],
    },
  ];

  await Promise.all(
    resources.map(async (resource) => {
      try {
        await loadFirstAvailable(resource.candidates);
        server.registerResource(
          resource.name,
          resource.uri,
          {
            description: resource.description,
            mimeType: resource.mimeType,
          },
          async () => {
            const { text } = await loadFirstAvailable(resource.candidates);
            return {
              contents: [
                {
                  uri: resource.uri,
                  mimeType: resource.mimeType,
                  text,
                },
              ],
            };
          },
        );
      } catch (error) {
        log({
          level: "error",
          component: "resources",
          message: `Failed to register resource ${resource.uri}`,
          meta: { error, attemptedPaths: resource.candidates },
        });
      }
    }),
  );
}

function registerSamplingHandler(server: McpServer) {
  const underlying = server.server;
  setSamplingServer(underlying);

  underlying.setRequestHandler(CreateMessageRequestSchema, async (request: CreateMessageRequest) => {
    const manager = getSamplingManager();
    const { messages, systemPrompt, maxTokens, temperature, stopSequences, modelPreferences } = request.params;

    if (messages.length === 0) {
      throw new Error("sampling/createMessage requires at least one message");
    }

    const conversation: Message[] = [];

    if (systemPrompt) {
      conversation.push({ role: "system", content: systemPrompt });
    }

    for (const message of messages) {
      if (message.content.type !== "text") {
        throw new Error("sampling/createMessage only supports text content");
      }

      conversation.push({ role: message.role, content: message.content.text });
    }

    const llmOptions: LLMRequestOptions = { maxTokens };

    if (typeof temperature === "number") {
      llmOptions.temperature = temperature;
    }

    if (Array.isArray(stopSequences) && stopSequences.length > 0) {
      llmOptions.stop = stopSequences;
    }

    const preferredModel = modelPreferences?.hints?.find((hint) =>
      typeof hint.name === "string" && hint.name.trim().length > 0,
    )?.name;

    if (preferredModel) {
      llmOptions.model = preferredModel;
    }

    try {
      const response = await manager.generateMessage(conversation, llmOptions);

      return {
        model: response.model,
        role: "assistant" as const,
        stopReason: "endTurn" as const,
        content: {
          type: "text" as const,
          text: response.content,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const providerUnavailable = /Provider '.+' not available/.test(errorMessage);
      const failureMessage = providerUnavailable
        ? "No LLM providers configured to handle sampling requests"
        : errorMessage;

      log({
        level: "error",
        component: "sampling",
        message: "sampling/createMessage failed",
        meta: { error: errorMessage },
      });

      throw new Error(failureMessage);
    }
  });
}

function getSamplingManager(): LLMProviderManager {
  if (!samplingManager) {
    const providerName = process.env.LLM_PROVIDER ?? "openai";
    if (providerName === "sampling") {
      throw new Error("LLM_PROVIDER 'sampling' cannot be used to service sampling/createMessage requests.");
    }

    samplingManager = new LLMProviderManager({
      defaultProvider: providerName,
      enableSamplingFallback: false,
    });
  }

  return samplingManager;
}

function registerTool(server: McpServer, tool: ToolDefinition) {
  const inputSchema = (tool.inputSchema as z.ZodObject<Record<string, z.ZodTypeAny>>).shape;
  const outputSchema = (tool.outputSchema as z.ZodObject<Record<string, z.ZodTypeAny>>).shape;

  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema,
      outputSchema,
    },
    async (args, extra) => {
      const context = createToolContext(tool.name, extra);
      const result = await tool.handler((args ?? {}) as unknown as Parameters<typeof tool.handler>[0], context);
      const structuredContent = result as Record<string, unknown>;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );
}

function createToolContext(toolName: string, extra?: ServerRequestExtra): ToolContext {
  const requestId = extra?.requestId !== undefined ? String(extra.requestId) : randomUUID();

  const logger = {
    info: (message: string, meta?: unknown) => {
      log({
        level: "info",
        component: `tool:${toolName}`,
        requestId,
        message,
        meta,
      });
    },
    error: (message: string, meta?: unknown) => {
      log({
        level: "error",
        component: `tool:${toolName}`,
        requestId,
        message,
        meta,
      });
    },
  };

  return {
    requestId,
    now: () => new Date(),
    logger,
  };
}
