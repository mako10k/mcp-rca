import type { McpServer } from "../framework/mcpServerKit.js";
import { z } from "zod";

/**
 * Template for rca_next_step prompt
 */
const NEXT_STEP_TEMPLATE = `## Case Progress Analysis

**Case ID**: {{caseId}}
**Current Phase**: {{currentPhase}}

### Current State

- Observations: {{observationCount}} items
- Hypotheses: {{hypothesisCount}} items (high confidence: {{highConfidenceCount}})
- Test plans: {{testPlanCount}} items
- Conclusion: {{hasConclusion}}

### Recommended Next Actions

{{#if needMoreObservations}}
**Collect more observations**

Current observations are limited. Consider adding:
- System metrics (CPU, memory, disk I/O, network)
- Error log details and stack traces
- Timeline of changes (deploys, config updates)
- External dependency status

Tool: \`observation_add\`
{{/if}}

{{#if needHypotheses}}
**Generate hypotheses**

Sufficient observations collected. Generate root cause hypotheses:
1. What could explain the observed symptoms?
2. Were there recent changes or deployments?
3. Could external factors (load spikes, dependencies) be involved?

Tool: \`hypothesis_propose\` (LLM-assisted generation recommended)
{{/if}}

{{#if needTestPlans}}
**Create test plans**

Hypothesis {{topHypothesisId}} ({{topHypothesisText}}) needs verification:
- How can we test this hypothesis?
- What results do we expect?
- Which metrics should we measure?

Tools: \`test_plan\`, \`test_plan_update\`
{{/if}}

{{#if readyForConclusion}}
**Finalize conclusion**

Sufficient verification completed. Summarize:
- Confirmed root causes
- Fixes implemented
- Follow-up actions for prevention

Tool: \`conclusion_finalize\`
{{/if}}

### Additional Hints

{{contextualHints}}`;

/**
 * Register rca_next_step prompt
 */
export async function registerNextStepPrompt(server: McpServer) {
  const { getCase } = await import("../data/caseStore.js");
  const { analyzeCase } = await import("../prompt-helpers/case-analyzer.js");
  const { render } = await import("../prompt-helpers/template-renderer.js");

  server.registerPrompt(
    "rca_next_step",
    {
      description: "Suggest the next action based on current case state",
      argsSchema: {
        caseId: z.string().describe("Target case ID"),
        currentPhase: z
          .enum(["observation", "hypothesis", "testing", "conclusion"])
          .optional()
          .describe("Current phase"),
      },
    },
    async (args) => {
      const argsSchema = z.object({
        caseId: z.string(),
        currentPhase: z.enum(["observation", "hypothesis", "testing", "conclusion"]).optional(),
      });

      const parsed = argsSchema.parse(args);
      const result = await getCase(parsed.caseId);

      if (!result) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Error: Case ${parsed.caseId} not found`,
              },
            },
          ],
        };
      }

      const analysis = analyzeCase(result.case);
      const templateData = {
        caseId: parsed.caseId,
        currentPhase: parsed.currentPhase || analysis.phase,
        observationCount: result.case.observations.length,
        hypothesisCount: result.case.hypotheses.length,
        highConfidenceCount: result.case.hypotheses.filter((h) => (h.confidence ?? 0) > 0.7)
          .length,
        testPlanCount: result.case.tests.length,
        hasConclusion: result.case.conclusion ? "present" : "not yet",
        needMoreObservations: analysis.needMoreObservations,
        needHypotheses: analysis.needHypotheses,
        needTestPlans: analysis.needTestPlans,
        readyForConclusion: analysis.readyForConclusion,
        contextualHints: analysis.hints.map((h) => `- ${h}`).join("\n"),
        topHypothesisId: analysis.topHypothesis?.id || "",
        topHypothesisText: analysis.topHypothesis?.text || "",
      };

      const content = render(NEXT_STEP_TEMPLATE, templateData);

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: content,
            },
          },
        ],
      };
    },
  );
}
