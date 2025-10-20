import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HypothesisProposeInput } from "../tools/hypothesis.js";
import { LLMProviderManager } from "./LLMProviderManager.js";
import { logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HYPOTHESIS_PROMPT_PATH = resolve(__dirname, "prompts", "hypothesis.md");

export interface LlmClient {
  complete: (args: { prompt: string }) => Promise<string>;
}

// Global LLM manager instance
let llmManager: LLMProviderManager | undefined;

let cachedPrompt: string | undefined;

async function loadHypothesisPrompt(): Promise<string> {
  if (!cachedPrompt) {
    try {
      cachedPrompt = await readFile(HYPOTHESIS_PROMPT_PATH, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Try fallback paths for different execution contexts
        const fallbackPaths = [
          resolve(process.cwd(), "src", "llm", "prompts", "hypothesis.md"),
          resolve(__dirname, "..", "..", "src", "llm", "prompts", "hypothesis.md"),
        ];
        
        let loaded = false;
        for (const fallbackPath of fallbackPaths) {
          try {
            cachedPrompt = await readFile(fallbackPath, "utf-8");
            loaded = true;
            break;
          } catch {
            // Try next fallback
          }
        }
        
        if (!loaded) {
          // Use a minimal inline prompt as last resort
          cachedPrompt = `You are an RCA hypothesis generator. Given incident details, generate 1-3 testable hypotheses in JSON format:
[{"text": "hypothesis description", "rationale": "reasoning", "testPlan": {"method": "how to test", "expected": "expected outcome"}}]`;
        }
      } else {
        throw error;
      }
    }
  }
  // Ensure cachedPrompt is never undefined
  if (!cachedPrompt) {
    cachedPrompt = `You are an RCA hypothesis generator. Given incident details, generate 1-3 testable hypotheses in JSON format:
[{"text": "hypothesis description", "rationale": "reasoning", "testPlan": {"method": "how to test", "expected": "expected outcome"}}]`;
  }
  return cachedPrompt;
}

export async function generateHypotheses(
  input: HypothesisProposeInput,
  client?: LlmClient
): Promise<
  Array<{
    text: string;
    rationale: string;
    testPlan: { method: string; expected: string; metric?: string };
  }>
> {
  const prompt = await loadHypothesisPrompt();

  // If legacy client is provided, use it
  if (client) {
    const response = await client.complete({
      prompt: [
        prompt,
        JSON.stringify(
          {
            caseId: input.caseId,
            context: input.context,
            logs: input.logs,
            rationale: input.rationale,
            summary: input.text,
          },
          null,
          2
        ),
      ].join("\n\n"),
    });
    const parsedClient = parseHypothesisResponse(response);
    if (Array.isArray(parsedClient)) {
      return parsedClient;
    }
    if (isRecord(parsedClient) && Array.isArray(parsedClient.hypotheses)) {
      return parsedClient.hypotheses;
    }
    const rawText = typeof parsedClient === 'string' ? parsedClient : response.trim();

    return [
      {
        text: rawText,
        rationale: "Unable to parse structured LLM output, returning raw text.",
        testPlan: {
          method: "Operator review",
          expected: "Convert narrative into actionable verification steps.",
        },
      },
    ];
  }

  // Initialize LLM manager if not already done
  if (!llmManager) {
    try {
      llmManager = new LLMProviderManager({
        defaultProvider: process.env.LLM_PROVIDER || 'sampling',
      });
    } catch (error) {
      logger.warn("Failed to initialize LLM manager", "llm", { error });
    }
  }

  // 必ずLLMProviderManager経由で仮説生成を行う（SamplingProviderがfallback）
  if (llmManager) {
    try {
      const userPrompt = JSON.stringify(
        {
          caseId: input.caseId,
          context: input.context,
          logs: input.logs,
          rationale: input.rationale,
          summary: input.text,
        },
        null,
        2
      );

      const response = await llmManager.generateMessage(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: userPrompt },
        ],
        {
          maxTokens: 1500,
          temperature: 0.7,
        }
      );

      const parsed = parseHypothesisResponse(response.content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (isRecord(parsed) && Array.isArray(parsed.hypotheses)) {
        return parsed.hypotheses;
      }
      if (typeof parsed === 'string') {
        return [
          {
            text: parsed,
            rationale: 'LLM returned non-JSON content; review the raw string.',
            testPlan: {
              method: 'Operator review',
              expected: 'Transform the provided narrative into structured hypotheses.',
            },
          },
        ];
      }
      // 返却値が不正な場合はエラー
      throw new Error('LLM response could not be parsed as hypotheses');
    } catch (error) {
      throw new Error('LLM hypothesis generation failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  // llmManagerが初期化できない場合はエラー
  throw new Error('LLMProviderManager could not be initialized');
}

function parseHypothesisResponse(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty LLM response');
  }

  const attempts: string[] = [];

  // Collect content inside code fences (``` or ```json)
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRegex.exec(trimmed)) !== null) {
    const candidate = fenceMatch[1]?.trim();
    if (candidate) {
      attempts.push(candidate);
    }
  }

  // Add substring starting at first JSON-looking character
  const arrayStart = trimmed.indexOf('[');
  const objectStart = trimmed.indexOf('{');
  const hasStart = arrayStart !== -1 || objectStart !== -1;
  if (hasStart) {
    const start = arrayStart !== -1 && objectStart !== -1 ? Math.min(arrayStart, objectStart) : Math.max(arrayStart, objectStart);
    if (start >= 0) {
      attempts.push(trimmed.slice(start));
    }
  }

  // Always attempt the entire string last
  attempts.push(trimmed);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
