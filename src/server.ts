import { randomUUID } from "node:crypto";
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
import { observationAddTool } from "./tools/observation.js";
import { observationRemoveTool } from "./tools/observation_remove.js";
import { observationUpdateTool } from "./tools/observation_update.js";
import { prioritizeTool } from "./tools/prioritize.js";
import { testPlanTool } from "./tools/test_plan.js";
import type { ToolContext, ToolDefinition } from "./tools/types.js";

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
  testPlanTool,
  prioritizeTool,
  conclusionTool,
];

let samplingManager: LLMProviderManager | undefined;

export async function buildServer(streams?: TransportStreams) {
  const server = createMcpServer({
    name: "mcp-rca",
    version: "0.1.0",
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
  const input = streams?.input ?? process.stdin;

  if ((input as NodeJS.ReadStream).isTTY) {
    console.error("mcp-rca 0.1.0 operates as an MCP server over stdio. Launch it via an MCP-compatible client.");
    return;
  }

  await connectToTransport(server, transport);
}

async function registerDefaultResources(server: McpServer) {
  const rootDir = fileURLToPath(new URL("..", import.meta.url));

  const resources = [
    {
      uri: "doc://mcp-rca/README",
      name: "Project README",
      description: "High-level overview and setup instructions for mcp-rca.",
      path: resolve(rootDir, "README.md"),
      mimeType: "text/markdown",
    },
    {
      uri: "doc://mcp-rca/AGENT",
      name: "Agent Specification",
      description: "Detailed design goals and capabilities of the RCA MCP agent.",
      path: resolve(rootDir, "AGENT.md"),
      mimeType: "text/markdown",
    },
    {
      uri: "doc://mcp-rca/prompts/hypothesis",
      name: "Hypothesis Prompt",
      description: "Prompt template used for generating RCA hypotheses.",
      path: resolve(rootDir, "src", "llm", "prompts", "hypothesis.md"),
      mimeType: "text/markdown",
    },
  ];

  await Promise.all(
    resources.map(async (resource) => {
      try {
        await readFile(resource.path, "utf8");
        server.registerResource(
          resource.name,
          resource.uri,
          {
            description: resource.description,
            mimeType: resource.mimeType,
          },
          async () => ({
            contents: [
              {
                uri: resource.uri,
                mimeType: resource.mimeType,
                text: await readFile(resource.path, "utf8"),
              },
            ],
          }),
        );
      } catch (error) {
        console.error(`Failed to register resource ${resource.uri}`, error);
      }
    }),
  );
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  start().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start mcp-rca server", error);
    process.exit(1);
  });
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
