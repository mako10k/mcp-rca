import { z } from "zod";
import { updateTestPlan } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const testPlanUpdateInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  testPlanId: z.string().min(1, "Test plan identifier is required"),
  method: z.string().min(1, "Test method is required").optional(),
  expected: z.string().min(1, "Expected outcome is required").optional(),
  metric: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(10).nullable().optional(),
  gitBranch: z.string().trim().nullable().optional(),
  gitCommit: z.string().trim().nullable().optional(),
  deployEnv: z.string().trim().nullable().optional(),
});

const testPlanUpdateOutputSchema = z.object({
  caseId: z.string(),
  testPlan: z.object({
    id: z.string(),
    caseId: z.string(),
    hypothesisId: z.string(),
    method: z.string(),
    expected: z.string(),
    metric: z.string().optional(),
    priority: z.number().int().min(1).max(10).optional(),
    gitBranch: z.string().optional(),
    gitCommit: z.string().optional(),
    deployEnv: z.string().optional(),
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

export type TestPlanUpdateInput = z.infer<typeof testPlanUpdateInputSchema>;
export type TestPlanUpdateOutput = z.infer<typeof testPlanUpdateOutputSchema>;

export const testPlanUpdateTool: ToolDefinition<
  TestPlanUpdateInput,
  TestPlanUpdateOutput
> = {
  name: "test_plan_update",
  description: "Update an existing test plan in a case.",
  inputSchema: testPlanUpdateInputSchema,
  outputSchema: testPlanUpdateOutputSchema,
  handler: async (input: TestPlanUpdateInput, context: ToolContext) => {
    context.logger?.info("Updating test plan", { caseId: input.caseId, testPlanId: input.testPlanId });
    const result = await updateTestPlan({
      caseId: input.caseId,
      testPlanId: input.testPlanId,
      method: input.method,
      expected: input.expected,
      metric: input.metric,
      priority: input.priority,
      gitBranch: input.gitBranch,
      gitCommit: input.gitCommit,
      deployEnv: input.deployEnv,
    });
    return {
      caseId: input.caseId,
      testPlan: result.testPlan,
      case: result.case,
    };
  },
};