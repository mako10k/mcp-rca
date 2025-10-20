import { z } from "zod";
import { updateHypothesis } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const hypothesisUpdateInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  hypothesisId: z.string().min(1, "Hypothesis identifier is required"),
  text: z.string().min(1, "Hypothesis text is required").optional(),
  rationale: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const hypothesisUpdateOutputSchema = z.object({
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

export type HypothesisUpdateInput = z.infer<typeof hypothesisUpdateInputSchema>;
export type HypothesisUpdateOutput = z.infer<typeof hypothesisUpdateOutputSchema>;

export const hypothesisUpdateTool: ToolDefinition<
  HypothesisUpdateInput,
  HypothesisUpdateOutput
> = {
  name: "hypothesis_update",
  description: "Update an existing hypothesis in a case.",
  inputSchema: hypothesisUpdateInputSchema,
  outputSchema: hypothesisUpdateOutputSchema,
  handler: async (input: HypothesisUpdateInput, context: ToolContext) => {
    context.logger?.info("Updating hypothesis", { caseId: input.caseId, hypothesisId: input.hypothesisId });
    const result = await updateHypothesis(input);
    return result;
  },
};