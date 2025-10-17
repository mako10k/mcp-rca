import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { LLMRequestOptions, LLMResponse, Message } from "./LLMProvider.js";

let samplingServer: Server | undefined;

export function setSamplingServer(server: Server): void {
  samplingServer = server;
}

export function clearSamplingServer(): void {
  samplingServer = undefined;
}

function requireSamplingServer(): Server {
  if (!samplingServer) {
    throw new Error("MCP sampling server connection is not configured");
  }
  return samplingServer;
}

export async function requestSamplingCompletion(
  messages: Message[],
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const server = requireSamplingServer();
  const systemMessages = messages.filter((message) => message.role === "system");
  const conversationalMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: { type: "text" as const, text: message.content },
    }));

  if (conversationalMessages.length === 0) {
    throw new Error("sampling/createMessage requires at least one user or assistant message");
  }

  const systemPrompt = systemMessages.length > 0
    ? systemMessages.map((message) => message.content).join("\n\n")
    : undefined;

  const request: Record<string, unknown> = {
    messages: conversationalMessages,
  };

  if (systemPrompt) {
    request.systemPrompt = systemPrompt;
  }

  if (typeof options.maxTokens === "number") {
    request.maxTokens = options.maxTokens;
  }

  if (typeof options.temperature === "number") {
    request.temperature = options.temperature;
  }

  if (Array.isArray(options.stop) && options.stop.length > 0) {
    request.stopSequences = options.stop;
  }

  if (typeof options.model === "string" && options.model.trim().length > 0) {
    request.modelPreferences = {
      hints: [{ name: options.model.trim() }],
    };
  }

  const result = await server.createMessage(
    request as Parameters<typeof server.createMessage>[0]
  );

  const content = result?.content;
  if (!content || content.type !== "text" || typeof content.text !== "string") {
    throw new Error("MCP sampling response did not include text content");
  }

  const usageRaw = result?.usage;
  const usage =
    usageRaw && typeof usageRaw === "object"
      ? (usageRaw as {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          promptTokens?: number;
          completionTokens?: number;
        })
      : undefined;
  const metadata = result?.metadata;

  return {
    content: content.text,
    model: result?.model ?? "mcp-sampling",
    usage: usage
      ? {
          inputTokens: usage.inputTokens ?? usage.promptTokens ?? 0,
          outputTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
          totalTokens:
            usage.totalTokens ??
            ((usage.inputTokens ?? usage.promptTokens ?? 0) +
              (usage.outputTokens ?? usage.completionTokens ?? 0)),
        }
      : undefined,
    metadata: metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : undefined,
  };
}
