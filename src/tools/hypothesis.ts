import { z } from "zod";
import { generateHypotheses } from "../llm/generator.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const hypothesisTestPlanSchema = z.object({
  method: z.string(),
  expected: z.string(),
  metric: z.string().optional(),
});

const hypothesisSchema = z.object({
  text: z.string(),
  rationale: z.string(),
  testPlan: hypothesisTestPlanSchema,
});

const hypothesisProposeInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  text: z.string().min(1, "Incident synopsis is required"),
  rationale: z.string().optional(),
  context: z.string().optional(),
  logs: z.array(z.string()).optional(),
});

const hypothesisProposeOutputSchema = z.object({
  hypotheses: z.array(hypothesisSchema),
});

export type HypothesisProposeInput = z.infer<typeof hypothesisProposeInputSchema>;
export type HypothesisProposeOutput = z.infer<typeof hypothesisProposeOutputSchema>;

export const hypothesisProposeTool: ToolDefinition<
  HypothesisProposeInput,
  HypothesisProposeOutput
> = {
  name: "hypothesis/propose",
  description:
    "Generate up to 3 testable root cause hypotheses using the current case knowledge base.",
  inputSchema: hypothesisProposeInputSchema,
  outputSchema: hypothesisProposeOutputSchema,
  handler: async (input: HypothesisProposeInput, context: ToolContext) => {
    context.logger?.info("Generating hypotheses", { caseId: input.caseId });
    const hypotheses = await generateHypotheses(input);
    return { hypotheses };
  },
};
