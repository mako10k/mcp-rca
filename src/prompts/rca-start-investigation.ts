import type { McpServer } from "../framework/mcpServerKit.js";
import { z } from "zod";
import { render } from "../prompt-helpers/template-renderer.js";

export const START_INVESTIGATION_TEMPLATE = `You are a Root Cause Analysis (RCA) expert. Let's start investigating this incident systematically.

{{#if incidentSummary}}
## Current Situation
{{incidentSummary}}

{{/if}}
## Next Steps

### 1. Create RCA Case
First, create a new case with:
- **Title**: Brief, specific incident description
- **Severity**: 
  - SEV1: Service outage, critical impact
  - SEV2: Degraded functionality, significant impact
  - SEV3: Minor issue, limited impact
- **Tags**: Relevant categories (e.g., database, api, performance, network)

Tool: \`case_create\`

### 2. Record Initial Observations
Document what happened:
- **When** did the problem occur? (timestamps)
- **What** symptoms were observed? (errors, metrics, behavior)
- **Where** is the impact? (services, regions, users affected)
- **Related data**: Metrics, logs, error messages

Tool: \`observation_add\`

## Guidelines

- Record **facts only** in observations; avoid speculation
- Include timestamps and concrete numbers for later analysis
- Document git branch/commit and deploy environment when relevant
- Multiple small observations are better than one large vague one

## Example Workflow

\`\`\`
# 1. Create case
case_create title="API latency spike" severity=SEV2 tags=["api","performance"]

# 2. Add observations
observation_add caseId=case_xxx what="Response time increased from 100ms to 2000ms at 14:30 UTC" 
observation_add caseId=case_xxx what="Error rate jumped to 15% for /api/users endpoint"
observation_add caseId=case_xxx what="Database connection pool usage at 95%, normally 40%"
\`\`\`

## What's Next?

After collecting initial observations:
- Use \`rca_next_step\` to get guidance on what to do next
- Call \`guidance_best_practices\` for RCA principles and anti-patterns
- Use \`guidance_phase phase=observation\` for observation-specific tips`;

/**
 * Register rca_start_investigation prompt
 */
export async function registerStartInvestigationPrompt(server: McpServer) {
  server.registerPrompt(
    "rca_start_investigation",
    {
      description: "Guide to start a new RCA investigation and collect initial observations",
      argsSchema: {
        incidentSummary: z.string().optional().describe("Brief summary of the incident (1-2 lines)"),
      },
    },
    async (args) => {
      const argsSchema = z.object({
        incidentSummary: z.string().optional(),
      });

      const parsed = argsSchema.parse(args);
      const content = render(START_INVESTIGATION_TEMPLATE, {
        incidentSummary: parsed.incidentSummary || "",
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
