import type { McpServer } from "../framework/mcpServerKit.js";
import { z } from "zod";
import { render } from "../prompt-helpers/template-renderer.js";

export const HYPOTHESIS_GUIDE_TEMPLATE = `## Hypothesis Generation Guide

### Good Hypothesis Criteria

1. **Testable**: Clear verification method exists
2. **Specific**: Avoid vague terms; refer to concrete components or behaviors
3. **Consistent with observations**: No contradiction with recorded facts
4. **Feasible**: Technically plausible scenario

### Hypothesis Categories

#### Code/Configuration Issues
- Bug introduction in recent changes
- Configuration errors or mismatches
- Deployment failures or rollback issues
- Compatibility problems between components

#### Resource Constraints
- Memory leaks leading to OOM
- Disk space exhaustion
- CPU saturation under load
- Network bandwidth saturation

#### External Factors
- Dependent service outages or degradation
- Unexpected traffic spikes or load patterns
- DDoS attacks or abuse
- Third-party API changes or failures

{{#if observationSummary}}
### Current Case Observations

{{observationSummary}}

{{/if}}
### Recommended Hypothesis Generation Approach

1. **Timeline Analysis**: Review changes before/after problem occurrence
2. **Diff Analysis**: Compare normal vs. abnormal states
3. **5 Whys**: Repeatedly ask "why?" to dig deeper
4. **Similar Cases**: Reference past incidents with similar symptoms

### Using Tools

#### LLM-Assisted Generation (Recommended)
\`\`\`
hypothesis_propose caseId={{caseId}}
\`\`\`

The LLM will:
- Analyze all observations in the case
- Generate 1-3 testable hypotheses
- Provide rationale and confidence scores
- Optionally create initial test plans

#### Manual Hypothesis Addition
If you prefer manual control, use the tool parameters:
\`\`\`
hypothesis_propose caseId={{caseId}} text="Your hypothesis" rationale="Why you think this" context="Additional context"
\`\`\`

### After Generating Hypotheses

1. Define verification methods for each (test plans)
2. Prioritize by likelihood × impact
3. Execute tests and update confidence scores
4. Use \`hypothesis_finalize\` for confirmed causes

### Next Steps

- Call \`guidance_phase phase=hypothesis\` for detailed hypothesis phase guidance
- Use \`guidance_prompt_scaffold task=hypothesis\` for structured output format
- Try \`test_plan\` to define verification for a hypothesis`;

/**
 * Register rca_hypothesis_propose prompt
 */
export async function registerHypothesisGuidePrompt(server: McpServer) {
  const { getCase } = await import("../data/caseStore.js");

  server.registerPrompt(
    "rca_hypothesis_propose",
    {
      description: "Guide for generating effective root cause hypotheses",
      argsSchema: {
        caseId: z.string().describe("Target case ID"),
        observationSummary: z.string().optional().describe("Optional summary of key observations"),
      },
    },
    async (args) => {
      const argsSchema = z.object({
        caseId: z.string(),
        observationSummary: z.string().optional(),
      });

      const parsed = argsSchema.parse(args);

      let observationSummary = parsed.observationSummary || "";

      // If no summary provided, fetch case and generate one
      if (!observationSummary) {
        const result = await getCase(parsed.caseId);
        if (result && result.case.observations.length > 0) {
          observationSummary = result.case.observations
            .map((obs, idx) => `${idx + 1}. ${obs.what}`)
            .join("\n");
        }
      }

      const content = render(HYPOTHESIS_GUIDE_TEMPLATE, {
        caseId: parsed.caseId,
        observationSummary,
      });

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
