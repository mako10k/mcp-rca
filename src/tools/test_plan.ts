import type { ToolDefinition } from "./types.js";

export interface TestPlanInput {
  caseId: string;
  hypothesisId: string;
  method: string;
  expected: string;
  metric?: string;
}

export interface TestPlanOutput {
  testPlanId: string;
  status: "draft" | "scheduled" | "completed";
  notes?: string;
}

export const testPlanTool: ToolDefinition<TestPlanInput, TestPlanOutput> = {
  name: "test/plan",
  description:
    "Create a verification plan for a hypothesis, including the method, metrics, and expected signals.",
  inputSchema: {
    type: "object",
    required: ["caseId", "hypothesisId", "method", "expected"],
    properties: {
      caseId: { type: "string" },
      hypothesisId: { type: "string" },
      method: { type: "string" },
      expected: { type: "string" },
      metric: { type: "string" },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    required: ["testPlanId", "status"],
    properties: {
      testPlanId: { type: "string" },
      status: { type: "string", enum: ["draft", "scheduled", "completed"] },
      notes: { type: "string" },
    },
  },
  handler: async (input: TestPlanInput) => {
    // Placeholder implementation until persistence is connected.
    return {
      testPlanId: `tp_${Date.now()}`,
      status: "draft",
      notes: `Draft plan created for hypothesis ${input.hypothesisId}`,
    };
  },
};
