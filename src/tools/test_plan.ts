import { z } from "zod";
import type { ToolDefinition } from "./types.js";

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
  handler: async (input: TestPlanInput) => {
    // Placeholder implementation until persistence is connected.
    return {
      testPlanId: `tp_${Date.now()}`,
      status: "draft",
      notes: `Draft plan created for hypothesis ${input.hypothesisId}`,
    };
  },
};
