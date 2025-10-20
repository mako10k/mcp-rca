import { z } from "zod";
import { addTestPlan } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const testPlanInputSchema = z.object({
  caseId: z.string(),
  hypothesisId: z.string(),
  method: z.string(),
  expected: z.string(),
  metric: z.string().optional(),
});

const testPlanOutputSchema = z.object({
  testPlanId: z.string(),
  status: z.enum(["draft", "scheduled", "completed"]),
  notes: z.string().optional(),
});

export type TestPlanInput = z.infer<typeof testPlanInputSchema>;
export type TestPlanOutput = z.infer<typeof testPlanOutputSchema>;

export const testPlanTool: ToolDefinition<TestPlanInput, TestPlanOutput> = {
  name: "test_plan",
  description:
    "Create a verification plan for a hypothesis, including the method, metrics, and expected signals.",
  inputSchema: testPlanInputSchema,
  outputSchema: testPlanOutputSchema,
  handler: async (input: TestPlanInput, context: ToolContext) => {
    context.logger?.info("Creating test plan", { caseId: input.caseId, hypothesisId: input.hypothesisId });
    const result = await addTestPlan(input);
    return {
      testPlanId: result.testPlan.id,
      status: "draft",
      notes: `Draft plan created for hypothesis ${input.hypothesisId}`,
    };
  },
};
