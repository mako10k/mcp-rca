import { z } from "zod";
import { generateHypotheses } from "../llm/generator.js";
import { addHypothesis } from "../data/caseStore.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const hypothesisTestPlanSchema = z.object({
  method: z.string(),
  expected: z.string(),
  metric: z.string().optional(),
});

const hypothesisSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  text: z.string(),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // If we created an initial test plan, surface minimal info
  testPlan: z
    .object({ id: z.string(), hypothesisId: z.string(), method: z.string(), expected: z.string(), metric: z.string().optional() })
    .optional(),
});

const hypothesisProposeInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  text: z.string().min(1, "Incident synopsis is required"),
  rationale: z.string().optional(),
  context: z.string().optional(),
  logs: z.array(z.string()).optional(),
});

const hypothesisProposeOutputSchema = z.object({
  hypotheses: z.array(hypothesisSchema),
});

export type HypothesisProposeInput = z.infer<typeof hypothesisProposeInputSchema>;
export type HypothesisProposeOutput = z.infer<typeof hypothesisProposeOutputSchema>;

export const hypothesisProposeTool: ToolDefinition<
  HypothesisProposeInput,
  HypothesisProposeOutput
> = {
  name: "hypothesis_propose",
  description:
    "Generate up to 3 testable root cause hypotheses using the current case knowledge base.",
  inputSchema: hypothesisProposeInputSchema,
  outputSchema: hypothesisProposeOutputSchema,
  handler: async (input: HypothesisProposeInput, context: ToolContext) => {
    context.logger?.info("Generating hypotheses", { caseId: input.caseId });
    const generated = await generateHypotheses(input);

    // Persist each hypothesis; also create a draft test plan if provided by generator
    const persisted = await Promise.all(
      generated.map(async (hyp) => {
        const { hypothesis } = await addHypothesis({
          caseId: input.caseId,
          text: hyp.text,
          rationale: hyp.rationale,
        });
        let plan: { id: string; hypothesisId: string; method: string; expected: string; metric?: string } | undefined;
        if (hyp.testPlan?.method && hyp.testPlan?.expected) {
          // lazily import to avoid cycle
          const { addTestPlan } = await import("../data/caseStore.js");
          const result = await addTestPlan({
            caseId: input.caseId,
            hypothesisId: hypothesis.id,
            method: hyp.testPlan.method,
            expected: hyp.testPlan.expected,
            metric: hyp.testPlan.metric,
          });
          plan = {
            id: result.testPlan.id,
            hypothesisId: hypothesis.id,
            method: result.testPlan.method,
            expected: result.testPlan.expected,
            metric: result.testPlan.metric,
          };
        }
        return { ...hypothesis, testPlan: plan };
      })
    );

    return { hypotheses: persisted };
  },
};
