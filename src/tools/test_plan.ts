import { z } from "zod";
import { addTestPlan } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const testPlanInputSchema = z.object({
  caseId: z.string(),
  hypothesisId: z.string(),
  method: z.string(),
  expected: z.string(),
  metric: z.string().optional(),
  gitBranch: z.string().trim().optional(),
  gitCommit: z.string().trim().optional(),
  deployEnv: z.string().trim().optional(),
});

const testPlanOutputSchema = z.object({
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

export type TestPlanInput = z.infer<typeof testPlanInputSchema>;
export type TestPlanOutput = z.infer<typeof testPlanOutputSchema>;

export const testPlanTool: ToolDefinition<TestPlanInput, TestPlanOutput> = {
  name: "test_plan_create",
  description:
    "Create a verification plan for a hypothesis, including the method, metrics, and expected signals.",
  inputSchema: testPlanInputSchema,
  outputSchema: testPlanOutputSchema,
  handler: async (input: TestPlanInput, context: ToolContext) => {
    context.logger?.info("Creating test plan", { caseId: input.caseId, hypothesisId: input.hypothesisId });
    const result = await addTestPlan({
      caseId: input.caseId,
      hypothesisId: input.hypothesisId,
      method: input.method,
      expected: input.expected,
      metric: input.metric,
      gitBranch: input.gitBranch?.trim() || undefined,
      gitCommit: input.gitCommit?.trim() || undefined,
      deployEnv: input.deployEnv?.trim() || undefined,
    });
    return {
      caseId: input.caseId,
      testPlan: result.testPlan,
      case: result.case,
    };
  },
};
