import { z } from "zod";
import { finalizeHypothesis } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const hypothesisFinalizeInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  hypothesisId: z.string().min(1, "Hypothesis identifier is required"),
});

const hypothesisFinalizeOutputSchema = z.object({
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

export type HypothesisFinalizeInput = z.infer<typeof hypothesisFinalizeInputSchema>;
export type HypothesisFinalizeOutput = z.infer<typeof hypothesisFinalizeOutputSchema>;

export const hypothesisFinalizeTool: ToolDefinition<
  HypothesisFinalizeInput,
  HypothesisFinalizeOutput
> = {
  name: "hypothesis_finalize",
  description: "Mark a hypothesis as confirmed by setting its confidence to 1.0.",
  inputSchema: hypothesisFinalizeInputSchema,
  outputSchema: hypothesisFinalizeOutputSchema,
  handler: async (input: HypothesisFinalizeInput, context: ToolContext) => {
    context.logger?.info("Finalizing hypothesis", { caseId: input.caseId, hypothesisId: input.hypothesisId });
    const result = await finalizeHypothesis(input);
    return result;
  },
};