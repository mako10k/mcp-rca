import { z } from "zod";
import { removeTestPlan } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const testPlanRemoveInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  testPlanId: z.string().min(1, "Test plan identifier is required"),
});

const testPlanRemoveOutputSchema = z.object({
  caseId: z.string(),
  testPlan: z.object({
    id: z.string(),
    caseId: z.string(),
    hypothesisId: z.string(),
    method: z.string(),
    expected: z.string(),
    metric: z.string().optional(),
    priority: z.number().int().min(1).max(10).optional(),
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

export type TestPlanRemoveInput = z.infer<typeof testPlanRemoveInputSchema>;
export type TestPlanRemoveOutput = z.infer<typeof testPlanRemoveOutputSchema>;

export const testPlanRemoveTool: ToolDefinition<
  TestPlanRemoveInput,
  TestPlanRemoveOutput
> = {
  name: "test_plan_remove",
  description: "Remove a test plan from a case.",
  inputSchema: testPlanRemoveInputSchema,
  outputSchema: testPlanRemoveOutputSchema,
  handler: async (input: TestPlanRemoveInput, context: ToolContext) => {
    context.logger?.info("Removing test plan", { caseId: input.caseId, testPlanId: input.testPlanId });
    const result = await removeTestPlan(input);
    return {
      caseId: input.caseId,
      testPlan: result.testPlan,
      case: result.case,
    };
  },
};