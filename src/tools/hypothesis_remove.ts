import { z } from "zod";
import { removeHypothesis } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const hypothesisRemoveInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  hypothesisId: z.string().min(1, "Hypothesis identifier is required"),
});

const hypothesisRemoveOutputSchema = z.object({
  caseId: z.string(),
  hypothesis: z.object({
    id: z.string(),
    caseId: z.string(),
    text: z.string(),
    rationale: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  case: z.object({
    id: z.string(),
    title: z.string(),
    severity: z.string(),
    tags: z.array(z.string()),
    status: z.string(),
    observations: z.array(z.any()),
    impacts: z.array(z.any()),
    hypotheses: z.array(z.any()),
    tests: z.array(z.any()),
    results: z.array(z.any()),
    conclusion: z.any().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

export type HypothesisRemoveInput = z.infer<typeof hypothesisRemoveInputSchema>;
export type HypothesisRemoveOutput = z.infer<typeof hypothesisRemoveOutputSchema>;

export const hypothesisRemoveTool: ToolDefinition<
  HypothesisRemoveInput,
  HypothesisRemoveOutput
> = {
  name: "hypothesis_remove",
  description: "Remove a hypothesis from a case and its related test plans.",
  inputSchema: hypothesisRemoveInputSchema,
  outputSchema: hypothesisRemoveOutputSchema,
  handler: async (input: HypothesisRemoveInput, context: ToolContext) => {
    context.logger?.info("Removing hypothesis", { caseId: input.caseId, hypothesisId: input.hypothesisId });
    const result = await removeHypothesis(input);
    return {
      caseId: input.caseId,
      hypothesis: result.hypothesis,
      case: result.case,
    };
  },
};