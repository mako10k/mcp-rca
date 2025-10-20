import { z } from "zod";
import { bulkDeleteProvisional } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const bulkDeleteProvisionalInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  priorityThreshold: z.number().int().min(1).max(10).optional(),
});

const bulkDeleteProvisionalOutputSchema = z.object({
  deletedHypotheses: z.array(z.object({
    id: z.string(),
    caseId: z.string(),
    text: z.string(),
    rationale: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  deletedTestPlans: z.array(z.object({
    id: z.string(),
    caseId: z.string(),
    hypothesisId: z.string(),
    method: z.string(),
    expected: z.string(),
    metric: z.string().optional(),
    priority: z.number().int().min(1).max(10).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
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

export type BulkDeleteProvisionalInput = z.infer<typeof bulkDeleteProvisionalInputSchema>;
export type BulkDeleteProvisionalOutput = z.infer<typeof bulkDeleteProvisionalOutputSchema>;

export const bulkDeleteProvisionalTool: ToolDefinition<
  BulkDeleteProvisionalInput,
  BulkDeleteProvisionalOutput
> = {
  name: "bulk_delete_provisional",
  description: "Bulk delete provisional hypotheses and test plans based on confidence and priority thresholds.",
  inputSchema: bulkDeleteProvisionalInputSchema,
  outputSchema: bulkDeleteProvisionalOutputSchema,
  handler: async (input: BulkDeleteProvisionalInput, context: ToolContext) => {
    context.logger?.info("Bulk deleting provisional items", { caseId: input.caseId, confidenceThreshold: input.confidenceThreshold, priorityThreshold: input.priorityThreshold });
    const result = await bulkDeleteProvisional(input);
    return result;
  },
};