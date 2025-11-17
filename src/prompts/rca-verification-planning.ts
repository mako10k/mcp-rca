import type { McpServer } from "../framework/mcpServerKit.js";
import { z } from "zod";
import { render } from "../prompt-helpers/template-renderer.js";

export const VERIFICATION_PLANNING_TEMPLATE = `## Test Plan Creation

### Target Hypothesis
{{hypothesisText}}

### Effective Test Plan Elements

#### 1. Verification Method (method)
- What to investigate or test, and how
- Tools and commands to use
- Execution environment and preconditions

#### 2. Expected Results (expected)
- Observable results if hypothesis is correct
- Specific values or states to look for

#### 3. Measurement Metrics (metric)
- Quantitative criteria for judgment
- Thresholds and success criteria

### Test Plan Templates

#### Log Investigation
\`\`\`
method: "grep ERROR /var/log/app.log | grep '{{timestamp}}'"
expected: "Specific error pattern found"
metric: "error_count > 100"
\`\`\`

#### Metrics Verification
\`\`\`
method: "Check memory_usage in Prometheus"
expected: "Memory usage exceeds 95%"
metric: "memory_usage_percent"
\`\`\`

#### Reproduction Test
\`\`\`
method: "Reproduce conditions with load testing tool"
expected: "Similar errors occur"
metric: "error_rate"
\`\`\`

#### Code Analysis
\`\`\`
method: "git diff {{commit_before}}..{{commit_after}} to review code changes"
expected: "Problematic changes identified"
metric: "changed_lines"
\`\`\`

### Prioritization

Assign priority to test plans:
- **1-2**: High priority (low cost, high impact)
- **3-5**: Medium priority
- **6-10**: Low priority (time-consuming, low impact)

### Using Tools

\`\`\`
test_plan caseId={{caseId}} hypothesisId={{hypothesisId}} \\
  method="..." expected="..." metric="..." priority=1
\`\`\`

### RICE Scoring

For multiple test plans, use prioritization:

\`\`\`
test_prioritize strategy=RICE items=[
  {id: "tp_1", reach: 10, impact: 3, confidence: 0.8, effort: 2},
  {id: "tp_2", reach: 5, impact: 2, confidence: 0.6, effort: 1}
]
\`\`\`

- **Reach**: Scope of impact
- **Impact**: Severity of impact
- **Confidence**: Certainty level
- **Effort**: Implementation cost

### Best Practices

- Start with safe, reversible tests
- Prefer automated over manual verification
- Document environment and preconditions clearly
- Set clear success/failure criteria upfront`;

/**
 * Register rca_verification_planning prompt
 */
export async function registerVerificationPlanningPrompt(server: McpServer) {
  server.registerPrompt(
    "rca_verification_planning",
    {
      description: "Guide for creating effective test plans to verify hypotheses",
      argsSchema: {
        caseId: z.string().describe("Target case ID"),
        hypothesisId: z.string().describe("Target hypothesis ID"),
        hypothesisText: z.string().describe("Hypothesis text to verify"),
      },
    },
    async (args) => {
      const argsSchema = z.object({
        caseId: z.string(),
        hypothesisId: z.string(),
        hypothesisText: z.string(),
      });

      const parsed = argsSchema.parse(args);

      const content = render(VERIFICATION_PLANNING_TEMPLATE, {
        caseId: parsed.caseId,
        hypothesisId: parsed.hypothesisId,
        hypothesisText: parsed.hypothesisText,
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
