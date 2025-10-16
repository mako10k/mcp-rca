import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HypothesisProposeInput } from "../tools/hypothesis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HYPOTHESIS_PROMPT_PATH = resolve(__dirname, "prompts", "hypothesis.md");

export interface LlmClient {
  complete: (args: { prompt: string }) => Promise<string>;
}

let cachedPrompt: string | undefined;

async function loadHypothesisPrompt(): Promise<string> {
  if (!cachedPrompt) {
    try {
      cachedPrompt = await readFile(HYPOTHESIS_PROMPT_PATH, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const fallback = resolve(
          process.cwd(),
          "src",
          "llm",
          "prompts",
          "hypothesis.md"
        );
        cachedPrompt = await readFile(fallback, "utf-8");
      } else {
        throw error;
      }
    }
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

  if (!client) {
    // Without an LLM client wired up we return a deterministic placeholder.
    return [
      {
        text: `Placeholder hypothesis for case ${input.caseId}`,
        rationale: "LLM integration not yet configured.",
        testPlan: {
          method: "Review telemetry",
          expected: "Identify signals contradicting the hypothesis",
        },
      },
    ];
  }

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

  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed.hypotheses)) {
      return parsed.hypotheses;
    }
  } catch {
    // Fall through to placeholder below.
  }

  return [
    {
      text: response.trim(),
      rationale: "Unable to parse structured LLM output, returning raw text.",
      testPlan: {
        method: "Operator review",
        expected: "Convert narrative into actionable verification steps.",
      },
    },
  ];
}
