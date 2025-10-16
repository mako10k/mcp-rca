import { generateHypotheses } from "../llm/generator.js";
import type { ToolDefinition, ToolContext } from "./types.js";

export interface HypothesisProposeInput {
  caseId: string;
  text: string;
  rationale?: string;
  context?: string;
  logs?: string[];
}

export interface HypothesisProposeOutput {
  hypotheses: Array<{
    text: string;
    rationale: string;
    testPlan: {
      method: string;
      expected: string;
      metric?: string;
    };
  }>;
}

export const hypothesisProposeTool: ToolDefinition<
  HypothesisProposeInput,
  HypothesisProposeOutput
> = {
  name: "hypothesis/propose",
  description:
    "Generate up to 3 testable root cause hypotheses using the current case knowledge base.",
  inputSchema: {
    type: "object",
    required: ["caseId", "text"],
    properties: {
      caseId: { type: "string", description: "Identifier of the active RCA case." },
      text: { type: "string", description: "Synopsis of the incident symptoms." },
      rationale: { type: "string" },
      context: { type: "string" },
      logs: {
        type: "array",
        items: { type: "string" },
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      hypotheses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            rationale: { type: "string" },
            testPlan: {
              type: "object",
              properties: {
                method: { type: "string" },
                expected: { type: "string" },
                metric: { type: "string" },
              },
              required: ["method", "expected"],
            },
          },
          required: ["text", "rationale", "testPlan"],
        },
      },
    },
    required: ["hypotheses"],
  },
  handler: async (input: HypothesisProposeInput, context: ToolContext) => {
    context.logger?.info("Generating hypotheses", { caseId: input.caseId });
    const hypotheses = await generateHypotheses(input);
    return { hypotheses };
  },
};
