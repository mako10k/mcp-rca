import { z } from "zod";
import { generateHypotheses } from "../llm/generator.js";
import { addHypothesis } from "../data/caseStore.js";
import type { Hypothesis } from "../schema/hypothesis.js";
import type { ToolDefinition, ToolContext } from "./types.js";

/**
 * Minimal test plan information included in hypothesis responses.
 */
type MinimalTestPlan = {
  id: string;
  hypothesisId: string;
  method: string;
  expected: string;
  metric?: string;
};

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
    .object({
      id: z.string(),
      hypothesisId: z.string(),
      method: z.string(),
      expected: z.string(),
      metric: z.string().optional(),
    })
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
  caseId: z.string(),
  hypotheses: z.array(hypothesisSchema),
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

    // Persist each hypothesis sequentially to avoid race conditions with file I/O
    const persisted: Array<Hypothesis & { testPlan?: MinimalTestPlan }> = [];
    let updatedCase;
    
    for (const hyp of generated) {
      const { hypothesis, case: caseAfterHypothesis } = await addHypothesis({
        caseId: input.caseId,
        text: hyp.text,
        rationale: hyp.rationale,
      });
      
      updatedCase = caseAfterHypothesis;
      
      let plan: MinimalTestPlan | undefined;
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
        updatedCase = result.case;
        plan = {
          id: result.testPlan.id,
          hypothesisId: hypothesis.id,
          method: result.testPlan.method,
          expected: result.testPlan.expected,
          metric: result.testPlan.metric,
        };
      }
      
      persisted.push({ ...hypothesis, testPlan: plan });
    }

    // Fetch final case state after all mutations
    const { getCase } = await import("../data/caseStore.js");
    const finalCase = await getCase(input.caseId);
    if (!finalCase) {
      throw new Error(`Case ${input.caseId} not found after hypothesis creation`);
    }

    return {
      caseId: input.caseId,
      hypotheses: persisted,
      case: finalCase.case,
    };
  },
};
